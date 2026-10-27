/**
 * X（twitter.com / x.com）状态页提取。
 *
 * 只取“焦点推文”：URL 里 /status/{id} 对应的那条；其余 article 都是回复，直接忽略。
 */

import type {
  ScreenshotBlock,
  ScreenshotContent,
  ScreenshotInline,
} from '@/types/screenshot';
import {
  collapseWhitespace,
  createImageCollector,
  dedupeImageBlocks,
  imageUrlFrom,
  inlinesFromNode,
  resolveBaseUri,
  resolveHttpUrl,
  textFromInlines,
} from './inline';

export const X_HOSTNAMES = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);

export function isXHost(hostname: string): boolean {
  return X_HOSTNAMES.has(hostname.toLowerCase());
}

/** 从 /{user}/status/{id} 里取出推文 id（忽略 /photo/1 之类的后缀） */
export function parseXStatusId(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** pbs.twimg.com 的图片升级为 name=large，其余查询参数保留 */
export function upgradeXImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)pbs\.twimg\.com$/i.test(parsed.hostname)) return url;
    if (!/\/media\//i.test(parsed.pathname)) return url;
    parsed.searchParams.set('name', 'large');
    return parsed.toString();
  } catch {
    return url;
  }
}

/** profile_images 头像从 _normal 升级到 _400x400 */
export function upgradeXAvatarUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)pbs\.twimg\.com$/i.test(parsed.hostname)) return url;
    return parsed.toString().replace(/_normal(\.[a-z0-9]+)(\?|$)/i, '_400x400$1$2');
  } catch {
    return url;
  }
}

/**
 * 找出嵌套引用推文的容器：包含 tweetText 的 div[role="link"]。
 * 只认“不含焦点推文正文”的那一个，避免把整条推文误判为引用。
 */
function findNestedQuote(article: Element): Element | null {
  const candidates = Array.from(article.querySelectorAll('div[role="link"]'));
  for (const candidate of candidates) {
    if (candidate.querySelector('[data-testid="tweetText"]')) return candidate;
  }
  return null;
}

/** 焦点推文自己的 tweetText：不在嵌套引用容器里的第一个 */
function tweetTextElement(article: Element, nestedQuote: Element | null): Element | null {
  const candidates = Array.from(article.querySelectorAll('[data-testid="tweetText"]'));
  if (candidates.length === 0) return null;

  if (nestedQuote) {
    const outside = candidates.find((candidate) => !nestedQuote.contains(candidate));
    if (outside) return outside;
    // 整条推文都被 role=link 包住时，第一个仍然算正文
    return candidates[0];
  }
  return candidates[0];
}

/** 元素是否属于嵌套引用推文 */
function inNestedQuote(el: Element, nestedQuote: Element | null): boolean {
  return Boolean(nestedQuote && nestedQuote.contains(el));
}

function extractAuthor(article: Element, baseURI: string): ScreenshotContent['author'] {
  const userName = article.querySelector('[data-testid="User-Name"]');
  let name = '';
  let handle: string | undefined;

  if (userName) {
    const handleEl = Array.from(userName.querySelectorAll('a, span')).find((el) => {
      const text = collapseWhitespace(el.textContent || '');
      return /^@[A-Za-z0-9_]+$/.test(text);
    });
    if (handleEl) handle = collapseWhitespace(handleEl.textContent || '');

    // 名字是第一个非 @handle / 非时间 的短文本
    const textNodes = Array.from(userName.querySelectorAll('span'));
    for (const node of textNodes) {
      if (handleEl && (node === handleEl || handleEl.contains(node))) continue;
      if (node.closest('time')) continue;
      if (node.querySelector('span, a')) continue; // 只看叶子节点
      const text = collapseWhitespace(node.textContent || '');
      if (!text || text.startsWith('@')) continue;
      if (/^[·•|\-–—]+$/.test(text)) continue;
      if (text.length > 80) continue;
      name = text;
      break;
    }

    // 退路：第一个链接里去掉 @handle 与时间后的文本
    if (!name) {
      const firstLink = userName.querySelector('a');
      const linkText = collapseWhitespace(firstLink?.textContent || '');
      const cleaned = linkText.replace(/@[A-Za-z0-9_]+/g, '').trim();
      if (cleaned) name = cleaned;
    }
  }

  const avatar = article.querySelector('img[src*="profile_images"]');
  const avatarUrl = avatar ? resolveHttpUrl(avatar.getAttribute('src'), baseURI) : null;

  if (!name && !handle && !avatarUrl) return undefined;

  return {
    name: name || handle || '',
    handle,
    avatarUrl: avatarUrl ? upgradeXAvatarUrl(avatarUrl) : undefined,
  };
}

