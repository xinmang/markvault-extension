/**
 * 网站截图：从标签页提取帖子正文，交给离屏文档渲染成卡片图片。
 */

import type { ScreenshotContent, ScreenshotRenderOptions, ScreenshotRenderResult } from '@/types/screenshot';

const OFFSCREEN_PATH = 'src/offscreen/index.html';
const EXTRACT_TIMEOUT_MS = 8000;
const RENDER_TIMEOUT_MS = 60000;

/** 页面上没有可截图正文时的错误码，弹窗据此显示专门的提示 */
export const SCREENSHOT_NO_CONTENT = 'NO_CONTENT';

let creatingOffscreen: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function hasOffscreenDocument(): Promise<boolean> {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  return contexts.length > 0;
}

/** 离屏文档只创建一次；并发调用共享同一个创建过程 */
export async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Render bookmark screenshot cards from extracted post content',
      })
      .catch((error: unknown) => {
        // 另一个调用刚好创建成功时会报“只能有一个离屏文档”，视为成功
        if (!String(error).includes('single offscreen')) throw error;
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

interface ExtractResponse {
  success: boolean;
  data?: ScreenshotContent;
  error?: string;
}

async function requestContent(tabId: number): Promise<ExtractResponse> {
  // 只向主框架请求，避免嵌入的广告或评论框架抢先返回
  return withTimeout(
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_SCREENSHOT_CONTENT' }, { frameId: 0 }) as Promise<ExtractResponse>,
    EXTRACT_TIMEOUT_MS,
    'Screenshot extraction timeout'
  );
}

async function extractContent(tabId: number): Promise<ScreenshotContent> {
  let response: ExtractResponse;
  try {
    response = await requestContent(tabId);
  } catch {
    // 安装扩展前打开的页面没有内容脚本，注入后重试一次
    const file = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!file) throw new Error('Content script unavailable');
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    response = await requestContent(tabId);
  }
  if (!response?.success || !response.data) {
    throw new Error(response?.error === SCREENSHOT_NO_CONTENT ? SCREENSHOT_NO_CONTENT : response?.error || 'Extraction failed');
  }
  return response.data;
}

export interface CapturedScreenshot {
  content: ScreenshotContent;
  result: ScreenshotRenderResult;
}

/** 提取并渲染指定标签页的截图卡片 */
export async function captureScreenshot(
  tabId: number,
  options: Partial<ScreenshotRenderOptions> = {}
): Promise<CapturedScreenshot> {
  const content = await extractContent(tabId);
  await ensureOffscreenDocument();
  const response = (await withTimeout(
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'RENDER_SCREENSHOT', payload: { content, options } }),
    RENDER_TIMEOUT_MS,
    'Screenshot render timeout'
  )) as { success: boolean; data?: ScreenshotRenderResult; error?: string } | undefined;
  if (!response?.success || !response.data) {
    throw new Error(response?.error || 'Screenshot render failed');
  }
  return { content, result: response.data };
}

/** 当前窗口的活动标签页 */
export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab.id;
}
