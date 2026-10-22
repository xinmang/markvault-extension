/**
 * 文本处理工具
 */

import { normalizePageText } from './page-description';

/**
 * 判断文本中是否包含中日韩（CJK）表意文字。
 *
 * 用于校验 AI 返回的“中文翻译”字段是否真的包含中文：
 * 插件要求 translatedTitle / translatedDescription 必须输出简体中文，
 * 若模型只把英文原文原样回填，则说明该字段不可用，应当丢弃而不是展示英文。
 */
export function hasCjkText(text: string | undefined | null): boolean {
  if (!text) return false;
  // CJK 统一表意文字（含扩展 A）、CJK 标点、全角字符
  return /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(text);
}

/**
 * 纯占位短语：模型没有真正翻译时的常见输出（如『暂无标题』），
 * 这类值含中文但没有任何信息，不能覆盖用户当前的有效内容。
 * 只做整串匹配，避免误伤含这些词的真实标题。
 */
const TRANSLATION_PLACEHOLDER_PATTERN =
  /^(?:暂无|没有|无|未提供|未填写|未知|空)(?:标题|内容|描述|翻译|简介|信息)?$|^not (?:available|translated|provided)$|^no (?:title|description|content)$/i;

/**
 * 归一化 AI 返回的翻译字段：
 * - 非字符串 / 空白 → undefined
 * - 不含中文（例如原样返回英文）→ undefined，避免把英文当作“中文描述”使用
 * - 纯占位短语（如『暂无标题』）→ undefined，避免覆盖已有有效内容
 * - 原文已是中文时，模型通常会原样返回，这里同样保留
 */
export function normalizeTranslatedText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = normalizePageText(value);
  if (!trimmed) return undefined;

  // 允许中英混排（如“GitHub 代码托管平台”），但必须至少包含中文字符
  if (!hasCjkText(trimmed)) return undefined;

  if (TRANSLATION_PLACEHOLDER_PATTERN.test(trimmed)) return undefined;

  return trimmed;
}
