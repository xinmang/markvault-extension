/**
 * AI 推荐处理器
 */

import { t } from '@/lib/i18n';
import { logger } from '@/lib/utils/logger';
import type { Message, MessageResponse } from '@/types';
import { StorageService } from '@/lib/utils/storage';
import { callAI } from '@/lib/services/ai-client';
import { NEWTAB_FOLDER_PROMPT_TEMPLATE } from '@/lib/constants/newtabPrompts';
import { buildTypeSafeFolderQuestion } from '@/lib/constants/prompts';
import { TYPESAFE_CONFIG } from '@/lib/constants/urls';
import {
  callTypeSafe,
  getNoulScore,
  type TypeSafeQuestion,
} from '@/lib/services/typesafe-client';
import { safeParseJson } from '../utils/json-parser';
import { handleGetNewtabFolders } from './newtab-folders';

/**
 * 推荐 NewTab 文件夹
 */
export async function handleRecommendNewtabFolder(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  const page = message.payload as {
    title?: string;
    url?: string;
    description?: string;
  };
  const url = page?.url;
  if (!url) {
    throw new Error('Missing url');
  }

  const config = await StorageService.loadConfig();
  if (config.preferences.enableNewtabAI === false) {
    return { success: true, data: { suggestedFolders: [] } };
  }
  const countRaw = Number(config.preferences.newtabFolderRecommendCount ?? 10);
  const recommendCount = Math.min(20, Math.max(1, Number.isFinite(countRaw) ? countRaw : 10));

  const foldersResp = await handleGetNewtabFolders();
  if (!foldersResp.success) {
    throw new Error(foldersResp.error || 'Failed to load folders');
  }
  const folderData = foldersResp.data as {
    rootId: string;
    folders: Array<{
      id: string;
      title: string;
      parentId: string | null;
      path: string;
    }>;
  };

  const folderPaths = folderData.folders
    .filter((f) => f.id !== folderData.rootId)
    .map((f) => f.path)
    .slice(0, 200);

  const defaultPrompt = NEWTAB_FOLDER_PROMPT_TEMPLATE.split('{{title}}')
    .join(page.title || '')
    .split('{{url}}')
    .join(url)
    .split('{{description}}')
    .join(page.description || t('none'))
    .split('{{recommendCount}}')
    .join(String(recommendCount))
    .split('{{folderPaths}}')
    .join(folderPaths.join('\n'));

  const customTemplate = (config.preferences.newtabFolderPrompt || '').trim();

  const prompt =
    config.preferences.enableNewtabFolderPrompt && customTemplate
      ? customTemplate
          .split('{{title}}')
          .join(page.title || '')
          .split('{{url}}')
          .join(url)
          .split('{{description}}')
          .join(page.description || t('none'))
          .split('{{recommendCount}}')
          .join(String(recommendCount))
          .split('{{folderPaths}}')
          .join(folderPaths.join('\n'))
      : defaultPrompt;

  const apiKey = config.aiConfig.apiKeys[config.aiConfig.provider];
  if (!apiKey) {
    return { success: true, data: { suggestedFolders: [] } };
  }

  // TypeSafe(jev) 是结构化评估模型，不接受自由文本提示词。
  // 这里把每个候选文件夹路径转成一个 noul 问题，一次请求并发打分，再在代码中取 Top-N。
  if (config.aiConfig.provider === 'typesafe') {
    return recommendNewtabFolderWithTypeSafe({
      page,
      url,
      folders: folderData.folders,
      rootId: folderData.rootId,
      recommendCount,
      apiKey,
      model: config.aiConfig.model,
      apiUrl: config.aiConfig.apiUrls?.typesafe,
    });
  }

  const aiResult = await callAI({
    provider: config.aiConfig.provider as any,
    apiKey,
    model: config.aiConfig.model,
    apiUrl: config.aiConfig.apiUrls?.[config.aiConfig.provider],
    prompt,
  });

  const aiContent = aiResult.content || '';
  const parsed = safeParseJson(aiContent) || { suggestedFolders: [] };

  const suggested = Array.isArray(parsed?.suggestedFolders) ? parsed.suggestedFolders : [];
  if (suggested.length === 0 && aiContent.trim()) {
    logger.warn(
      '[NewTab Folder Recommend] AI result not parsable or empty suggestedFolders',
      {
        provider: config.aiConfig.provider,
        model: config.aiConfig.model,
        rawPreview: aiContent.trim().slice(0, 1000),
        parsed,
      }
    );
  }
  const pathToId = new Map(folderData.folders.map((f) => [f.path, f.id] as const));
  const normalized = suggested
    .map((s: any) => ({
      path: typeof s?.path === 'string' ? s.path : '',
      confidence: typeof s?.confidence === 'number' ? s.confidence : 0,
    }))
    .filter((s: any) => s.path && pathToId.has(s.path))
    .slice(0, recommendCount)
    .map((s: any) => ({
      id: pathToId.get(s.path)!,
      path: s.path,
      confidence: s.confidence,
    }));

  return {
    success: true,
    data: { suggestedFolders: normalized },
  };
}

interface TypeSafeFolderCandidate {
  id: string;
  title: string;
  parentId: string | null;
  path: string;
}

/**
 * 使用 TypeSafe 推荐 NewTab 文件夹。
 *
 * 调用流程：
 *   1. 把候选文件夹路径转成 noul 问题（每个路径一个问题）；
 *   2. POST /v1/systemone 一次请求并发评估全部问题；
 *   3. 按概率阈值筛选、降序排序、截断到 recommendCount。
 */
async function recommendNewtabFolderWithTypeSafe(params: {
  page: { title?: string; url?: string; description?: string };
  url: string;
  folders: TypeSafeFolderCandidate[];
  rootId: string;
  recommendCount: number;
  apiKey: string;
  model?: string;
  apiUrl?: string;
}): Promise<MessageResponse> {
  const { page, url, folders, rootId, recommendCount, apiKey, model, apiUrl } = params;

  const candidates = folders
    .filter((folder) => folder.id !== rootId && folder.path)
    .slice(0, TYPESAFE_CONFIG.MAX_CANDIDATES);

  if (candidates.length === 0) {
    return { success: true, data: { suggestedFolders: [] } };
  }

  const questions: Record<string, TypeSafeQuestion> = {};
  candidates.forEach((folder, index) => {
    questions[`folder_${index + 1}`] = {
      type: 'noul',
      instructions: buildTypeSafeFolderQuestion(folder.path),
      criteria: {
        true: `The page clearly belongs in "${folder.path}"`,
        false: `The page does not belong in "${folder.path}"`,
      },
    };
  });

  const response = await callTypeSafe({
    apiKey,
    model,
    apiUrl,
    state: {
      page: {
        title: page.title || '',
        url,
        description: page.description || '',
      },
      candidate_folder_paths: candidates.map((folder) => folder.path),
    },
    questions,
  });

  const suggestedFolders = candidates
    .map((folder, index) => ({
      id: folder.id,
      path: folder.path,
      confidence: getNoulScore(response.answers, `folder_${index + 1}`) ?? 0,
    }))
    .filter((item) => item.confidence >= TYPESAFE_CONFIG.MIN_SCORE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, recommendCount)
    .map((item) => ({
      ...item,
      confidence: Math.round(item.confidence * 100) / 100,
    }));

  return {
    success: true,
    data: { suggestedFolders },
  };
}
