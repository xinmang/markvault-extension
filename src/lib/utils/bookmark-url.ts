const MAX_BOOKMARK_URL_LENGTH = 2000;

/**
 * 按 MarkVault 的存储约束整理 URL，并统一浏览器认为等价的表示。
 * 路径、查询参数、参数顺序和片段均保留，避免同一站点的不同页面被误判。
 */
export function normalizeBookmarkUrlForMatch(rawUrl: string): string | null {
  const storedValue = rawUrl.trim().slice(0, MAX_BOOKMARK_URL_LENGTH);
  if (!storedValue) {
    return null;
  }

  try {
    const parsed = new URL(storedValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * 获取备用候选查询词。查询只缩小候选范围，最终结果仍由完整 URL 比较决定。
 */
export function getBookmarkUrlCandidateQuery(normalizedUrl: string): string | null {
  try {
    return new URL(normalizedUrl).hostname || null;
  } catch {
    return null;
  }
}
