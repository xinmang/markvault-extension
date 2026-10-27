import { callAI } from './ai-client';
import { getDescriptionConnection } from './ai-connection';
import { normalizePageText } from '@/lib/utils/page-description';
import { normalizeTranslatedText } from '@/lib/utils/text';
import type { PageInfo, StorageConfig } from '@/types';

/** 描述生成的系统提示词：只写当前网页，不推测、不营销 */
export const DESCRIPTION_SYSTEM_PROMPT =
  '你是书签描述助手，为用户收藏的网页写简短、准确的中文描述，帮助日后一眼看出这个书签是做什么的。' +
  '只能依据提供的标题、网址、原描述和正文，不得编造功能或数据；输出必须是 JSON。';

/** 默认提示词模板；自定义模板可使用相同的占位符 */
export const DESCRIPTION_PROMPT_TEMPLATE = `请为下面的网页写一条书签描述。

标题：{{title}}
网址：{{url}}
网页原描述：{{description}}
正文节选：
{{content}}

要求：
1. 用简体中文，40–120 字，一到两句话，说清楚它是什么、能做什么或讲了什么；
2. 代码仓库说明项目用途和主要特点，论坛帖子和推文概括主要观点，文档说明涵盖的内容；
3. 原描述是“Contribute to … on GitHub”这类模板文字、营销口号或与页面无关时，改用正文概括；
4. 不要以“这是一个”“该页面”开头，不要堆砌形容词；
5. 同时给出简洁的中文标题（原标题已是中文且简洁时原样返回）。

只输出 JSON：{"description": "…", "title": "…"}`;

export interface GeneratedDescription {
  description?: string;
  title?: string;
}

function fillTemplate(template: string, page: PageInfo): string {
  const values: Record<string, string> = {
    title: normalizePageText(page.title) || '无',
    url: page.url,
    description: normalizePageText(page.description) || '无',
    content: normalizePageText(page.content).slice(0, 1500) || '无',
  };
  return template.replace(/\{\{(title|url|description|content)\}\}/g, (_, key: string) => values[key] ?? '');
}

/** 从模型输出中取出 JSON；兼容模型在 JSON 前后附带说明或代码块 */
export function parseDescriptionResponse(content: string): GeneratedDescription {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    // 没有 JSON 时把整段文本当作描述，但仍需通过中文校验
    return { description: normalizeTranslatedText(content.replace(/^["'“]|["'”]$/g, '')) };
  }
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      description: normalizeTranslatedText(parsed.description ?? parsed.desc),
      title: normalizeTranslatedText(parsed.title),
    };
  } catch {
    return {};
  }
}

/**
 * 使用描述模型为当前网页生成中文描述与标题。
 * 未配置可生成文字的模型时返回 null，调用方保留原描述。
 */
export async function generateDescription(
  page: PageInfo,
  config: StorageConfig
): Promise<GeneratedDescription | null> {
  const connection = getDescriptionConnection(config);
  if (!connection) return null;

  const customTemplate = config.aiConfig.enableDescriptionPrompt ? config.aiConfig.descriptionPrompt?.trim() : '';
  const prompt = fillTemplate(customTemplate || DESCRIPTION_PROMPT_TEMPLATE, page);
  const { content } = await callAI({
    provider: connection.provider,
    apiKey: connection.apiKey,
    apiUrl: connection.apiUrl,
    model: connection.model,
    prompt,
    systemPrompt: DESCRIPTION_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 400,
  });
  return parseDescriptionResponse(content);
}
