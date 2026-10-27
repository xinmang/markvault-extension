/**
 * 把 DOM 子树转换成纯数据的行内片段。
 *
 * 这里只读取文本与属性，不会把网页原有 HTML 带到渲染端；
 * 所有 URL 都会解析成绝对地址，并丢弃非 http(s) 的图片。
 */

import type { ScreenshotBlock, ScreenshotInline } from '@/types/screenshot';

/** 会把连续空白压成一个空格（保留换行由 <br> 显式表达） */
export function normalizeTextFragment(text: string): string {
  return text.replace(/[\s\u00a0]+/g, ' ');
}

/** 压缩空白并去掉首尾空格 */
export function collapseWhitespace(text: string): string {
  return normalizeTextFragment(text).trim();
}

/** 元素的可读文本（已压缩空白） */
export function elementText(el: Element | null | undefined): string {
  if (!el) return '';
  return collapseWhitespace(el.textContent || '');
}

/**
 * 选择解析相对地址用的 baseURI。
 * 离屏构造的 document（about:blank）或异常页面回退到页面 URL。
 */
export function resolveBaseUri(doc: Document, url: string): string {
  const base = doc.baseURI;
  if (base && /^https?:/i.test(base)) return base;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    // 忽略
  }
  return base || url;
}

/** 解析为 http(s) 绝对地址，其他协议返回 null */
export function resolveHttpUrl(src: string | null | undefined, baseURI: string): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, baseURI);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** 追踪像素、spacer、SVG 图标等没有信息量的图片 */
const NOISE_IMAGE_PATTERN =
  /(?:^|[/_.-])(?:pixel|tracking|spacer|transparent|blank|1x1|clear\.gif)(?:[/_.?&-]|$)|\.svg(?:[?#]|$)/i;

export function isNoiseImageUrl(url: string): boolean {
  return NOISE_IMAGE_PATTERN.test(url);
}

/** 读取 HTML 属性里的尺寸；没有属性时返回 null（不使用布局信息） */
export function readDimension(img: Element, name: 'width' | 'height'): number | null {
  const raw = img.getAttribute(name);
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export interface ImageSourceOptions {
  /** 已知属性尺寸小于该值就视为图标，默认 48 */
  minSize?: number;
  width?: number | null;
  height?: number | null;
}

/** 把 <img> 转成可用的绝对图片地址；不合规时返回 null */
export function imageUrlFrom(
  img: Element,
  baseURI: string,
  options: ImageSourceOptions = {}
): string | null {
  const url = resolveHttpUrl(img.getAttribute('src'), baseURI);
  if (!url || isNoiseImageUrl(url)) return null;

  const minSize = options.minSize ?? 48;
  if (minSize > 0) {
    const width = options.width === undefined ? readDimension(img, 'width') : options.width;
    const height = options.height === undefined ? readDimension(img, 'height') : options.height;
    if (width !== null && width < minSize) return null;
    if (height !== null && height < minSize) return null;
  }

  return url;
}

/** 去重的图片收集器，避免同一张图重复渲染 */
export function createImageCollector(baseURI: string) {
  const seen = new Set<string>();

  return {
    /** 收集 <img>（含尺寸/tracking 过滤） */
    fromElement(img: Element, options?: ImageSourceOptions): string | null {
      const url = imageUrlFrom(img, baseURI, options);
      if (!url || seen.has(url)) return null;
      seen.add(url);
      return url;
    },
    /** 收集一个已知地址（例如视频封面） */
    fromUrl(raw: string | null | undefined): string | null {
      const url = resolveHttpUrl(raw, baseURI);
      if (!url || isNoiseImageUrl(url) || seen.has(url)) return null;
      seen.add(url);
      return url;
    },
    has(url: string): boolean {
      return seen.has(url);
    },
  };
}

interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: boolean;
}

export interface InlineWalkOptions {
  baseURI: string;
  /**
   * 行内表情图片的处理方式：
   * - text：取其 alt 文本（X 的 emoji）
   * - inline：保留为 emoji 片段（Discourse）
   * - skip：忽略
   */
  emojiImages?: 'text' | 'inline' | 'skip';
  /** 判断某个 <img> 是否真的是表情 */
  isEmojiImage?: (img: Element) => boolean;
  /** 整棵子树跳过 */
  skip?: (el: Element) => boolean;
  /** 子树替换成一段文本（例如剧透内容） */
  replace?: (el: Element) => string | null;
  /** 是否保留加粗/斜体/代码/链接语义，默认 true */
  formatting?: boolean;
}

interface TextInline {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: boolean;
}

function pushText(out: ScreenshotInline[], raw: string, style: InlineStyle): void {
  if (!raw) return;
  const text = normalizeTextFragment(raw);
  if (!text) return;

  const prev = out[out.length - 1];
  if (
    prev &&
    prev.type === 'text' &&
    !!prev.bold === !!style.bold &&
    !!prev.italic === !!style.italic &&
    !!prev.code === !!style.code &&
    !!prev.link === !!style.link
  ) {
    prev.text += text;
    return;
  }

  const inline: TextInline = { type: 'text', text };
  if (style.bold) inline.bold = true;
  if (style.italic) inline.italic = true;
  if (style.code) inline.code = true;
  if (style.link) inline.link = true;
  out.push(inline);
}

function walkInline(
  node: Node,
  style: InlineStyle,
  options: InlineWalkOptions,
  out: ScreenshotInline[]
): void {
  // 文本节点
  if (node.nodeType === 3) {
    const text = node.nodeValue || '';
    if (text) pushText(out, text, style);
    return;
  }
  if (node.nodeType !== 1) return;

  const el = node as Element;

  if (options.skip?.(el)) return;

  const replacement = options.replace?.(el);
  if (replacement !== null && replacement !== undefined) {
    pushText(out, replacement, style);
    return;
  }

  const tag = el.tagName.toLowerCase();
  if (
    tag === 'script' ||
    tag === 'style' ||
    tag === 'noscript' ||
    tag === 'template' ||
    tag === 'iframe' ||
    tag === 'svg'
  ) {
    return;
  }

  if (tag === 'br') {
    out.push({ type: 'break' });
    return;
  }

  if (tag === 'img') {
    const mode = options.emojiImages ?? 'inline';
    if (mode === 'skip') return;
    if (options.isEmojiImage && !options.isEmojiImage(el)) return;

    const alt = collapseWhitespace(el.getAttribute('alt') || '');

    if (mode === 'text') {
      if (alt) pushText(out, alt, style);
      return;
    }

    const src = imageUrlFrom(el, options.baseURI, { minSize: 0 });
    if (src) {
      out.push({ type: 'emoji', src, alt });
    } else if (alt) {
      pushText(out, alt, style);
    }
    return;
  }

  const next: InlineStyle = { ...style };
  if (options.formatting !== false) {
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italic = true;
    if (tag === 'code' || tag === 'kbd' || tag === 'samp' || tag === 'tt') next.code = true;
    if (tag === 'a') next.link = true;
  }

  const children = el.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    walkInline(children[i], next, options, out);
  }
}

/** 清理片段：合并相邻文本、去掉空片段与多余换行、修剪首尾空白 */
export function cleanupInlines(input: ScreenshotInline[]): ScreenshotInline[] {
  const out: ScreenshotInline[] = [];

  for (const inline of input) {
    if (inline.type === 'text') {
      const text = normalizeTextFragment(inline.text);
      if (!text) continue;

      const prev = out[out.length - 1];
      if (
        prev &&
        prev.type === 'text' &&
        !!prev.bold === !!inline.bold &&
        !!prev.italic === !!inline.italic &&
        !!prev.code === !!inline.code &&
        !!prev.link === !!inline.link
      ) {
        prev.text += text;
        continue;
      }
      out.push({ ...inline, text });
    } else if (inline.type === 'break') {
      const prev = out[out.length - 1];
      if (!prev || prev.type === 'break') continue;
      out.push({ type: 'break' });
    } else {
      out.push(inline);
    }
  }

  while (out.length > 0 && out[out.length - 1].type === 'break') out.pop();
  while (out.length > 0 && out[0].type === 'break') out.shift();

  const first = out[0];
  if (first && first.type === 'text') first.text = first.text.replace(/^\s+/, '');
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text = last.text.replace(/\s+$/, '');

  return out.filter((inline) => inline.type !== 'text' || inline.text.length > 0);
}

/** 把子树转成行内片段 */
export function inlinesFromNode(node: Node, options: InlineWalkOptions): ScreenshotInline[] {
  const out: ScreenshotInline[] = [];
  walkInline(node, {}, options, out);
  return cleanupInlines(out);
}

/** 行内片段拼成纯文本（emoji 用 alt 代替） */
export function textFromInlines(inlines: ScreenshotInline[]): string {
  let text = '';
  for (const inline of inlines) {
    if (inline.type === 'text') text += inline.text;
    else if (inline.type === 'emoji') text += inline.alt;
    else text += '\n';
  }
  return text;
}

/** 行内片段的字符数（用于截断预算） */
export function inlineTextLength(inlines: ScreenshotInline[]): number {
  let total = 0;
  for (const inline of inlines) {
    if (inline.type === 'text') total += inline.text.length;
    else if (inline.type === 'emoji') total += inline.alt.length || 1;
  }
  return total;
}

/** 去掉重复的内容图片（同一张图只出现一次） */
export function dedupeImageBlocks(blocks: ScreenshotBlock[]): ScreenshotBlock[] {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    if (block.type !== 'image') return true;
    if (seen.has(block.src)) return false;
    seen.add(block.src);
    return true;
  });
}
