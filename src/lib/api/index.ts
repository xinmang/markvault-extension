/**
 * TMarks API - 统一入口
 * 导出所有 API 模块和类型
 */

import { BookmarksAPI } from './bookmarks';
import { TagsAPI } from './tags';
import { UserAPI } from './user';
import { TabGroupsAPI } from './tab-groups';
import { SnapshotsAPI } from './snapshots';
import { ScreenshotsAPI } from './screenshots';
import type { TMarksClientConfig } from './client';

/**
 * TMarks API 完整客户端
 * 整合所有功能模块
 */
export class TMarks {
  public bookmarks: BookmarksAPI;
  public tags: TagsAPI;
  public user: UserAPI;
  public tabGroups: TabGroupsAPI;
  public snapshots: SnapshotsAPI;
  public screenshots: ScreenshotsAPI;

  constructor(config: TMarksClientConfig) {
    this.bookmarks = new BookmarksAPI(config);
    this.tags = new TagsAPI(config);
    this.user = new UserAPI(config);
    this.tabGroups = new TabGroupsAPI(config);
    this.snapshots = new SnapshotsAPI(config);
    // 截图图片可达数 MB，上传超时放宽到 60 秒
    this.screenshots = new ScreenshotsAPI({ ...config, requestTimeoutMs: 60_000 });
  }

  /**
   * 获取速率限制信息（从任一模块获取）
   */
  getRateLimitInfo() {
    return this.bookmarks.getRateLimitInfo();
  }
}

/**
 * 创建 TMarks 客户端实例
 */
export function createTMarksClient(config: TMarksClientConfig): TMarks {
  return new TMarks(config);
}

// 导出所有类型
export * from './types';
export * from './client';
export { BookmarksAPI } from './bookmarks';
export { TagsAPI } from './tags';
export { UserAPI } from './user';
export { TabGroupsAPI } from './tab-groups';
export { SnapshotsAPI } from './snapshots';
export { ScreenshotsAPI } from './screenshots';
export type * from './screenshots';
export type * from './tab-groups';
export type * from './snapshots';
