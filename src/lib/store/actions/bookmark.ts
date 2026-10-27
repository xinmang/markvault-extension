/**
 * 书签保存相关 actions
 */

import type { Message } from '@/types';
import type { ExistingBookmarkData } from '@/lib/services/bookmark-api';
import { t } from '@/lib/i18n';
import { resolveScreenshotTheme } from '@/lib/utils/screenshot-prefs';

export interface BookmarkActions {
  existingBookmark: ExistingBookmarkData | null;
  setExistingBookmark: (bookmark: ExistingBookmarkData | null) => void;
  saveBookmark: () => Promise<void>;
  updateExistingBookmarkTags: (bookmarkId: string, tags: string[]) => Promise<void>;
  updateExistingBookmarkDescription: (bookmarkId: string, description: string) => Promise<void>;
  createSnapshotForBookmark: (bookmarkId: string) => Promise<void>;
  createScreenshotForBookmark: (bookmarkId: string) => Promise<void>;
  syncCache: () => Promise<void>;
}

export const createBookmarkActions = (set: any, get: any): BookmarkActions => ({
  existingBookmark: null,
  setExistingBookmark: (bookmark) => set({ existingBookmark: bookmark }),

  saveBookmark: async () => {
    const { currentPage, selectedTags, includeThumbnail, createSnapshot, createScreenshot, isPublic, config } = get();

    if (!currentPage) {
      set({ error: t('error_no_page_info') });
      return;
    }

    if (selectedTags.length === 0) {
      set({ error: t('error_select_one_tag') });
      return;
    }

    const startTime = Date.now();

    try {
      set({ isLoading: true, isSaving: true, error: null });

      const result = await chrome.runtime.sendMessage<Message, any>({
        type: 'SAVE_BOOKMARK',
        payload: {
          url: currentPage.url,
          title: currentPage.title,
          description: currentPage.description,
          tags: selectedTags,
          thumbnail: includeThumbnail ? currentPage.thumbnail : undefined,
          createSnapshot,
          createScreenshot,
          screenshotTheme: resolveScreenshotTheme(config?.preferences?.screenshotTheme),
          is_public: isPublic
        }
      });

      // Background returns { success: true, data: saveResult }
      const saveResult = result?.data || result;

      const endTime = Date.now();
      const elapsedMs = endTime - startTime;
      const formattedSeconds = (elapsedMs / 1000).toFixed(2);

      if (!saveResult?.success && saveResult?.success !== undefined) {
        set({
          error: `${saveResult.message || saveResult.error || t('error_save_failed')}（${formattedSeconds}s）`,
          isLoading: false,
          isSaving: false,
          lastSaveDurationMs: elapsedMs
        });
        return;
      }

      if (saveResult?.existingBookmark) {
        set({
          existingBookmark: saveResult.existingBookmark,
          isLoading: false,
          isSaving: false,
          lastSaveDurationMs: elapsedMs
        });
        return;
      }

      let toastMessage: string;

      if (saveResult?.offline) {
        toastMessage = `${saveResult.message || t('msg_bookmark_offline_saved')}（${formattedSeconds}s）`;
        set({
          successMessage: toastMessage,
          isLoading: false,
          isSaving: false,
          lastSaveDurationMs: elapsedMs
        });

        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon-128.png',
          title: t('extName'),
          message: `${saveResult.message || t('msg_bookmark_offline_saved')}（${formattedSeconds}s）`
        });
      } else {
        toastMessage = `✅ ${t('success')}!（${formattedSeconds}s）`;
        set({
          successMessage: toastMessage,
          isLoading: false,
          isSaving: false,
          lastSaveDurationMs: elapsedMs,
          // 书签已保存，截图失败只作为提示，不影响保存结果
          error: saveResult?.screenshotError
            ? t('error_screenshot_upload', saveResult.screenshotError === 'NO_CONTENT' ? t('popup_screenshot_no_content') : saveResult.screenshotError)
            : null
        });

        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon-128.png',
          title: t('extName'),
          message: `"${currentPage.title}" ${t('success')}（${formattedSeconds}s）`
        });
      }

      const toastSnapshot = toastMessage;
      setTimeout(() => {
        if (get().successMessage === toastSnapshot) {
          set({ successMessage: null });
        }
      }, 2000);
    } catch (error) {
      const failureTime = Date.now();
      const elapsedMs = failureTime - startTime;
      const formattedSeconds = (elapsedMs / 1000).toFixed(2);
      set({
        error: t('error_save_bookmark_with_time', [error instanceof Error ? error.message : t('error_save_bookmark_failed'), formattedSeconds]),
        isLoading: false,
        isSaving: false,
        lastSaveDurationMs: elapsedMs
      });
    }
  },

  updateExistingBookmarkTags: async (bookmarkId: string, tags: string[]) => {
    try {
      set({ isSaving: true, error: null });

      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_BOOKMARK_TAGS',
        payload: { bookmarkId, tags }
      });

      if (!result.success) {
        throw new Error(result.error || t('error_update_tags_failed'));
      }

      set({
        successMessage: t('msg_tags_updated'),
        isSaving: false,
        existingBookmark: null
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon-128.png',
        title: t('extName'),
        message: t('msg_tags_updated')
      });

      setTimeout(() => {
        if (get().successMessage === t('msg_tags_updated')) {
          set({ successMessage: null });
        }
      }, 2000);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : t('error_update_tags_failed'),
        isSaving: false
      });
    }
  },

  updateExistingBookmarkDescription: async (bookmarkId: string, description: string) => {
    try {
      set({ isSaving: true, error: null });

      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_BOOKMARK_DESCRIPTION',
        payload: { bookmarkId, description }
      });

      if (!result.success) {
        throw new Error(result.error || t('error_update_description_failed'));
      }

      set({
        successMessage: t('msg_description_updated'),
        isSaving: false,
        existingBookmark: null
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon-128.png',
        title: t('extName'),
        message: t('msg_description_updated')
      });

      setTimeout(() => {
        if (get().successMessage === t('msg_description_updated')) {
          set({ successMessage: null });
        }
      }, 2000);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : t('error_update_description_failed'),
        isSaving: false
      });
    }
  },

  createSnapshotForBookmark: async (bookmarkId: string) => {
    try {
      set({ isSaving: true, error: null });

      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_SNAPSHOT',
        payload: { bookmarkId }
      });

      if (!result.success) {
        throw new Error(result.error || t('error_create_snapshot_failed'));
      }

      set({
        successMessage: t('msg_snapshot_created'),
        isSaving: false,
        existingBookmark: null
      });

      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon-128.png',
        title: t('extName'),
        message: t('msg_snapshot_created')
      });

      setTimeout(() => {
        if (get().successMessage === t('msg_snapshot_created')) {
          set({ successMessage: null });
        }
      }, 2000);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : t('error_create_snapshot_failed'),
        isSaving: false
      });
    }
  },

  createScreenshotForBookmark: async (bookmarkId: string) => {
    const response = await chrome.runtime.sendMessage<Message, any>({
      type: 'UPLOAD_SCREENSHOT',
      payload: { bookmarkId, theme: resolveScreenshotTheme(get().config?.preferences?.screenshotTheme) }
    });
    if (!response?.success) {
      const reason = response?.error === 'NO_CONTENT' ? t('popup_screenshot_no_content') : response?.error || 'Unknown error';
      // 抛给对话框显示具体原因（例如没有正文、API Key 缺少修改权限）
      throw new Error(t('error_screenshot_upload', reason));
    }
    set({ successMessage: t('msg_screenshot_uploaded'), existingBookmark: null });
  },

  syncCache: async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'SYNC_CACHE' });
    } catch (error) {
      console.error('Failed to sync cache:', error);
    }
  },
});
