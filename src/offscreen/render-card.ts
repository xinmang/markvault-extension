/**
 * 卡片渲染器（离屏文档）。
 *
 * 1. 截断过长的正文 / 图片
 * 2. 把图片抓成 data URL（避免 SVG foreignObject 里的跨域限制）
 * 3. 用纯 DOM API 构建卡片并测量
 * 4. 序列化进 foreignObject，画到 canvas，导出图片
 */

import type {
  ScreenshotBlock,
  ScreenshotContent,
  ScreenshotInline,
  ScreenshotRenderOptions,
  ScreenshotRenderResult,
} from '@/types/screenshot';
import { DEFAULT_SCREENSHOT_RENDER_OPTIONS } from '@/types/screenshot';
import { buildCardStyles } from './card-styles';

/** 单张图片抓取超时 */
const IMAGE_TIMEOUT_MS = 10_000;
/** 卡片内单张图片等待加载的上限（图片已是 data URL，正常几毫秒内完成） */
const IMAGE_LOAD_TIMEOUT_MS = 3_000;
/** 单张图片体积上限 */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
/** canvas 单边上限 */
const MAX_CANVAS_EDGE = 16_000;
/** 页脚来源地址最多显示的字符数 */
const SOURCE_MAX_CHARS = 60;

// ---------------------------------------------------------------------------
// 纯函数（可单独测试）
// ---------------------------------------------------------------------------

export interface TruncateBlocksResult {
  blocks: ScreenshotBlock[];
  truncated: boolean;
}

function inlineLength(inlines: ScreenshotInline[]): number {
  let total = 0;
  for (const inline of inlines) {
    if (inline.type === 'text') total += inline.text.length;
    else if (inline.type === 'emoji') total += inline.alt.length || 1;
    else total += 1;
  }
  return total;
}

function blockTextLength(block: ScreenshotBlock): number {
  switch (block.type) {
    case 'paragraph':
    case 'quote':
      return inlineLength(block.inlines);
    case 'heading':
    case 'code':
      return block.text.length;
    case 'list':
      return block.items.reduce((total, item) => total + inlineLength(item), 0);
    case 'image':
      return 0;
    default:
      return 0;
  }
}

/**
 * 按段落 / 列表项边界截断正文，并限制图片数量。
 * 至少保留第一个文本块，避免生成空卡片。
 */
export function truncateBlocks(
  blocks: ScreenshotBlock[],
  maxTextLength: number,
  maxImages: number
): TruncateBlocksResult {
  const kept: ScreenshotBlock[] = [];
  let textLength = 0;
  let imageCount = 0;
  let truncated = false;

  const textLimit = Math.max(0, maxTextLength);
  const imageLimit = Math.max(0, maxImages);

  for (const block of blocks) {
    if (block.type === 'image') {
      if (imageCount >= imageLimit) {
        truncated = true;
        continue;
      }
      kept.push(block);
      imageCount += 1;
      continue;
    }

    if (block.type === 'list') {
      const items: ScreenshotInline[][] = [];
      let stopped = false;
      for (const item of block.items) {
        const length = inlineLength(item);
        if (textLength > 0 && textLength + length > textLimit) {
          stopped = true;
          break;
        }
        items.push(item);
        textLength += length;
      }

      if (items.length > 0) kept.push({ type: 'list', ordered: block.ordered, items });
      if (stopped) {
        truncated = true;
        break;
      }
      continue;
    }

    const length = blockTextLength(block);
    if (textLength > 0 && textLength + length > textLimit) {
      truncated = true;
      break;
    }
    kept.push(block);
    textLength += length;
  }

  return { blocks: kept, truncated };
}

