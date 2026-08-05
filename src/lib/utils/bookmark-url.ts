const MAX_BOOKMARK_URL_LENGTH = 2000;
const LINUX_DO_HOST = 'linux.do';

function isLinuxDoHost(hostname: string): boolean {
  return hostname === LINUX_DO_HOST || hostname === `www.${LINUX_DO_HOST}`;
}

/**
 * 提取 Linux Do（Discourse）主题 ID，忽略可变的主题别名和回复楼层。
 */
function getLinuxDoTopicId(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 't') {
    return null;
  }

  const isNumeric = (value: string | undefined): value is string =>
    typeof value === 'string' && /^\d+$/.test(value);

  // 短链接：/t/<主题ID> 或 /t/<主题ID>/<楼层>
  if (
    isNumeric(segments[1]) &&
    (segments.length === 2 || (segments.length === 3 && isNumeric(segments[2])))
  ) {
    return segments[1];
  }

  // 标准链接：/t/<主题别名>/<主题ID> 或 /t/<主题别名>/<主题ID>/<楼层>
  if (
    segments[1] &&
    isNumeric(segments[2]) &&
    (segments.length === 3 || (segments.length === 4 && isNumeric(segments[3])))
  ) {
    return segments[2];
  }

  return null;
}

/**
 * 按 MarkVault 的存储约束生成页面匹配键。
 * 默认保留路径、查询参数、参数顺序和片段；Linux Do 首页忽略无意义的
 * 查询与片段，帖子则按 Discourse 主题 ID 匹配，不受回复楼层变化影响。
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

    if (isLinuxDoHost(parsed.hostname)) {
      parsed.protocol = 'https:';
      parsed.hostname = LINUX_DO_HOST;
      parsed.port = '';

      const topicId = getLinuxDoTopicId(parsed.pathname);
      if (topicId) {
        return `${parsed.origin}/t/${topicId}`;
      }

      if (parsed.pathname === '/') {
        parsed.search = '';
        parsed.hash = '';
      }
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * 获取备用候选查询词。查询只缩小候选范围，最终结果仍由页面匹配键决定。
 */
export function getBookmarkUrlCandidateQuery(normalizedUrl: string): string | null {
  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.hostname === LINUX_DO_HOST) {
      return getLinuxDoTopicId(parsed.pathname) ?? parsed.hostname;
    }
    return parsed.hostname || null;
  } catch {
    return null;
  }
}
