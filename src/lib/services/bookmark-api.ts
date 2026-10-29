import type {
  BookmarkInput,
  Tag,
  Bookmark,
  ErrorCode
} from '@/types';
import { AppError } from '@/types';
import { t } from '@/lib/i18n';
import { StorageService } from '@/lib/utils/storage';
import { createTMarksClient, type TMarksBookmark, type TMarksTag } from '@/lib/api';
import { logger } from '@/lib/utils/logger';
import { normalizeApiUrl } from '@/lib/constants/urls';
import type { BookmarkScreenshot, UploadScreenshotRequest } from '@/lib/api/screenshots';

export interface ExistingBookmarkData {
  id: string;
  title: string;
  url: string;
  description?: string;
  tags: Array<{ id: string; name: string; color: string | null }>;
  has_snapshot?: boolean;
  snapshot_count?: number;
  created_at: string;
  needsDialog?: boolean;
}

export class BookmarkAPIClient {
  private client: ReturnType<typeof createTMarksClient> | null = null;
  private webBaseUrl: string | null = null;
  private clientConfigKey: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  /**
   * 初始化 API 客户端。
   * 配置未变化时复用客户端，避免每次操作都重复读取配置和创建实例。
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeClient();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async initializeClient(): Promise<void> {
    const configuredUrl = await StorageService.getBookmarkSiteApiUrl();
    const apiKey = (await StorageService.getBookmarkSiteApiKey())?.trim();

    if (!apiKey) {
      this.client = null;
      this.clientConfigKey = null;
      throw new AppError(
        'API_KEY_INVALID' as ErrorCode,
        '未找到 API Key，请先在扩展设置中配置 MarkVault API Key。'
      );
    }

    const apiBaseUrl = normalizeApiUrl(configuredUrl || '');
    const nextConfigKey = `${apiBaseUrl}\0${apiKey}`;
    if (this.client && this.clientConfigKey === nextConfigKey) {
      return;
    }

    this.webBaseUrl = apiBaseUrl.replace(/\/api$/, '');
    this.client = createTMarksClient({
      apiKey,
      baseUrl: apiBaseUrl,
    });
    this.clientConfigKey = nextConfigKey;
    logger.log('[BookmarkAPI] API 客户端已初始化:', { apiBaseUrl });
  }

  private async notifyWebAppDataChanged(): Promise<void> {
    if (!this.webBaseUrl) {
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ url: [`${this.webBaseUrl}/*`] });
      await Promise.all(
        (tabs || [])
          .filter(t => typeof t.id === 'number')
          .map(t =>
            chrome.tabs.sendMessage(t.id as number, {
              type: 'TMARKS_WEB_DATA_CHANGED',
              payload: { timestamp: Date.now() }
            }).catch((error) => {
              logger.error('[BookmarkAPI] Failed to notify tab:', t.id, error);
            })
          )
      );
    } catch (error) {
      logger.error('[BookmarkAPI] Failed to notify web app:', error);
      // ignore
    }
  }

  private async ensureClient(): Promise<ReturnType<typeof createTMarksClient>> {
    await this.initialize();

    if (!this.client) {
      throw new AppError(
        'API_KEY_INVALID' as ErrorCode,
        'API Key not found. Failed to initialize TMarks client. Please configure your API key in the extension settings.'
      );
    }
    return this.client;
  }

  
  /**
   * Get all tags from bookmark site
   */
  async getTags(): Promise<Tag[]> {
    const client = await this.ensureClient();

    try {
      const response = await client.tags.getTags();

      // Convert TMarks API format to internal format
      if (!response?.data?.tags || !Array.isArray(response.data.tags)) {
        return [];
      }
      
      return response.data.tags.map((tag: TMarksTag) => ({
        name: tag.name,
        color: tag.color,
        count: tag.bookmark_count || 0,
        createdAt: new Date(tag.created_at).getTime()
      }));
    } catch (error) {
      const isApiKeyError = error instanceof Error && error.message.includes('API Key');
      if (isApiKeyError) {
        throw new AppError(
          'API_KEY_INVALID' as ErrorCode,
          'MarkVault API key is required. Please configure your API key in the extension settings.',
          { originalError: error }
        );
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to fetch tags: ${errorMessage}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get bookmarks with pagination (cursor-based)
   */
  async getBookmarks(cursor?: string, limit: number = 100): Promise<{
    bookmarks: Bookmark[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    const client = await this.ensureClient();

    try {
      const response = await client.bookmarks.getBookmarks({
        page_size: limit,
        page_cursor: cursor
      });

      if (!response?.data?.bookmarks || !Array.isArray(response.data.bookmarks) || !response.data.bookmarks.length) {
        return { bookmarks: [], hasMore: false };
      }

      // Convert TMarks API format to internal format
      const bookmarks = response.data.bookmarks.map((bm: TMarksBookmark) => ({
        url: bm.url,
        title: bm.title,
        description: bm.description || '',
        tags: Array.isArray(bm.tags) ? bm.tags.map((tag: TMarksTag) => tag.name) : [],
        createdAt: new Date(bm.created_at).getTime(),
        remoteId: bm.id
      }));

      return {
        bookmarks,
        hasMore: response.data.meta?.has_more ?? false,
        nextCursor: response.data.meta?.next_cursor ?? undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to fetch bookmarks: ${errorMessage}`,
        { originalError: error }
      );
    }
  }

  /**
   * 按页面匹配键判断当前页面是否已经存入 MarkVault。
   */
  async hasMatchingUrl(url: string): Promise<boolean> {
    const client = await this.ensureClient();
    return client.bookmarks.hasMatchingUrl(url);
  }

  /**
   * Add a new bookmark
   */
  async addBookmark(bookmark: BookmarkInput): Promise<{ 
    id: string; 
    isExisting?: boolean; 
    existingBookmark?: ExistingBookmarkData;
  }> {
    const client = await this.ensureClient();

    // 构建请求数据
    const requestData = {
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description,
      cover_image: bookmark.thumbnail,
      favicon: bookmark.favicon,
      tags: bookmark.tags,
      is_public: bookmark.is_public ?? true  // 默认公开，与前端保持一致
    };

    // 打印请求数据用于调试
    logger.log('[BookmarkAPI] addBookmark 请求数据:', JSON.stringify(requestData, null, 2));

    try {
      // 直接传标签名称，让后端自动创建或链接标签
      const response = await client.bookmarks.createBookmark(requestData);

      logger.log('[BookmarkAPI] addBookmark 响应:', JSON.stringify(response, null, 2));

      if (!response.data.bookmark) {
        logger.error('[BookmarkAPI] addBookmark 失败: 响应中没有 bookmark 数据', response);
        throw new AppError(
          'BOOKMARK_SITE_ERROR' as ErrorCode,
          'Failed to add bookmark: No data returned'
        );
      }

      // MarkVault 对已收藏的网址返回 already_exists 且不修改原书签（旧版接口用 meta.code 表示），
      // 交给“书签已存在”对话框让用户选择更新标签、描述或补充快照与截图
      const isExisting = response.data.already_exists === true || response.meta?.code === 'BOOKMARK_EXISTS';
      if (isExisting) {
        const existing = response.data.bookmark;
        logger.log('[BookmarkAPI] 书签已存在:', existing.id);
        await this.notifyWebAppDataChanged();
        // Return the full bookmark data for the dialog
        return {
          id: existing.id,
          isExisting,
          // 缺少 bookmarks.read 权限时只返回 id，补齐对话框需要的字段
          existingBookmark: {
            ...existing,
            title: existing.title || bookmark.title,
            url: existing.url || bookmark.url,
            tags: Array.isArray(existing.tags) ? existing.tags : [],
          }
        };
      } else {
        logger.log('[BookmarkAPI] 书签创建成功:', response.data.bookmark.id);
        await this.notifyWebAppDataChanged();
        return { 
          id: response.data.bookmark.id,
          isExisting 
        };
      }
    } catch (error: any) {
      // 详细记录错误信息
      logger.error('[BookmarkAPI] addBookmark 错误:', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response,
        stack: error.stack
      });
      
      // 根据错误类型提供更友好的错误信息
      let friendlyMessage: string;
      const errorCode = error.code || '';
      const errorStatus = error.status || 0;
      
      if (errorCode === 'INVALID_API_KEY' || errorCode === 'MISSING_API_KEY' || errorStatus === 401) {
        friendlyMessage = t('error_auth_failed');
      } else if (errorCode === 'INSUFFICIENT_PERMISSIONS' || errorStatus === 403) {
        friendlyMessage = t('error_permission_save_bookmark');
      } else if (errorCode === 'RATE_LIMIT_EXCEEDED' || errorStatus === 429) {
        friendlyMessage = t('error_rate_limit');
      } else if (errorCode === 'NETWORK_ERROR' || errorStatus === 0) {
        friendlyMessage = t('error_network_error');
      } else if (errorStatus >= 500) {
        friendlyMessage = t('error_server_error');
      } else {
        friendlyMessage = error.message || t('error_save_bookmark_failed');
      }
      
      // 创建带有详细信息的错误
      const appError = new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        friendlyMessage,
        { originalError: error }
      );
      
      // 附加原始错误代码，便于上层判断
      interface ExtendedError {
        code?: string;
        status?: number;
      }
      (appError as unknown as ExtendedError).code = errorCode;
      (appError as unknown as ExtendedError).status = errorStatus;
      
      throw appError;
    }
  }

  /**
   * Update bookmark tags
   */
  async updateBookmarkTags(bookmarkId: string, tags: string[]): Promise<void> {
    const client = await this.ensureClient();

    try {

      // 调用更新 API，直接传标签名称
      await client.bookmarks.updateBookmark(bookmarkId, {
        tags  // 后端会自动处理标签创建和链接
      });

      await this.notifyWebAppDataChanged();
    } catch (error: any) {
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to update tags: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Update bookmark description
   */
  async updateBookmarkDescription(bookmarkId: string, description: string): Promise<void> {
    const client = await this.ensureClient();

    try {
      // 调用更新 API
      await client.bookmarks.updateBookmark(bookmarkId, {
        description
      });

      await this.notifyWebAppDataChanged();
    } catch (error: any) {
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to update description: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Create a snapshot for a bookmark
   */
  async createSnapshot(
    bookmarkId: string,
    data: {
      html_content: string;
      title: string;
      url: string;
    }
  ): Promise<void> {
    const client = await this.ensureClient();

    try {
      await client.snapshots.createSnapshot(bookmarkId, data);

      await this.notifyWebAppDataChanged();
    } catch (error: any) {
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to create snapshot: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Create a snapshot for a bookmark (V2 - with separate images)
   */
  async createSnapshotV2(
    bookmarkId: string,
    data: {
      html_content: string;
      title: string;
      url: string;
      images: Array<{
        hash: string;
        data: string;
        type: string;
      }>;
    }
  ): Promise<void> {
    const client = await this.ensureClient();

    try {
      await client.snapshots.createSnapshotV2(bookmarkId, data);
      await this.notifyWebAppDataChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '快照创建失败';
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `创建快照失败（V2）：${message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Test API connection
   */
  /**
   * 上传网站截图（同一书签只保留最新一张）
   */
  async uploadScreenshot(bookmarkId: string, data: UploadScreenshotRequest): Promise<BookmarkScreenshot> {
    const client = await this.ensureClient();

    try {
      const response = await client.screenshots.uploadScreenshot(bookmarkId, data);
      await this.notifyWebAppDataChanged();
      return response.data.screenshot;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '截图上传失败';
      throw new AppError('BOOKMARK_SITE_ERROR' as ErrorCode, message, { originalError: error });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      await client.user.getMe(); // Test with a lightweight API call
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const bookmarkAPI = new BookmarkAPIClient();