function extractQuotedBlocks(
  nested: Element | null,
  primaryText: Element | null,
  baseURI: string
): ScreenshotBlock[] {
  if (!nested) return [];
  // 引用容器包住了正文，说明它不是真正的引用推文
  if (primaryText && nested.contains(primaryText)) return [];

  const textEl = nested.querySelector('[data-testid="tweetText"]');
  if (!textEl) return [];

  const inlines = inlinesFromNode(textEl, {
    baseURI,
    emojiImages: 'text',
    isEmojiImage: (img) => img.tagName.toLowerCase() === 'img',
  });
  if (inlines.length === 0) return [];

  // 引用推文：作者名 + 正文，作为一个 quote block
  const nameEl = nested.querySelector('[data-testid="User-Name"]');
  let authorPrefix = '';
  if (nameEl) {
    const spans = Array.from(nameEl.querySelectorAll('span'));
    for (const span of spans) {
      if (span.querySelector('span, a')) continue;
      const text = collapseWhitespace(span.textContent || '');
      if (!text || text.startsWith('@')) continue;
      authorPrefix = `${text}：`;
      break;
    }
  }

  const quoteInlines: ScreenshotInline[] = [];
  if (authorPrefix) quoteInlines.push({ type: 'text', text: authorPrefix, bold: true });
  quoteInlines.push(...inlines);

  return [{ type: 'quote', inlines: quoteInlines }];
}

export function extractXStatus(doc: Document, url: string): ScreenshotContent | null {
  const statusId = parseXStatusId(url);
  const articles = Array.from(doc.querySelectorAll('article[data-testid="tweet"]'));
  if (articles.length === 0) return null;

  let focal: Element | null = null;
  if (statusId) {
    focal =
      articles.find((article) => {
        const anchors = Array.from(article.querySelectorAll(`a[href*="/status/${statusId}"]`));
        return anchors.some((anchor) => Boolean(anchor.querySelector('time')));
      }) ?? null;
  }
  if (!focal) focal = articles[0] ?? null;
  if (!focal) return null;

  const baseURI = resolveBaseUri(doc, url);
  const blocks: ScreenshotBlock[] = [];

  const article = focal as Element;
  const nestedQuote = findNestedQuote(article);
  const textEl = tweetTextElement(article, nestedQuote);
  if (textEl) {
    const inlines = inlinesFromNode(textEl, {
      baseURI,
      emojiImages: 'text',
      isEmojiImage: (img) => img.tagName.toLowerCase() === 'img',
      skip: (el) => inNestedQuote(el, nestedQuote),
    });
    if (inlines.length > 0) blocks.push({ type: 'paragraph', inlines });
  }

  blocks.push(...extractQuotedBlocks(nestedQuote, textEl, baseURI));

  // 图片：只取焦点推文自己的（嵌套引用里的不算），并对升级后的地址去重
  const images = createImageCollector(baseURI);
  const photoEls = Array.from(
    article.querySelectorAll('[data-testid="tweetPhoto"] img, video[poster]')
  );
  for (const el of photoEls) {
    if (inNestedQuote(el, nestedQuote)) continue;
    let raw: string | null = null;
    if (el.tagName.toLowerCase() === 'video') {
      raw = resolveHttpUrl(el.getAttribute('poster'), baseURI);
    } else {
      raw = imageUrlFrom(el, baseURI);
    }
    if (!raw) continue;
    const src = images.fromUrl(upgradeXImageUrl(raw));
    if (src) blocks.push({ type: 'image', src });
  }

  const visualText = blocks
    .filter(
      (block): block is Extract<ScreenshotBlock, { type: 'paragraph' | 'quote' }> =>
        block.type === 'paragraph' || block.type === 'quote'
    )
    .map((block) => textFromInlines(block.inlines))
    .join('');

  if (!visualText.trim() && !blocks.some((block) => block.type === 'image')) {
    return null;
  }

  const author = extractAuthor(article, baseURI);
  const times = Array.from(article.querySelectorAll('time[datetime]'));
  const time = times.find((candidate) => !inNestedQuote(candidate, nestedQuote)) ?? times[0] ?? null;

  return {
    site: 'x',
    siteName: 'X',
    url,
    author,
    publishedAt: time ? time.getAttribute('datetime') || undefined : undefined,
    faviconUrl: resolveHttpUrl('https://abs.twimg.com/favicons/twitter.3.ico', baseURI) ?? undefined,
    blocks: dedupeImageBlocks(blocks),
  };
}

/** 供测试与调试使用 */
export { collapseWhitespace };
