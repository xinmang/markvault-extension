import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import { bookmarkAPI } from './bookmark-api';
import { tagRecommender } from './tag-recommender';
import type { BookmarkInput, SaveResult } from '@/types';
import { logger } from '@/lib/utils/logger';
import { captureScreenshot, getActiveTabId, type CapturedScreenshot } from '@/background/services/screenshot';
import { prepareCaptureTab } from '@/background/services/page-capture';
import { capturePageSnapshotV2, type CapturedPageSnapshot } from './snapshot-service';

type CaptureResult<T> = { ok: true; value: T } | { ok: false; error: string };

function settleCapture<T>(task: Promise<T>): Promise<CaptureResult<T>> {
  return task.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }),
  );
}

export class BookmarkService {
  /**
   * Save bookmark to remote and local cache
   */
  async saveBookmark(bookmark: BookmarkInput): Promise<SaveResult> {
    let bookmarkId: string | undefined;
    let isExisting = false;

    // 在离屏文档创建前锁定来源标签页，截图和快照共用准备过程，并独立完成捕获。
    const sourceTabTask = bookmark.createScreenshot || bookmark.createSnapshot
      ? getActiveTabId().then(prepareCaptureTab)
      : null;
    const snapshotTask: Promise<CaptureResult<CapturedPageSnapshot>> | null =
      bookmark.createSnapshot && sourceTabTask
        ? settleCapture(sourceTabTask.then(capturePageSnapshotV2))
        : null;
    const screenshotTask: Promise<CaptureResult<CapturedScreenshot>> | null =
      bookmark.createScreenshot && sourceTabTask
        ? settleCapture(sourceTabTask.then((tabId) => captureScreenshot(tabId, { theme: bookmark.screenshotTheme ?? 'light' })))
        : null;

    logger.log('[BookmarkService] saveBookmark 开始:', {
      url: bookmark.url,
      title: bookmark.title,
      tags: bookmark.tags,
      hasThumbnail: !!bookmark.thumbnail,
      hasFavicon: !!bookmark.favicon,
      createSnapshot: bookmark.createSnapshot,
      isPublic: bookmark.is_public
    });

    try {
      // 1. Save to remote API
      logger.log('[BookmarkService] 步骤1: 调用远程 API...');
      const result = await bookmarkAPI.addBookmark(bookmark);
      bookmarkId = result.id;
      isExisting = result.isExisting || false;
      logger.log('[BookmarkService] 远程 API 返回:', { bookmarkId, isExisting });

      // If bookmark exists, return it for the dialog
      if (isExisting && result.existingBookmark) {
        logger.log('[BookmarkService] Bookmark exists, returning dialog data');
        return {
          success: true,
          existingBookmark: {
            ...result.existingBookmark,
            needsDialog: true
          },
          message: t('error_bookmark_exists')
        };
      }

      // 2. Save to local cache (only for new bookmarks)
      if (!isExisting) {
        logger.log('[BookmarkService] 步骤2: 保存到本地缓存...');
        await db.bookmarks.put({
          url: bookmark.url,
          title: bookmark.title,
          description: bookmark.description,
          tags: bookmark.tags,
          createdAt: Date.now(),
          remoteId: result.id
        });

        // 3. Update tag usage counts
        logger.log('[BookmarkService] 步骤3: 更新标签计数...');
        await this.updateTagCounts(bookmark.tags);

        // 4. Update in-memory context cache for AI
        logger.log('[BookmarkService] 步骤4: 更新 AI 上下文缓存...');
        tagRecommender.updateContextWithBookmark({
          title: bookmark.title,
          tags: bookmark.tags
        });
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error?.code || '';
      const errorStatus = error?.status || 0;
      
      // 详细打印错误信息，方便调试
      logger.error('[BookmarkService] ========== 保存书签错误 ==========');
      logger.error('[BookmarkService] 错误消息:', errorMessage);
      logger.error('[BookmarkService] 错误代码:', errorCode);
      logger.error('[BookmarkService] HTTP状态:', errorStatus);
      logger.error('[BookmarkService] 完整错误对象:', error);
      logger.error('[BookmarkService] =====================================');

      // 判断是否是认证相关错误
      const isAuthError = errorCode === 'INVALID_API_KEY' || 
                          errorCode === 'MISSING_API_KEY' ||
                          errorCode === 'INSUFFICIENT_PERMISSIONS' ||
                          errorStatus === 401 ||
                          errorStatus === 403 ||
                          errorMessage.includes('auth') ||
                          errorMessage.includes('API Key');
      
      logger.log('[BookmarkService] Is auth error:', isAuthError);
      
      // 判断是否是真正的网络错误（无法连接服务器）
      const isNetworkError = (errorCode === 'NETWORK_ERROR' || errorStatus === 0) &&
                             !isAuthError &&
                             (errorMessage.includes('Network') || 
                              errorMessage.includes('network') ||
                              errorMessage.includes('connect'));
      
      logger.log('[BookmarkService] Is network error:', isNetworkError);
      
      if (isNetworkError) {
        logger.log('[BookmarkService] >>> Entering offline queue');
        // Queue for later sync
        await this.queueForLaterSync(bookmark);

        return {
          success: true,
          offline: true,
          message: t('msg_offline_saved')
        };
      }
      
      // 对于认证错误和其他错误，直接抛出，让UI显示详细错误信息
      logger.log('[BookmarkService] >>> 直接抛出错误，不进入离线队列');
      throw error;
    }

    // 捕获互不依赖；其中一项失败时仍上传另一项，并把失败原因交给弹窗。
    let snapshotError: string | undefined;
    if (snapshotTask && bookmarkId) {
      const captured = await snapshotTask;
      if (captured.ok) {
        try {
          await bookmarkAPI.createSnapshotV2(bookmarkId, {
            html_content: captured.value.html,
            title: bookmark.title,
            url: bookmark.url,
            images: captured.value.images.map(({ hash, data, type }) => ({ hash, data, type })),
          });
        } catch (error) {
          snapshotError = error instanceof Error ? error.message : String(error);
        }
      } else {
        snapshotError = captured.error;
      }
      if (snapshotError) {
        logger.warn('[BookmarkService] 快照未能保存:', snapshotError);
      }
    }

    // 6. Upload screenshot if requested
    let screenshotError: string | undefined;
    if (screenshotTask && bookmarkId) {
      const captured = await screenshotTask;
      if (captured.ok) {
        try {
          await bookmarkAPI.uploadScreenshot(bookmarkId, {
            image: captured.value.result.dataUrl,
            width: captured.value.result.width,
            height: captured.value.result.height,
            source_url: bookmark.url,
            title: bookmark.title,
          });
        } catch (error) {
          screenshotError = error instanceof Error ? error.message : String(error);
        }
      } else {
        screenshotError = captured.error;
      }
      if (screenshotError) {
        logger.warn('[BookmarkService] 截图未能保存:', screenshotError);
      }
    }

    return {
      success: true,
      bookmarkId: bookmarkId,
      message: isExisting ? t('msg_bookmark_exists_snapshot') : undefined,
      screenshotError,
      snapshotError,
    };
  }

  /**
   * Update tag usage counts in cache
   */
  private async updateTagCounts(tagNames: string[]): Promise<void> {
    for (const tagName of tagNames) {
      const existingTag = await db.tags.where('name').equals(tagName).first();

      if (existingTag && existingTag.id) {
        // Increment count
        await db.tags.update(existingTag.id, {
          count: (existingTag.count || 0) + 1
        });
      } else {
        // Create new tag
        await db.tags.put({
          name: tagName,
          count: 1,
          createdAt: Date.now()
        });
      }
    }
  }

  /**
   * Queue bookmark for later sync (offline mode)
   */
  private async queueForLaterSync(bookmark: BookmarkInput): Promise<void> {
    await db.metadata.put({
      key: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      value: bookmark,
      updatedAt: Date.now()
    });
  }

  /**
   * Sync pending bookmarks (when back online)
   */
  async syncPendingBookmarks(): Promise<number> {
    const pending = await db.metadata
      .where('key')
      .startsWith('pending_')
      .toArray();

    let synced = 0;

    for (const item of pending) {
      try {
        // Type guard to ensure item.value is BookmarkInput
        if (item.value && typeof item.value === 'object' && 'url' in item.value && 'title' in item.value) {
          const bookmark = item.value as BookmarkInput;
          await bookmarkAPI.addBookmark(bookmark);
          await db.metadata.delete(item.key);
          synced++;
        }
      } catch (error) {
        // Silently handle error
      }
    }

    return synced;
  }

  /**
   * Get pending bookmarks count
   */
  async getPendingCount(): Promise<number> {
    const pending = await db.metadata
      .where('key')
      .startsWith('pending_')
      .count();

    return pending;
  }
}

// Singleton instance
export const bookmarkService = new BookmarkService();
