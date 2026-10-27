/**
 * 卡片样式。
 *
 * 样式不依赖页面原有 CSS：离屏文档里只有这一段字符串，
 * 通过类名前缀 `mv-` 隔离，序列化进 foreignObject 时同样生效。
 */

import type { ScreenshotRenderOptions } from '@/types/screenshot';

export const CARD_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export const CARD_MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export interface CardThemeColors {
  gradientStart: string;
  gradientEnd: string;
  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  text: string;
  muted: string;
  accent: string;
  codeBackground: string;
  codeInlineBackground: string;
  badgeBorder: string;
  divider: string;
  avatarFallbackBackground: string;
}

export const LIGHT_COLORS: CardThemeColors = {
  gradientStart: '#eef2f7',
  gradientEnd: '#f8fafc',
  cardBackground: '#ffffff',
  cardBorder: 'rgba(15, 23, 42, 0.08)',
  cardShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#2563eb',
  codeBackground: '#f1f5f9',
  codeInlineBackground: '#f1f5f9',
  badgeBorder: 'rgba(15, 23, 42, 0.1)',
  divider: 'rgba(15, 23, 42, 0.08)',
  avatarFallbackBackground: '#dbeafe',
};

export const DARK_COLORS: CardThemeColors = {
  gradientStart: '#0b0f17',
  gradientEnd: '#111827',
  cardBackground: '#161b22',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  codeBackground: '#0d1117',
  codeInlineBackground: 'rgba(110, 118, 129, 0.25)',
  badgeBorder: 'rgba(255, 255, 255, 0.14)',
  divider: 'rgba(255, 255, 255, 0.08)',
  avatarFallbackBackground: '#1f2a3c',
};

export function themeColors(theme: ScreenshotRenderOptions['theme']): CardThemeColors {
  return theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

/** 生成完整的卡片 CSS。width 由外层内联样式决定，这里只写排版。 */
export function buildCardStyles(theme: ScreenshotRenderOptions['theme']): string {
  const c = themeColors(theme);

  return `
.mv-root {
  box-sizing: border-box;
  padding: 28px;
  background: linear-gradient(160deg, ${c.gradientStart} 0%, ${c.gradientEnd} 100%);
  color: ${c.text};
  font-family: ${CARD_FONT_STACK};
  font-size: 17px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.mv-root *,
.mv-root *::before,
.mv-root *::after { box-sizing: border-box; }
.mv-card {
  border-radius: 18px;
  background: ${c.cardBackground};
  border: 1px solid ${c.cardBorder};
  box-shadow: ${c.cardShadow};
  padding: 32px 34px;
  overflow: hidden;
}
.mv-header { display: flex; align-items: center; gap: 12px; }
.mv-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  flex: 0 0 44px; overflow: hidden;
  background: ${c.codeBackground};
  display: block; object-fit: cover;
}
.mv-avatar-fallback {
  display: flex; align-items: center; justify-content: center;
  font-size: 19px; font-weight: 600; color: ${c.accent};
  background: ${c.avatarFallbackBackground};
}
.mv-identity { min-width: 0; flex: 1 1 auto; }
.mv-name {
  font-size: 16px; font-weight: 600; line-height: 1.4; color: ${c.text};
  overflow-wrap: anywhere;
}
.mv-meta {
  font-size: 13px; line-height: 1.5; color: ${c.muted};
  overflow-wrap: anywhere;
}
.mv-meta-sep { padding: 0 5px; }
.mv-badge {
  display: inline-flex; align-items: center; gap: 6px;
  flex: 0 0 auto; margin-left: 8px;
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid ${c.badgeBorder};
  color: ${c.muted}; font-size: 12px; line-height: 1.4;
  letter-spacing: 0.04em; text-transform: uppercase;
  max-width: 220px;
}
.mv-badge-text {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mv-favicon { width: 16px; height: 16px; border-radius: 4px; display: block; }
.mv-title {
  font-size: 24px; font-weight: 700; line-height: 1.35;
  margin: 18px 0 8px; color: ${c.text}; overflow-wrap: anywhere;
}
.mv-body { font-size: 17px; line-height: 1.75; overflow-wrap: anywhere; }
.mv-body > *:first-child { margin-top: 0; }
.mv-body > *:last-child { margin-bottom: 0; }
.mv-p { margin: 12px 0; overflow-wrap: anywhere; }
.mv-h2 { font-size: 19px; font-weight: 600; line-height: 1.45; margin: 20px 0 8px; }
.mv-h3 { font-size: 19px; font-weight: 600; line-height: 1.45; margin: 18px 0 6px; }
.mv-quote {
  margin: 14px 0; padding: 2px 0 2px 14px;
  border-left: 3px solid ${c.accent}66;
  color: ${c.muted};
}
.mv-code {
  margin: 14px 0; padding: 12px 14px; border-radius: 10px;
  background: ${c.codeBackground}; color: ${c.text};
  font-family: ${CARD_MONO_STACK}; font-size: 13.5px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
}
.mv-list { margin: 12px 0; padding-left: 24px; }
.mv-list li { margin: 4px 0; overflow-wrap: anywhere; }
.mv-list-ordered { list-style: decimal; }
.mv-list-unordered { list-style: disc; }
.mv-figure { margin: 16px 0; }
.mv-image {
  display: block; width: 100%; max-height: 720px;
  border-radius: 12px; object-fit: cover; object-position: top;
}
.mv-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 16px 0;
}
.mv-grid .mv-image { height: 240px; width: 100%; }
.mv-inline-code {
  font-family: ${CARD_MONO_STACK}; font-size: 0.88em;
  padding: 1px 5px; border-radius: 5px; background: ${c.codeInlineBackground};
}
.mv-link { color: ${c.accent}; }
.mv-bold { font-weight: 600; }
.mv-italic { font-style: italic; }
.mv-emoji {
  width: 1.2em; height: 1.2em; vertical-align: -0.2em;
  display: inline-block; margin: 0 1px;
}
.mv-note {
  margin-top: 18px; font-size: 12.5px; line-height: 1.5; color: ${c.muted};
}
.mv-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-top: 24px; padding-top: 14px; border-top: 1px solid ${c.divider};
  font-size: 12.5px; line-height: 1.5; color: ${c.muted};
}
.mv-source {
  min-width: 0; flex: 1 1 auto; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.mv-brand { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; }
.mv-brand-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: ${c.muted}; display: inline-block;
}
`.trim();
}
