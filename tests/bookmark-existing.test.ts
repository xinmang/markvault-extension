import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkInput } from '@/types';

const createBookmark = vi.fn();

vi.mock('@/lib/api', () => ({
  createTMarksClient: () => ({ bookmarks: { createBookmark } }),
}));
vi.mock('@/lib/utils/storage', () => ({
  StorageService: {
    getBookmarkSiteApiUrl: async () => 'https://mv.example.com',
    getBookmarkSiteApiKey: async () => 'mvk_live_test',
  },
}));
vi.mock('@/lib/i18n', () => ({ t: (key: string) => key }));

const { BookmarkAPIClient } = await import('@/lib/services/bookmark-api');

const input: BookmarkInput = { url: 'https://example.com/post', title: '新标题', tags: ['新标签'] };

beforeEach(() => {
  createBookmark.mockReset();
  vi.stubGlobal('chrome', { tabs: { query: async () => [], sendMessage: async () => undefined } });
});

describe('保存时识别已收藏的网址', () => {
  it('MarkVault 返回 already_exists 时交给“书签已存在”对话框', async () => {
    const bookmark = {
      id: 'b1',
      title: '旧标题',
      url: input.url,
      tags: [{ id: 't1', name: '旧标签', color: null }],
      created_at: '2026-10-01T00:00:00Z',
    };
    createBookmark.mockResolvedValue({ data: { bookmark, already_exists: true, restored: false } });

    const result = await new BookmarkAPIClient().addBookmark(input);
    expect(result.isExisting).toBe(true);
    expect(result.existingBookmark).toMatchObject({ id: 'b1', title: '旧标题', tags: bookmark.tags });
  });

  it('API Key 没有读取权限、只返回 id 时补齐对话框需要的字段', async () => {
    createBookmark.mockResolvedValue({ data: { bookmark: { id: 'b2' }, already_exists: true } });

    const result = await new BookmarkAPIClient().addBookmark(input);
    expect(result.existingBookmark).toMatchObject({ id: 'b2', title: '新标题', url: input.url, tags: [] });
  });

  it('新建或从回收站恢复的书签按保存成功处理', async () => {
    createBookmark.mockResolvedValue({ data: { bookmark: { id: 'b3' }, already_exists: false, restored: true } });

    const result = await new BookmarkAPIClient().addBookmark(input);
    expect(result).toEqual({ id: 'b3', isExisting: false });
  });
});
