/**
 * Discourse 论坛（例如 linux.do）主题页提取。
 *
 * 只渲染 URL 指向的那一层楼（默认 1 楼），回复不进入卡片。
 */

import type {
  ScreenshotBlock,
  ScreenshotContent,
  ScreenshotInline,
} from '@/types/screenshot';
import {
  collapseWhitespace,
  dedupeImageBlocks,
  elementText,
  imageUrlFrom,
  inlineTextLength,
  inlinesFromNode,
  resolveBaseUri,
  textFromInlines,
} from './inline';

export const SPOILER_PLACEHOLDER = '（剧透内容已隐藏）';

export function isDiscourseDocument(doc: Document, hostname: string): boolean {
  if (hostname.toLowerCase() === 'linux.do') return true;
  const generator = doc.querySelector('meta[name="generator"]');
  if (generator && (generator.getAttribute('content') || '').startsWith('Discourse')) return true;
  return Boolean(doc.querySelector('#data-discourse-setup'));
}

/** /t/{slug}/{topicId}/{postNumber} → postNumber；没有楼层时返回 null */
export function parseDiscoursePostNumber(url: string): number | null {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/t\/[^/]+\/\d+(?:\/(\d+))?/);
    if (!match) return null;
    if (match[1]) {
      const value = Number.parseInt(match[1], 10);
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    return 1;
  } catch {
    return null;
  }
}

/** 头像 URL 的尺寸路径段升级为 /144/ */
export function upgradeDiscourseAvatarUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/(?:\d{1,4})(\/[^/]+)$/, '/144$1');
    return parsed.toString();
  } catch {
    return url;
  }
}

function isAvatarImage(img: Element): boolean {
  if (img.classList.contains('avatar')) return true;
  const parent = img.closest('.topic-avatar, .user-avatar, .avatar');
  return Boolean(parent);
}

function isNoiseBlock(el: Element): boolean {
  if (el.matches('.poll, .poll-container, .poll-info, .quote-controls, .post-actions')) {
    return true;
  }
  return false;
}