/** ISO 时间格式化成可读日期；无效输入返回空字符串 */
export function formatPublishedAt(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** 页脚来源：去掉协议与查询串，超过长度时省略中段 */
export function formatSourceUrl(url: string, maxChars = SOURCE_MAX_CHARS): string {
  if (!url) return '';
  let display = url;
  try {
    const parsed = new URL(url);
    display = `${parsed.hostname}${parsed.pathname}`;
    if (display.endsWith('/') && display.length > 1) display = display.slice(0, -1);
  } catch {
    display = url.replace(/^https?:\/\//i, '');
  }

  if (display.length <= maxChars) return display;
  const head = Math.ceil((maxChars - 1) / 2);
  const tail = Math.floor((maxChars - 1) / 2);
  return `${display.slice(0, head)}…${display.slice(display.length - tail)}`;
}

// ---------------------------------------------------------------------------
// 图片抓取
// ---------------------------------------------------------------------------

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader failed'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    if (controller) {
      timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    }

    const response = await fetch(url, {
      credentials: 'omit',
      signal: controller?.signal,
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return null;

    const blob = await response.blob();
    if (blob.size === 0 || blob.size > MAX_IMAGE_BYTES) return null;

    return await blobToDataUrl(blob);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

type ImageMap = Map<string, string>;

function collectImageUrls(content: ScreenshotContent, blocks: ScreenshotBlock[]): string[] {
  const urls = new Set<string>();
  if (content.author?.avatarUrl) urls.add(content.author.avatarUrl);
  if (content.faviconUrl) urls.add(content.faviconUrl);

  for (const block of blocks) {
    if (block.type === 'image') urls.add(block.src);
    if (block.type === 'paragraph' || block.type === 'quote') {
      for (const inline of block.inlines) {
        if (inline.type === 'emoji') urls.add(inline.src);
      }
    }
    if (block.type === 'list') {
      for (const item of block.items) {
        for (const inline of item) {
          if (inline.type === 'emoji') urls.add(inline.src);
        }
      }
    }
  }
  return Array.from(urls);
}

async function loadImages(urls: string[]): Promise<ImageMap> {
  const map: ImageMap = new Map();
  await Promise.all(
    urls.map(async (url) => {
      const dataUrl = await fetchImageAsDataUrl(url);
      if (dataUrl) map.set(url, dataUrl);
    })
  );
  return map;
}

// ---------------------------------------------------------------------------
// DOM 构建
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendInlines(target: HTMLElement, inlines: ScreenshotInline[], images: ImageMap): void {
  for (const inline of inlines) {
    if (inline.type === 'break') {
      target.appendChild(document.createElement('br'));
      continue;
    }

    if (inline.type === 'emoji') {
      const dataUrl = images.get(inline.src);
      if (dataUrl) {
        const img = document.createElement('img');
        img.className = 'mv-emoji';
        img.src = dataUrl;
        img.alt = inline.alt;
        target.appendChild(img);
      } else if (inline.alt) {
        target.appendChild(document.createTextNode(inline.alt));
      }
      continue;
    }

    const span = el('span');
    span.textContent = inline.text;
    if (inline.bold) span.classList.add('mv-bold');
    if (inline.italic) span.classList.add('mv-italic');
    if (inline.code) span.classList.add('mv-inline-code');
    if (inline.link) span.classList.add('mv-link');
    target.appendChild(span);
  }
}

function appendImage(target: HTMLElement, src: string, alt: string | undefined, images: ImageMap): boolean {
  const dataUrl = images.get(src);
  if (!dataUrl) return false;
  const img = document.createElement('img');
  img.className = 'mv-image';
  img.src = dataUrl;
  img.alt = alt || '';
  target.appendChild(img);
  return true;
}

function appendBlocks(container: HTMLElement, content: ScreenshotContent, blocks: ScreenshotBlock[], images: ImageMap): void {
  // X 推文 2–4 张图时用 2 列网格（只在图片连续出现时启用）
  const xGridImages =
    content.site === 'x'
      ? blocks.filter((block): block is Extract<ScreenshotBlock, { type: 'image' }> => block.type === 'image')
      : [];
  const imageIndexes = blocks.reduce<number[]>((indexes, block, index) => {
    if (block.type === 'image') indexes.push(index);
    return indexes;
  }, []);
  const contiguousImages =
    imageIndexes.length > 0 && imageIndexes.every((value, index) => index === 0 || value === imageIndexes[index - 1] + 1);
  const useGrid =
    content.site === 'x' &&
    contiguousImages &&
    xGridImages.length >= 2 &&
    xGridImages.length <= 4;
  let gridRendered = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const p = el('div', 'mv-p');
        appendInlines(p, block.inlines, images);
        container.appendChild(p);
        break;
      }
      case 'heading': {
        const h = el('div', block.level === 2 ? 'mv-h2' : 'mv-h3', block.text);
        container.appendChild(h);
        break;
      }
      case 'quote': {
        const quote = el('blockquote', 'mv-quote');
        appendInlines(quote, block.inlines, images);
        container.appendChild(quote);
        break;
      }
      case 'code': {
        const pre = el('pre', 'mv-code', block.text);
        container.appendChild(pre);
        break;
      }
      case 'list': {
        const list = el(block.ordered ? 'ol' : 'ul', `mv-list ${block.ordered ? 'mv-list-ordered' : 'mv-list-unordered'}`);
        for (const item of block.items) {
          const li = el('li');
          appendInlines(li, item, images);
          list.appendChild(li);
        }
        container.appendChild(list);
        break;
      }
      case 'image': {
        if (useGrid) {
          if (gridRendered) break;
          gridRendered = true;
          const grid = el('div', 'mv-grid');
          for (const image of xGridImages) {
            appendImage(grid, image.src, image.alt, images);
          }
          if (grid.children.length > 0) container.appendChild(grid);
          break;
        }
        const figure = el('div', 'mv-figure');
        if (appendImage(figure, block.src, block.alt, images)) container.appendChild(figure);
        break;
      }
      default:
        break;
    }
  }
}

