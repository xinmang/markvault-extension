/**
 * 网站截图（内容卡片）类型约定
 *
 * 截图不是逐像素截屏：内容脚本只提取帖子正文、图片、作者与时间，
 * 再由离屏文档用统一的卡片样式渲染成图片。评论区和网页原有样式不会出现在截图里。
 */

/** 段落内的行内片段；所有文本都按纯文本渲染，不会插入网页原有 HTML */
export type ScreenshotInline =
  | {
      type: 'text';
      text: string;
      bold?: boolean;
      italic?: boolean;
      code?: boolean;
      /** 链接只以强调色显示，不输出网址 */
      link?: boolean;
    }
  | {
      /** 表情图片（例如 Discourse 的 :smile:），按 1.2em 行内显示 */
      type: 'emoji';
      src: string;
      alt: string;
    }
  | { type: 'break' };

export type ScreenshotBlock =
  | { type: 'paragraph'; inlines: ScreenshotInline[] }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'quote'; inlines: ScreenshotInline[] }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: ScreenshotInline[][] }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number };

export type ScreenshotSite = 'x' | 'discourse' | 'generic';

export interface ScreenshotAuthor {
  name: string;
  /** 例如 X 的 @handle 或论坛用户名 */
  handle?: string;
  avatarUrl?: string;
}

export interface ScreenshotContent {
  site: ScreenshotSite;
  /** 卡片右上角显示的站点名，例如 X、LINUX DO */
  siteName: string;
  url: string;
  /** 论坛帖子与文章的标题；X 推文没有标题 */
  title?: string;
  author?: ScreenshotAuthor;
  /** ISO 8601 时间 */
  publishedAt?: string;
  faviconUrl?: string;
  blocks: ScreenshotBlock[];
}

export interface ScreenshotRenderOptions {
  theme: 'light' | 'dark';
  /** 卡片 CSS 宽度（像素），默认 720 */
  width: number;
  /** 输出倍率，默认 2 */
  scale: number;
  /** 正文最多保留的字符数，超出后在段落边界截断并注明 */
  maxTextLength: number;
  /** 最多渲染的图片数量 */
  maxImages: number;
  format: 'image/webp' | 'image/png' | 'image/jpeg';
  /** 0–1，仅对 webp / jpeg 生效 */
  quality: number;
  /** 日期格式化使用的语言，例如 zh-CN */
  locale: string;
  /** 页脚品牌文字 */
  brand: string;
}

export interface ScreenshotRenderResult {
  dataUrl: string;
  mime: string;
  /** 输出图片的像素尺寸 */
  width: number;
  height: number;
  bytes: number;
  /** 正文或图片是否因长度限制被截断 */
  truncated: boolean;
}

export const DEFAULT_SCREENSHOT_RENDER_OPTIONS: ScreenshotRenderOptions = {
  theme: 'light',
  width: 720,
  scale: 2,
  maxTextLength: 1800,
  maxImages: 4,
  format: 'image/webp',
  quality: 0.92,
  locale: 'zh-CN',
  brand: 'MarkVault',
};
