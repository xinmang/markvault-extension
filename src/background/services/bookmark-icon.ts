import { bookmarkAPI } from '@/lib/services/bookmark-api';
import { logger } from '@/lib/utils/logger';

const DEFAULT_ICON_PATHS = {
  16: 'icons/icon-16.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
};

const iconRefreshVersions = new Map<number, number>();
let savedIconDataPromise: Promise<Record<number, ImageData>> | null = null;

function isTrackableUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }

  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

async function createSavedIconData(): Promise<Record<number, ImageData>> {
  const iconSources = [
    { size: 16, path: 'icons/icon-16.png' },
    { size: 32, path: 'icons/icon-48.png' },
  ];
  const result: Record<number, ImageData> = {};

  await Promise.all(
    iconSources.map(async ({ size, path }) => {
      const response = await fetch(chrome.runtime.getURL(path));
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('无法创建扩展图标画布');
      }

      context.drawImage(bitmap, 0, 0, size, size);
      bitmap.close();

      const dotRadius = Math.max(3, size * 0.18);
      const center = size - dotRadius - 1;

      // 白色描边用于在深色和浅色图标上都保持绿点边界清晰。
      context.beginPath();
      context.arc(center, center, dotRadius + Math.max(1, size * 0.04), 0, Math.PI * 2);
      context.fillStyle = '#ffffff';
      context.fill();

      context.beginPath();
      context.arc(center, center, dotRadius, 0, Math.PI * 2);
      context.fillStyle = '#22c55e';
      context.fill();

      result[size] = context.getImageData(0, 0, size, size);
    })
  );

  return result;
}

function getSavedIconData(): Promise<Record<number, ImageData>> {
  savedIconDataPromise ??= createSavedIconData();
  return savedIconDataPromise;
}

async function showDefaultIcon(tabId: number): Promise<void> {
  await chrome.action.setIcon({ tabId, path: DEFAULT_ICON_PATHS });
}

async function showSavedIcon(tabId: number): Promise<void> {
  await chrome.action.setIcon({ tabId, imageData: await getSavedIconData() });
}

/**
 * 刷新指定标签页的书签状态图标。
 * API 按完整 URL 判断；响应后再次核对标签页 URL，防止快速跳转时写入旧状态。
 */
export async function refreshBookmarkIconForTab(tabId: number, knownUrl?: string): Promise<void> {
  const version = (iconRefreshVersions.get(tabId) ?? 0) + 1;
  iconRefreshVersions.set(tabId, version);

  try {
    await showDefaultIcon(tabId);

    const url = knownUrl ?? (await chrome.tabs.get(tabId)).url;
    if (!isTrackableUrl(url)) {
      return;
    }

    const exists = await bookmarkAPI.hasExactUrl(url);
    if (iconRefreshVersions.get(tabId) !== version) {
      return;
    }

    const latestTab = await chrome.tabs.get(tabId);
    if (latestTab.url !== url) {
      return;
    }

    if (exists) {
      await showSavedIcon(tabId);
    }
  } catch (error) {
    if (iconRefreshVersions.get(tabId) === version) {
      await showDefaultIcon(tabId).catch(() => undefined);
    }
    logger.error('[BookmarkIcon] 刷新书签状态失败:', error);
  }
}

export async function refreshActiveBookmarkIcon(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (typeof tab?.id === 'number') {
    await refreshBookmarkIconForTab(tab.id, tab.url);
  }
}

async function refreshActiveTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true });
  await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
      .map((tab) => refreshBookmarkIconForTab(tab.id, tab.url))
  );
}

/**
 * 注册标签页和配置变更监听器。必须在 Service Worker 顶层同步调用。
 */
export function setupBookmarkIconIndicator(): void {
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void refreshBookmarkIconForTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      // 同 URL 刷新通常不会提供 changeInfo.url；导航完成后再次同步，也可避免
      // 首次进入页面时浏览器在提交导航后重置此前设置的标签页图标。
      void refreshBookmarkIconForTab(tabId, changeInfo.url ?? tab.url);
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      void refreshActiveBookmarkIcon();
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    iconRefreshVersions.delete(tabId);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.config) {
      void refreshActiveTabs();
    }
  });

  void refreshActiveTabs();
}