interface BuiltCard {
  root: HTMLElement;
  style: HTMLStyleElement;
  width: number;
  height: number;
}

function buildCard(
  content: ScreenshotContent,
  options: ScreenshotRenderOptions,
  blocks: ScreenshotBlock[],
  truncated: boolean,
  images: ImageMap
): BuiltCard {
  const root = el('div', 'mv-root');
  root.style.width = `${options.width}px`;
  root.style.position = 'absolute';
  root.style.left = '-100000px';
  root.style.top = '0';

  const card = el('div', 'mv-card');
  root.appendChild(card);

  // 头部
  const header = el('div', 'mv-header');
  const author = content.author;

  if (author) {
    const avatarData = author.avatarUrl ? images.get(author.avatarUrl) : undefined;
    if (avatarData) {
      const avatar = document.createElement('img');
      avatar.className = 'mv-avatar';
      avatar.src = avatarData;
      avatar.alt = '';
      header.appendChild(avatar);
    } else {
      const fallback = el('div', 'mv-avatar mv-avatar-fallback', (author.name || author.handle || '?').slice(0, 1).toUpperCase());
      header.appendChild(fallback);
    }
  }

  const identity = el('div', 'mv-identity');
  if (author) {
    identity.appendChild(el('div', 'mv-name', author.name || author.handle || ''));
    const metaParts: string[] = [];
    if (author.handle) metaParts.push(author.handle.startsWith('@') ? author.handle : `@${author.handle}`);
    const dateText = formatPublishedAt(content.publishedAt, options.locale);
    if (dateText) metaParts.push(dateText);

    if (metaParts.length > 0) {
      const meta = el('div', 'mv-meta');
      metaParts.forEach((part, index) => {
        if (index > 0) meta.appendChild(el('span', 'mv-meta-sep', '·'));
        meta.appendChild(document.createTextNode(part));
      });
      identity.appendChild(meta);
    }
  } else if (content.publishedAt) {
    const dateText = formatPublishedAt(content.publishedAt, options.locale);
    if (dateText) identity.appendChild(el('div', 'mv-meta', dateText));
  }
  header.appendChild(identity);

  const badge = el('div', 'mv-badge');
  const faviconData = content.faviconUrl ? images.get(content.faviconUrl) : undefined;
  if (faviconData) {
    const favicon = document.createElement('img');
    favicon.className = 'mv-favicon';
    favicon.src = faviconData;
    favicon.alt = '';
    badge.appendChild(favicon);
  }
  badge.appendChild(el('span', 'mv-badge-text', content.siteName || ''));
  header.appendChild(badge);
  card.appendChild(header);

  if (content.title) {
    card.appendChild(el('div', 'mv-title', content.title));
  }

  const body = el('div', 'mv-body');
  appendBlocks(body, content, blocks, images);
  card.appendChild(body);

  if (truncated) {
    card.appendChild(el('div', 'mv-note', '内容较长，已截取部分正文'));
  }

  // 页脚
  const footer = el('div', 'mv-footer');
  footer.appendChild(el('span', 'mv-source', formatSourceUrl(content.url)));
  const brand = el('span', 'mv-brand');
  brand.appendChild(el('span', 'mv-brand-dot'));
  brand.appendChild(document.createTextNode(options.brand));
  footer.appendChild(brand);
  card.appendChild(footer);

  const style = document.createElement('style');
  style.textContent = buildCardStyles(options.theme);

  const host = document.body ?? document.documentElement;
  host.appendChild(style);
  host.appendChild(root);

  const rect = root.getBoundingClientRect();
  const height = Math.max(1, Math.ceil(rect.height || root.scrollHeight || 0));

  return {
    root,
    style,
    width: options.width,
    height,
  };
}

function cleanupCard(built: BuiltCard | null): void {
  if (!built) return;
  built.root.remove();
  built.style.remove();
}

/**
 * 等待卡片中的图片加载完成，以便测量真实高度。
 *
 * 不能用 img.decode()：离屏文档从不绘制，decode() 和 requestAnimationFrame 一样永远不会完成，
 * 渲染会一直挂起到后台超时。图片都是 data URL，load / error 事件足够，另设超时兜底。
 */
export function waitForImages(root: HTMLElement, timeoutMs = IMAGE_LOAD_TIMEOUT_MS): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const finish = () => {
            clearTimeout(timer);
            img.removeEventListener('load', finish);
            img.removeEventListener('error', finish);
            resolve();
          };
          const timer = setTimeout(finish, timeoutMs);
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
        })
    )
  ).then(() => undefined);
}

// ---------------------------------------------------------------------------
// 光栅化
// ---------------------------------------------------------------------------

