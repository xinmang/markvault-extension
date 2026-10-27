import type { UserPreferences } from '@/types';

/** 把“跟随系统”解析成具体配色；没有 matchMedia 的环境（后台）默认浅色 */
export function resolveScreenshotTheme(theme?: UserPreferences['screenshotTheme']): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** 网址是否属于设置中的截图网站（包含子域名，例如 mobile.x.com 匹配 x.com） */
export function matchesScreenshotDomain(url: string, domains: readonly string[] | undefined): boolean {
  if (!domains?.length) return false;
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** 打开弹窗时“网站截图”开关的默认值：全局默认开启，或当前网站在截图网站列表中 */
export function defaultCreateScreenshot(url: string, preferences: UserPreferences): boolean {
  return Boolean(preferences.defaultCreateScreenshot) || matchesScreenshotDomain(url, preferences.screenshotDomains);
}