function codeText(el: Element): string {
  return (el.textContent || '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

/** 流内需要跳过的子树（评论、投票、图片 caption 等） */
function skipInFlow(el: Element): boolean {
  if (isNoiseBlock(el)) return true;
  if (el.matches('.lightbox-wrapper .meta')) return true;
  // 链接预览另行处理，不在段落里重复输出
  if (el.matches('aside.onebox, .onebox')) return true;
  return false;
}

/** 流内需要替换成一段固定文本的子树（剧透） */
function replaceInFlow(el: Element): string | null {
  if (el.classList.contains('spoiler')) return SPOILER_PLACEHOLDER;
  // <details> 只保留 summary 文本
  if (el.tagName.toLowerCase() === 'details') {
    return elementText(el.querySelector('summary'));
  }
  return null;
}

function walkFlowInlines(
  node: Node,
  baseURI: string
): ScreenshotInline[] {
  return inlinesFromNode(node, {
    baseURI,
    emojiImages: 'inline',
    isEmojiImage: (img) => img.classList.contains('emoji'),
    skip: skipInFlow,
    replace: replaceInFlow,
  });
}

/** 取出子树里的普通图片（跳过 emoji 与头像），按文档顺序 */
function imagesIn(el: Element, baseURI: string): ScreenshotBlock[] {
  const blocks: ScreenshotBlock[] = [];
  const imgs = Array.from(el.querySelectorAll('img'));
  for (const img of imgs) {
    if (img.classList.contains('emoji')) continue;
    if (isAvatarImage(img)) continue;
    if (img.closest('.onebox, .poll')) continue;
    const src = imageUrlFrom(img, baseURI);
    if (!src) continue;
    blocks.push({ type: 'image', src, alt: collapseWhitespace(img.getAttribute('alt') || '') || undefined });
  }
  return blocks;
}

function paragraphBlock(el: Element, baseURI: string): ScreenshotBlock | null {
  const inlines = walkFlowInlines(el, baseURI);
  if (inlines.length === 0) return null;
  return { type: 'paragraph', inlines };
}

function listBlock(el: Element, baseURI: string): ScreenshotBlock | null {
  const items: ScreenshotInline[][] = [];
  const lis = Array.from(el.children).filter((child) => child.tagName.toLowerCase() === 'li');
  for (const li of lis) {
    const inlines = inlinesFromNode(li, {
      baseURI,
      emojiImages: 'inline',
      isEmojiImage: (img) => img.classList.contains('emoji'),
      skip: (child) => {
        if (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol') return true;
        return skipInFlow(child);
      },
      replace: replaceInFlow,
    });
    if (inlineTextLength(inlines) > 0) items.push(inlines);
  }
  if (items.length === 0) return null;
  return { type: 'list', ordered: el.tagName.toLowerCase() === 'ol', items };
}

function quoteInlines(el: Element, baseURI: string): ScreenshotInline[] {
  const pieces: ScreenshotInline[] = [];
  // 只取段落级的行内内容；不要再取 blockquote 自身，否则会重复
  const children = Array.from(el.querySelectorAll('p, li, h1, h2, h3, h4')).filter(
    (child) => !child.parentElement?.closest('.quote-title, .quote-controls')
  );
  if (children.length === 0) {
    const direct = walkFlowInlines(el, baseURI);
    return direct;
  }
  for (const child of children) {
    const inlines = walkFlowInlines(child, baseURI);
    if (inlines.length === 0) continue;
    if (pieces.length > 0) pieces.push({ type: 'break' });
    pieces.push(...inlines);
  }
  return pieces;
}

function oneboxBlock(el: Element): ScreenshotBlock | null {
  const candidates = Array.from(el.querySelectorAll('h3 a, h4 a, .onebox-body a, a'));
  let title = '';
  for (const anchor of candidates) {
    const text = collapseWhitespace(anchor.textContent || '');
    if (text) {
      title = text;
      break;
    }
  }
  if (!title) {
    const heading = el.querySelector('h3, h4');
    title = elementText(heading);
  }
  if (!title) return null;
  return {
    type: 'paragraph',
    inlines: [{ type: 'text', text: title, link: true }],
  };
}

function detailsSummary(el: Element): string {
  const summary = el.querySelector('summary');
  return elementText(summary);
}

function blockFromElement(el: Element, baseURI: string): ScreenshotBlock[] {
  const tag = el.tagName.toLowerCase();

  if (isNoiseBlock(el)) return [];

  if (tag === 'p') {
    const out: ScreenshotBlock[] = [];
    const images = imagesIn(el, baseURI);
    const paragraph = paragraphBlock(el, baseURI);
    if (paragraph) out.push(paragraph);
    out.push(...images);
    return out;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const text = elementText(el);
    if (!text) return [];
    return [{ type: 'heading', level: tag === 'h3' ? 3 : 2, text }];
  }

  if (tag === 'blockquote' || (tag === 'aside' && el.classList.contains('quote'))) {
    const inlines = quoteInlines(el, baseURI);
    if (inlines.length === 0) return [];
    return [{ type: 'quote', inlines }];
  }

  if (tag === 'pre' || tag === 'code') {
    const text = codeText(el);
    return text ? [{ type: 'code', text }] : [];
  }

  if (tag === 'ul' || tag === 'ol') {
    const block = listBlock(el, baseURI);
    return block ? [block] : [];
  }

  if (tag === 'figure') {
    return imagesIn(el, baseURI);
  }

  if (tag === 'img') {
    if (el.classList.contains('emoji') || isAvatarImage(el)) return [];
    const src = imageUrlFrom(el, baseURI);
    return src ? [{ type: 'image', src }] : [];
  }

  if (tag === 'aside' && el.classList.contains('onebox')) {
    const block = oneboxBlock(el);
    return block ? [block] : [];
  }

  if (tag === 'details') {
    const text = detailsSummary(el);
    return text ? [{ type: 'paragraph', inlines: [{ type: 'text', text }] }] : [];
  }

  if (el.classList.contains('lightbox-wrapper')) {
    const out: ScreenshotBlock[] = [];
    const img = el.querySelector('img');
    if (img) {
      const src = imageUrlFrom(img, baseURI);
      if (src) {
        out.push({
          type: 'image',
          src,
          alt: collapseWhitespace(img.getAttribute('alt') || '') || undefined,
        });
      }
    }
    return out;
  }

  if (el.classList.contains('spoiler')) {
    return [
      {
        type: 'paragraph',
        inlines: [{ type: 'text', text: SPOILER_PLACEHOLDER }],
      },
    ];
  }

  if (tag === 'div' || tag === 'section' || el.classList.contains('cooked')) {
    const out: ScreenshotBlock[] = [];
    for (const child of Array.from(el.children)) {
      out.push(...blockFromElement(child, baseURI));
    }
    return out;
  }

  return [];
}

export function blocksFromDiscoursePost(cooked: Element, baseURI: string): ScreenshotBlock[] {
  const blocks: ScreenshotBlock[] = [];
  for (const child of Array.from(cooked.children)) {
    blocks.push(...blockFromElement(child, baseURI));
  }
  return blocks.filter((block) => {
    if (block.type === 'paragraph') return inlineTextLength(block.inlines) > 0;
    if (block.type === 'quote') return inlineTextLength(block.inlines) > 0;
    if (block.type === 'list') return block.items.length > 0;
    return true;
  });
}

function findPost(doc: Document, postNumber: number): Element | null {
  const selectors = [`#post_${postNumber}`, `article#post_${postNumber}`, `[data-post-number="${postNumber}"]`];
  for (const selector of selectors) {
    const found = doc.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function postTime(post: Element): string | undefined {
  const dated = post.querySelector('.post-date [data-time], .relative-date[data-time]');
  const raw = dated?.getAttribute('data-time');
  if (!raw) {
    const time = post.querySelector('time[datetime]');
    return time?.getAttribute('datetime') || undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  const ms = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(ms).toISOString();
}

function postAuthor(post: Element, doc: Document, baseURI: string): ScreenshotContent['author'] {
  const names = post.querySelector('.names');
  const fullName = elementText(names?.querySelector('.full-name'));
  const username = elementText(names?.querySelector('.username'));
  const avatar = post.querySelector('.topic-avatar img.avatar') ?? doc.querySelector('.topic-avatar img.avatar');
  const avatarUrl = avatar ? imageUrlFrom(avatar, baseURI, { minSize: 0 }) : null;

  if (!fullName && !username && !avatarUrl) return undefined;
  return {
    name: fullName || username || '',
    handle: username || undefined,
    avatarUrl: avatarUrl ? upgradeDiscourseAvatarUrl(avatarUrl) : undefined,
  };
}

export function extractDiscourseTopic(doc: Document, url: string): ScreenshotContent | null {
  const postNumber = parseDiscoursePostNumber(url) ?? 1;
  const post = findPost(doc, postNumber);
  if (!post) return null;

  const cooked = post.querySelector('.cooked');
  if (!cooked && !post.classList.contains('cooked')) return null;

  const baseURI = resolveBaseUri(doc, url);
  const body = cooked ?? post;
  const blocks = blocksFromDiscoursePost(body, baseURI);

  const title =
    elementText(doc.querySelector('#topic-title .fancy-title')) ||
    elementText(doc.querySelector('h1 .fancy-title')) ||
    collapseWhitespace(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '') ||
    undefined;

  const host = new URL(url).hostname;
  const siteNameRaw = collapseWhitespace(
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  );
  const siteName = host.toLowerCase() === 'linux.do' ? 'LINUX DO' : siteNameRaw || host;

  const faviconHref =
    doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    '/favicon.ico';
  let faviconUrl: string | undefined;
  try {
    faviconUrl = new URL(faviconHref, baseURI).href;
  } catch {
    faviconUrl = undefined;
  }

  const textLength = blocks.reduce((total, block) => {
    if (block.type === 'paragraph' || block.type === 'quote') return total + inlineTextLength(block.inlines);
    if (block.type === 'heading') return total + block.text.length;
    if (block.type === 'code') return total + block.text.length;
    if (block.type === 'list') {
      return total + block.items.reduce((sum, item) => sum + inlineTextLength(item), 0);
    }
    return total;
  }, 0);

  const hasImages = blocks.some((block) => block.type === 'image');
  if (textLength === 0 && !hasImages) return null;

  return {
    site: 'discourse',
    siteName,
    url,
    title,
    author: postAuthor(post, doc, baseURI),
    publishedAt: postTime(post),
    faviconUrl,
    blocks: dedupeImageBlocks(blocks),
  };
}

/** 供测试使用：引用块纯文本 */
export function quoteText(block: Extract<ScreenshotBlock, { type: 'quote' }>): string {
  return textFromInlines(block.inlines);
}