function serializeSvg(built: BuiltCard, css: string): string {
  const clone = built.root.cloneNode(true) as HTMLElement;
  clone.style.position = 'static';
  clone.style.left = '';

  const wrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const style = document.createElement('style');
  style.textContent = css;
  wrapper.appendChild(style);
  wrapper.appendChild(clone);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(Math.round(built.width)));
  svg.setAttribute('height', String(Math.round(built.height)));

  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');
  foreignObject.appendChild(wrapper);
  svg.appendChild(foreignObject);

  return new XMLSerializer().serializeToString(svg);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterization failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), format, quality);
    } catch {
      resolve(null);
    }
  });
}

async function rasterize(svg: string, width: number, height: number, options: ScreenshotRenderOptions): Promise<{
  dataUrl: string;
  mime: string;
  bytes: number;
}> {
  const image = await loadSvgImage(svg);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // 浏览器不支持请求的格式时 toBlob 会返回 null 或 PNG，统一回退到 PNG
  let blob = await canvasToBlob(canvas, options.format, options.quality);
  if (!blob || (blob.type && blob.type !== options.format)) {
    if (options.format === 'image/png') {
      blob = blob ?? (await canvasToBlob(canvas, 'image/png', 1));
    } else {
      blob = await canvasToBlob(canvas, 'image/png', 1);
    }
  }
  if (!blob) throw new Error('canvas.toBlob failed');

  const mime = blob.type || 'image/png';
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, mime, bytes: blob.size };
}

/** 内容过多时进一步截掉后半段文本块（渲染循环内部使用） */
function shrinkBlocks(blocks: ScreenshotBlock[]): ScreenshotBlock[] {
  const textIndexes: number[] = [];
  blocks.forEach((block, index) => {
    if (block.type !== 'image') textIndexes.push(index);
  });
  if (textIndexes.length <= 1) {
    return blocks.slice(0, Math.max(1, Math.floor(blocks.length / 2)));
  }
  const keep = Math.max(1, Math.floor(textIndexes.length / 2));
  const cutoff = textIndexes[keep - 1];
  return blocks.slice(0, cutoff + 1);
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export async function renderScreenshotCard(
  content: ScreenshotContent,
  optionsInput?: Partial<ScreenshotRenderOptions>
): Promise<ScreenshotRenderResult> {
  const options: ScreenshotRenderOptions = { ...DEFAULT_SCREENSHOT_RENDER_OPTIONS, ...optionsInput };

  const initial = truncateBlocks(content.blocks, options.maxTextLength, options.maxImages);
  let blocks = initial.blocks;
  let truncated = initial.truncated;
  if (blocks.length === 0) {
    // 图片预算为 0 时也不要生成完全空白的卡片：至少保留第一段文字
    const firstText = content.blocks.find((block) => block.type !== 'image');
    if (firstText) blocks = [firstText];
  }

  const imageUrls = collectImageUrls(content, blocks);
  const images = await loadImages(imageUrls);

  let built: BuiltCard | null = null;
  try {
    // 请求倍率；过高时优先降倍率，最低降到 1 倍
    let scale = Math.max(0.1, options.scale);
    let result: { dataUrl: string; mime: string; bytes: number } | null = null;
    let outputWidth = 0;
    let outputHeight = 0;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      built = buildCard(content, options, blocks, truncated, images);
      await waitForImages(built.root);

      // 重新测量（图片解码后高度可能变化）
      const rect = built.root.getBoundingClientRect();
      const measuredHeight = Math.max(1, Math.ceil(rect.height || built.root.scrollHeight || built.height));
      built.height = measuredHeight;

      const desiredScale = scale;
      let effectiveScale = desiredScale;

      if (measuredHeight * desiredScale > MAX_CANVAS_EDGE) {
        effectiveScale = Math.min(
          desiredScale,
          Math.max(1, Math.floor((MAX_CANVAS_EDGE / measuredHeight) * 100) / 100)
        );
      }

      if (measuredHeight * effectiveScale > MAX_CANVAS_EDGE) {
        // 缩到 1 倍仍然过高：截断更多内容后重试
        cleanupCard(built);
        built = null;
        if (blocks.length <= 1) break;
        blocks = shrinkBlocks(blocks);
        truncated = true;
        scale = 1;
        continue;
      }

      const svg = serializeSvg(built, buildCardStyles(options.theme));
      outputWidth = Math.round(built.width * effectiveScale);
      outputHeight = Math.round(measuredHeight * effectiveScale);
      result = await rasterize(svg, outputWidth, outputHeight, options);
      break;
    }

    if (!result) {
      throw new Error('Screenshot card is too tall to render');
    }

    return {
      dataUrl: result.dataUrl,
      mime: result.mime,
      width: outputWidth,
      height: outputHeight,
      bytes: result.bytes,
      truncated,
    };
  } finally {
    cleanupCard(built);
  }
}
