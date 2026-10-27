/**
 * 网站截图内容提取入口：按站点分发到 X / Discourse / 通用提取器。
 */

import type { ScreenshotContent } from '@/types/screenshot';
import { extractXStatus, isXHost } from './x';
import { extractDiscourseTopic, isDiscourseDocument } from './discourse';
import { extractGenericPage } from './generic';

export { extractXStatus, isXHost, parseXStatusId, upgradeXImageUrl, upgradeXAvatarUrl } from './x';
export {
  extractDiscourseTopic,
  isDiscourseDocument,
  parseDiscoursePostNumber,
  upgradeDiscourseAvatarUrl,
  SPOILER_PLACEHOLDER,
} from './discourse';
export { extractGenericPage, pickGenericRoot, isExcludedElement } from './generic';

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 提取当前页面的截图内容。
 * 返回 null 表示没有找到有意义的内容（调用方应回 NO_CONTENT）。
 */
export function extractScreenshotContent(doc: Document, url: string): ScreenshotContent | null {
  if (!doc || !url) return null;

  const hostname = safeHostname(url);

  try {
    if (isXHost(hostname)) {
      return extractXStatus(doc, url);
    }
    if (isDiscourseDocument(doc, hostname)) {
      return extractDiscourseTopic(doc, url);
    }
    return extractGenericPage(doc, url);
  } catch {
    return null;
  }
}
