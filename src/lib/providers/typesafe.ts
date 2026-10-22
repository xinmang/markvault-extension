/**
 * TypeSafe (System One) Provider
 *
 * 对接文档：https://docs.typesafe.ai/api
 *
 * 与 OpenAI 系的“自由文本生成”不同，TypeSafe 是一个**结构化评估**模型：
 * 你提交一份 `state`，再提交一组带类型的 `questions`，它只会在你给定的
 * 选项 / 等级 / 是-否框架内返回校准过的概率，不会自由生成文本。
 *
 * 因此标签推荐采用官方推荐的 “speculative fan-out” 模式，把任务做成
 * **从用户已有标签库里分拣**：
 *   1. 标签库里的每个标签各变成一个 `noul` 问题（“这个书签该不该打这个标签”）；
 *   2. 一次请求并发评估全部问题（官方：增加问题几乎不改变响应时间）；
 *   3. 在代码中按概率阈值筛选、降序排序、截断到 maxTags。
 *
 * 能力边界（由 API 语义决定，非实现缺陷）：
 * - **不做翻译**：不产出 translatedTitle / translatedDescription，
 *   标题与描述直接沿用页面抓取到的原文（见 TYPESAFE_DESCRIPTION_POLICY）；
 * - **不造新词**：候选只来自用户已有标签库，绝不会返回库里没有的标签
 *   （所以不会出现“拿网页标题当标签”这种情况）。
 *
 * 说明：官方文档指出英文是主要训练语言、CJK 准确率相对较低，因此这里
 * 的 `instructions` 用英文撰写（标签名本身保持原样），以获得更稳的判定。
 */

import type { AIRequest, AIResponse, TagSuggestion } from '@/types';
import { AIProvider } from './base';
import { TYPESAFE_CONFIG } from '@/lib/constants/urls';
import { buildTypeSafeTagQuestion } from '@/lib/constants/prompts';
import {
  callTypeSafe,
  getNoulScore,
  type TypeSafeQuestion,
} from '@/lib/services/typesafe-client';

interface CandidateTag {
  name: string;
}

const normalizeTagKey = (name: string): string => name.trim().toLowerCase();

/**
 * 把用户标签库转成候选列表：去重、丢弃脏数据，最多取 MAX_CANDIDATES 个。
 *
 * 调用方给出的顺序通常是使用频次降序，因此超出上限时优先保留高频标签。
 */
const collectCandidates = (existingTags: string[], limit: number): CandidateTag[] => {
  const seen = new Set<string>();
  const result: CandidateTag[] = [];

  for (const raw of existingTags) {
    if (result.length >= limit) break;

    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name || name.length > 40) continue;

    const key = normalizeTagKey(name);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ name });
  }

  return result;
};

/** 只送页面本身：判定“这个标签是否适合这个页面”不需要额外上下文 */
const buildState = (request: AIRequest): Record<string, unknown> => {
  const { page } = request;

  return {
    page: {
      title: page.title,
      url: page.url,
      description: page.description || '',
      content_excerpt: page.content?.substring(0, 800) || '',
    },
  };
};

const buildQuestions = (candidates: CandidateTag[]): Record<string, TypeSafeQuestion> => {
  const questions: Record<string, TypeSafeQuestion> = {};

  candidates.forEach((candidate, index) => {
    questions[`tag_${index + 1}`] = {
      type: 'noul',
      // 判定口径集中在 constants/prompts.ts 的 jev 专用提示词中维护
      instructions: buildTypeSafeTagQuestion(candidate.name),
      criteria: {
        true: `"${candidate.name}" is a relevant, useful tag for this page`,
        false: `"${candidate.name}" is clearly unrelated or misleading for this page`,
      },
    };
  });

  return questions;
};

export class TypeSafeProvider extends AIProvider {
  name = 'typesafe';
  models = [TYPESAFE_CONFIG.DEFAULT_MODEL, 'jev-preview', 'jev-1.13.0'];

  /**
   * jev 只做分拣 / 判定，不做翻译。
   * 描述与标题直接沿用页面抓取到的原文（见 TYPESAFE_DESCRIPTION_POLICY）。
   */
  readonly supportsTranslation = false;

  async generateTags(
    request: AIRequest,
    apiKey: string,
    model: string = TYPESAFE_CONFIG.DEFAULT_MODEL,
    apiUrl?: string,
    // TypeSafe 不消费自由文本提示词：判定逻辑写在 questions.instructions 中，
    // 因此此处忽略 customPrompt（已在设置页说明）。
    _customPrompt?: string
  ): Promise<AIResponse> {
    try {
      const { context, options } = request;

      const candidates = collectCandidates(
        context.existingTags || [],
        TYPESAFE_CONFIG.MAX_CANDIDATES
      );

      // 标签库为空 → 没有可分拣的对象，TypeSafe 无法给出任何标签
      if (candidates.length === 0) {
        return { suggestedTags: [] };
      }

      const response = await callTypeSafe({
        apiKey,
        model,
        apiUrl,
        state: buildState(request),
        questions: buildQuestions(candidates),
      });

      const scored = candidates.map((candidate, index) => ({
        name: candidate.name,
        score: getNoulScore(response.answers, `tag_${index + 1}`),
      }));

      const suggestedTags: TagSuggestion[] = scored
        .filter((item): item is { name: string; score: number } => typeof item.score === 'number')
        .filter(item => item.score >= TYPESAFE_CONFIG.MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, options.maxTags))
        .map(item => ({
          name: item.name,
          // 候选全部来自已有标签库，因此必然不是新标签
          isNew: false,
          confidence: Math.round(item.score * 100) / 100,
        }));

      if (suggestedTags.length === 0) {
        // 这里必须留下可诊断信息：生产构建下 logger 是静默的，
        // 直接 console 输出才能让用户在扩展的 Service Worker 控制台里看到原因。
        const answerKeys = Object.keys(response.answers || {});
        const top = scored
          .filter((item): item is { name: string; score: number } => typeof item.score === 'number')
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(item => `${item.name}=${item.score.toFixed(3)}`);

        console.warn(
          '[TypeSafe] 未选出任何标签',
          {
            候选数: candidates.length,
            返回答案数: answerKeys.length,
            最高分: top,
            阈值: TYPESAFE_CONFIG.MIN_SCORE,
          },
          answerKeys.length === 0
            ? '→ answers 为空或问题 id 不匹配，请检查 API 响应结构'
            : '→ 所有候选得分都低于阈值，说明该标签库与当前页面确实不相关'
        );
      }

      // jev 只做分拣，不做翻译：这里**不返回** translatedTitle /
      // translatedDescription，调用方将直接使用页面抓取到的标题与描述原文。
      return { suggestedTags };
    } catch (error) {
      throw this.handleError(error, 'TypeSafe');
    }
  }
}
