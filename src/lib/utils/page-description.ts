import type { PageInfo } from '@/types';

/** 清理空白和无效占位文本，避免把空 meta 当作有效描述。 */
export function normalizePageText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  return /^(?:null|undefined|none|n\/a|无|暂无(?:描述|简介)?|无(?:描述|简介))$/i.test(text) ? '' : text;
}

/** 只使用当前页面的正文、标题和网址兜底，不推测网站用途。 */
export function getFallbackDescription(page: Pick<PageInfo, 'title' | 'url' | 'content'>): string {
  const content = normalizePageText(page.content);
  const title = normalizePageText(page.title);
  const text = content || (title.toLowerCase() !== 'untitled' ? title : '');
  if (text) return text.length > 300 ? `${text.slice(0, 300)}…` : text;

  try {
    return new URL(page.url).hostname || page.url;
  } catch {
    return page.url;
  }
}

/** 页面身份包含查询参数和片段，兼容使用 hash 路由的网站。 */
export function isSamePageUrl(first: string, second: string): boolean {
  try {
    return new URL(first).href === new URL(second).href;
  } catch {
    return false;
  }
}
