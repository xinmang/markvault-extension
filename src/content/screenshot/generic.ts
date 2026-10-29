/**
 * 通用网页正文提取（`article` / `main` 等语义容器）。
 *
 * 适用于博客、新闻等站点：只走正文，评论、侧边栏、导航一律不进入卡片。
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
} from './inline';

const EXCLUDED_TAGS = new Set([
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  'iframe',
  'script',
  'style',
  'noscript',
]);

const EXCLUDED_ATTR =
  /comment|reply|replies|discuss|related|recommend|share|sidebar|footer|cookie|banner|subscribe|advert|promo/i;
/** `ad-slot` / `my-ad-banner` 之类的广告块；不匹配 download-button 这类普通单词 */
const AD_BLOCK_ATTR = /(?:^|[\s_-])ad(?:[-_]|$)/i;

function matchesExcludedAttribute(value: string): boolean {
  if (!value) return false;
  return EXCLUDED_ATTR.test(value) || AD_BLOCK_ATTR.test(value);
}

export function isExcludedElement(el: Element): boolean {
  if (EXCLUDED_TAGS.has(el.tagName.toLowerCase())) return true;
  if (matchesExcludedAttribute(el.getAttribute('id') || '')) return true;
  const className = el.getAttribute('class') || '';
  if (!className) return false;
  for (const token of className.split(/\s+/)) {
    if (token && matchesExcludedAttribute(token)) return true;
  }
  return false;
}

function textLengthOf(el: Element): number {
  let total = 0;
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      total += (node.nodeValue || '').trim().length;
      return;
    }
    if (node.nodeType !== 1) return;
    const child = node as Element;
    if (child !== el && isExcludedElement(child)) return;
    for (let i = 0; i < child.childNodes.length; i += 1) walk(child.childNodes[i]);
  };
  walk(el);
  return total;
}

export function pickGenericRoot(doc: Document): Element {
  const articles = Array.from(doc.querySelectorAll('article')).filter((article) => !isExcludedElement(article));
  if (articles.length > 0) {
    let best = articles[0];
    let bestLength = textLengthOf(best);
    for (const article of articles.slice(1)) {
      const length = textLengthOf(article);
      if (length > bestLength) {
        best = article;
        bestLength = length;
      }
    }
    // 纯图片文章也算有效内容
    if (bestLength > 0 || best.querySelector('img')) return best;
  }

  const candidates = ['main', '[role="main"]', '#content', '.post', '.entry-content'];
  for (const selector of candidates) {
    const found = doc.querySelector(selector);
    if (found) return found;
  }
  return doc.body;
}

function codeText(el: Element): string {
  return (el.textContent || '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function collectImages(el: Element, baseURI: string): ScreenshotBlock[] {
  const blocks: ScreenshotBlock[] = [];
  const imgs = Array.from(el.querySelectorAll('img'));
  for (const img of imgs) {
    if (isExcludedElement(img)) continue;
    const src = imageUrlFrom(img, baseURI);
    if (!src) continue;
    const width = Number.parseInt(img.getAttribute('width') || '', 10);
    const height = Number.parseInt(img.getAttribute('height') || '', 10);
    const block: ScreenshotBlock = { type: 'image', src };
    if (Number.isFinite(width) && width > 0) block.width = width;
    if (Number.isFinite(height) && height > 0) block.height = height;
    const alt = collapseWhitespace(img.getAttribute('alt') || '');
    if (alt) block.alt = alt;
    blocks.push(block);
  }
  return blocks;
}

function inlineOptions(baseURI: string) {
  return {
    baseURI,
    emojiImages: 'skip' as const,
    skip: (el: Element) => isExcludedElement(el),
  };
}

function blockFromElement(el: Element, baseURI: string): ScreenshotBlock[] {
  const tag = el.tagName.toLowerCase();

  if (isExcludedElement(el)) return [];

  if (tag === 'p') {
    const out: ScreenshotBlock[] = [];
    const inlines = inlinesFromNode(el, inlineOptions(baseURI));
    if (inlineTextLength(inlines) > 0) out.push({ type: 'paragraph', inlines });
    out.push(...collectImages(el, baseURI));
    return out;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    const text = elementText(el);
    if (!text) return [];
    return [{ type: 'heading', level: tag === 'h1' || tag === 'h2' ? 2 : 3, text }];
  }

  if (tag === 'blockquote') {
    const inlines = inlinesFromNode(el, inlineOptions(baseURI));
    if (inlineTextLength(inlines) === 0) return [];
    return [{ type: 'quote', inlines }];
  }

  if (tag === 'pre') {
    const text = codeText(el);
    return text ? [{ type: 'code', text }] : [];
  }

  if (tag === 'ul' || tag === 'ol') {
    const items: ScreenshotInline[][] = [];
    const lis = Array.from(el.children).filter((child) => child.tagName.toLowerCase() === 'li');
    for (const li of lis) {
      const inlines = inlinesFromNode(li, {
        ...inlineOptions(baseURI),
        skip: (child) =>
          isExcludedElement(child) ||
          child.tagName.toLowerCase() === 'ul' ||
          child.tagName.toLowerCase() === 'ol',
      });
      if (inlineTextLength(inlines) > 0) items.push(inlines);
    }
    if (items.length === 0) return [];
    return [{ type: 'list', ordered: tag === 'ol', items }];
  }

  if (tag === 'figure') {
    return collectImages(el, baseURI);
  }

  if (tag === 'img') {
    if (isExcludedElement(el)) return [];
    const src = imageUrlFrom(el, baseURI);
    return src ? [{ type: 'image', src }] : [];
  }

  return [];
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'figure',
  'img',
]);

