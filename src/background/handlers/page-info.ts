/**
 * 页面信息提取处理器
 */

import type { Message, MessageResponse, PageInfo } from '@/types';
import { TIMEOUTS } from '@/lib/constants/timeouts';
import { getFallbackDescription, isSamePageUrl, normalizePageText } from '@/lib/utils/page-description';

function basicPageInfo(title: string, url: string): MessageResponse<PageInfo> {
  return {
    success: true,
    data: { title, url, description: getFallbackDescription({ title, url }), content: '', thumbnail: '' },
  };
}

/**
 * 获取基本页面信息作为 fallback
 */
async function getBasicPageInfo(tabId: number, fallbackUrl: string): Promise<MessageResponse> {
  try {
    const currentTab = await chrome.tabs.get(tabId);
    return basicPageInfo(currentTab.title || 'Untitled', currentTab.url || fallbackUrl);
  } catch {
    return basicPageInfo('Untitled', fallbackUrl);
  }
}

/**
 * 带超时的消息发送
 */
async function sendMessageWithTimeout(
  tabId: number,
  msg: Message,
  timeoutMs: number = 3000
): Promise<MessageResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      // 只向主框架提取，防止子框架先响应并返回其他网站的信息。
      chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }),
      new Promise<MessageResponse>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 处理页面信息提取
 */
export async function handleExtractPageInfo(message: Message): Promise<MessageResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    throw new Error('No active tab found');
  }

  const url = tab.url || '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    !url
  ) {
    return basicPageInfo(tab.title || 'Untitled', url);
  }

  // 步骤1: 检测 content script 是否存活
  let isContentScriptAlive = false;
  try {
    await sendMessageWithTimeout(tab.id, { type: 'PING' }, 1000);
    isContentScriptAlive = true;
  } catch {
    // Content script not responding, will try to inject
  }

  // 步骤2: 如果 content script 不存在，尝试注入
  if (!isContentScriptAlive) {
    try {
      const manifest = chrome.runtime.getManifest();
      const contentScripts = manifest.content_scripts?.[0];

      if (!contentScripts || !contentScripts.js || contentScripts.js.length === 0) {
        return await getBasicPageInfo(tab.id, url);
      }

      const scriptPath = contentScripts.js[0];

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [scriptPath],
      });

      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.PAGE_LOAD));

      try {
        await sendMessageWithTimeout(tab.id, { type: 'PING' }, 1000);
        isContentScriptAlive = true;
      } catch {
        return await getBasicPageInfo(tab.id, url);
      }
    } catch {
      return await getBasicPageInfo(tab.id, url);
    }
  }

  // 步骤3: 发送实际的提取请求
  if (isContentScriptAlive) {
    try {
      // 导航可能发生在等待脚本响应期间；核对当前标签页，最多重取一次。
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await sendMessageWithTimeout(tab.id, message, 5000);
        const page = response.data as PageInfo | undefined;
        if (!response.success || !page || typeof page.url !== 'string') break;

        const currentTab = await chrome.tabs.get(tab.id);
        if (isSamePageUrl(page.url, currentTab.url || '')) {
          const title = normalizePageText(page.title) || currentTab.title || 'Untitled';
          return {
            success: true,
            data: {
              ...page,
              title,
              description: normalizePageText(page.description) || getFallbackDescription({ ...page, title }),
            },
          };
        }
      }
    } catch {
      return await getBasicPageInfo(tab.id, url);
    }
  }

  return await getBasicPageInfo(tab.id, url);
}
