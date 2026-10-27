/**
 * MarkVault Screenshots API
 * 网站截图（帖子正文卡片图片）相关接口
 */

import { TMarksClient } from './client';

export interface BookmarkScreenshot {
  id: string;
  /** 带签名的图片地址（相对 MarkVault 站点根路径） */
  url: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface UploadScreenshotRequest {
  /** data:image/webp;base64,… */
  image: string;
  width: number;
  height: number;
  source_url: string;
  title: string;
}

export interface UploadScreenshotResponse {
  data: {
    screenshot: BookmarkScreenshot;
  };
}

export class ScreenshotsAPI extends TMarksClient {
  /**
   * 上传书签截图；同一书签只保留最新一张
   * POST /api/tab/bookmarks/:id/screenshots
   */
  async uploadScreenshot(bookmarkId: string, data: UploadScreenshotRequest): Promise<UploadScreenshotResponse> {
    return this.post<UploadScreenshotResponse>(`/tab/bookmarks/${encodeURIComponent(bookmarkId)}/screenshots`, data);
  }
}