/** 按文档顺序遍历块级元素，命中一个块后不再深入它的子树 */
function walkBlocks(root: Element, baseURI: string, limit: number): ScreenshotBlock[] {
  const blocks: ScreenshotBlock[] = [];

  const visit = (el: Element): void => {
    if (blocks.length >= limit) return;
    if (el !== root && isExcludedElement(el)) return;

    const tag = el.tagName.toLowerCase();
    if (el !== root && BLOCK_TAGS.has(tag)) {
      blocks.push(...blockFromElement(el, baseURI));
      return;
    }

    for (let i = 0; i < el.children.length; i += 1) {
      if (blocks.length >= limit) return;
      visit(el.children[i]);
    }
  };

  visit(root);
  return blocks.slice(0, limit);
}

function metaContent(doc: Document, selector: string): string {
  const el = doc.querySelector(selector);
  return collapseWhitespace(el?.getAttribute('content') || '');
}

/**
 * 卡片顶部已显示标题，正文里与之相同的文章大标题（通常是 h1）只保留一处。
 * 也匹配“标题 - 站点名”这类带后缀的页面标题。
 */
export function dropTitleHeading(blocks: ScreenshotBlock[], title: string | undefined): ScreenshotBlock[] {
  if (!title || blocks.length <= 1) return blocks;
  const index = blocks.findIndex((block) => block.type === 'heading');
  if (index < 0) return blocks;
  const heading = (blocks[index] as Extract<ScreenshotBlock, { type: 'heading' }>).text;
  const rest = title.startsWith(heading) ? title.slice(heading.length) : null;
  if (rest === null || (rest !== '' && !/^\s*[-|–—_·:：]/.test(rest))) return blocks;
  return [...blocks.slice(0, index), ...blocks.slice(index + 1)];
}

function authorName(doc: Document): string {
  const fromMeta = metaContent(doc, 'meta[name="author"]');
  if (fromMeta) return fromMeta;
  const relAuthor = doc.querySelector('[rel="author"]');
  if (relAuthor) {
    const text = elementText(relAuthor);
    if (text) return text;
  }
  const itemprop = doc.querySelector('[itemprop="author"]');
  if (itemprop) {
    const name = itemprop.querySelector('[itemprop="name"]');
    const text = elementText(name) || elementText(itemprop);
    if (text) return text;
  }
  return '';
}

export function extractGenericPage(doc: Document, url: string): ScreenshotContent | null {
  const baseURI = resolveBaseUri(doc, url);
  const root = pickGenericRoot(doc);
  if (!root) return null;

  const blocks = walkBlocks(root, baseURI, 60);

  const totalText = blocks.reduce((total, block) => {
    if (block.type === 'paragraph' || block.type === 'quote') return total + inlineTextLength(block.inlines);
    if (block.type === 'heading') return total + block.text.length;
    if (block.type === 'code') return total + block.text.length;
    if (block.type === 'list') {
      return total + block.items.reduce((sum, item) => sum + inlineTextLength(item), 0);
    }
    return total;
  }, 0);
  const hasImages = blocks.some((block) => block.type === 'image');
  if (totalText < 30 && !hasImages) return null;

  const title =
    metaContent(doc, 'meta[property="og:title"]') ||
    elementText(doc.querySelector('h1')) ||
    collapseWhitespace(doc.title) ||
    undefined;

  const timeMeta = doc.querySelector('meta[property="article:published_time"]');
  let publishedAt = timeMeta?.getAttribute('content')?.trim() || '';
  if (!publishedAt) {
    const time = root.querySelector('time[datetime]') || doc.querySelector('time[datetime]');
    publishedAt = time?.getAttribute('datetime')?.trim() || '';
  }

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = '';
  }

  const siteName = metaContent(doc, 'meta[property="og:site_name"]') || hostname || undefined;

  const faviconHref =
    doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    '/favicon.ico';
  let faviconUrl: string | undefined;
  try {
    const resolved = new URL(faviconHref, baseURI);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') faviconUrl = resolved.href;
  } catch {
    faviconUrl = undefined;
  }

  const name = authorName(doc);

  return {
    site: 'generic',
    siteName: siteName || '',
    url,
    title,
    author: name ? { name } : undefined,
    publishedAt: publishedAt || undefined,
    faviconUrl,
    blocks: dedupeImageBlocks(dropTitleHeading(blocks, title)),
  };
}
