// ============ Bookmark Models ============

export interface Tag {
  id?: number;
  name: string;
  color?: string;
  count?: number;
  createdAt: number;
}

// ExistingTag 用于 UI 显示（从 API 返回）
export interface ExistingTag {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface Bookmark {
  id?: number;
  url: string;
  title: string;
  description?: string;
  tags: string[];
  createdAt: number;
  remoteId?: string;
}

export interface BookmarkInput {
  url: string;
  title: string;
  description?: string;
  tags: string[];
  thumbnail?: string;
  favicon?: string;
  createSnapshot?: boolean;
  /** 保存后生成网站截图（帖子正文的图文卡片） */
  createScreenshot?: boolean;
  /** 截图使用的配色，由弹窗按系统主题解析 */
  screenshotTheme?: 'light' | 'dark';
  is_public?: boolean;
}

export interface SaveResult {
  success: boolean;
  bookmarkId?: string;
  existingBookmark?: {
    id: string;
    title: string;
    url: string;
    tags: Array<{ id: string; name: string; color: string | null }>;
    has_snapshot?: boolean;
    snapshot_count?: number;
    created_at: string;
    needsDialog?: boolean;
  };
  offline?: boolean;
  message?: string;
  /** 书签已保存但截图生成或上传失败时的原因 */
  screenshotError?: string;
  error?: string;
}
