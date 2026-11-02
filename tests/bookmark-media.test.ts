import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkService } from '@/lib/services/bookmark-service';
import { bookmarkAPI } from '@/lib/services/bookmark-api';
import { captureScreenshot, getActiveTabId } from '@/background/services/screenshot';
import { prepareCaptureTab } from '@/background/services/page-capture';
import { capturePageSnapshotV2 } from '@/lib/services/snapshot-service';
import type { BookmarkInput } from '@/types';

vi.mock('@/lib/db', () => ({ db: { bookmarks: { put: vi.fn() } } }));
vi.mock('@/lib/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/lib/services/tag-recommender', () => ({ tagRecommender: { updateContextWithBookmark: vi.fn() } }));
vi.mock('@/lib/utils/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/bookmark-api', () => ({
  bookmarkAPI: { addBookmark: vi.fn(), createSnapshotV2: vi.fn(), uploadScreenshot: vi.fn() },
}));
vi.mock('@/background/services/screenshot', () => ({ captureScreenshot: vi.fn(), getActiveTabId: vi.fn() }));
vi.mock('@/background/services/page-capture', () => ({ prepareCaptureTab: vi.fn() }));
vi.mock('@/lib/services/snapshot-service', () => ({ capturePageSnapshotV2: vi.fn() }));

const input: BookmarkInput = {
  url: 'https://example.com/post', title: '同时保存截图和快照', tags: [],
  createSnapshot: true, createScreenshot: true, screenshotTheme: 'dark',
};
const snapshot = {
  html: '<html><body>文章正文</body></html>',
  images: [{ hash: 'abc123', data: 'data:image/png;base64,AA==', type: 'image/png', size: 1 }],
};
const screenshot = {
  content: { site: 'generic' as const, siteName: 'Example', url: input.url, blocks: [] },
  result: { dataUrl: 'data:image/png;base64,AA==', width: 720, height: 900, mimeType: 'image/png' as const, fileSize: 1 },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(bookmarkAPI.addBookmark).mockResolvedValue({ id: 'bookmark-1', isExisting: false });
  vi.mocked(getActiveTabId).mockResolvedValue(42);
  vi.mocked(prepareCaptureTab).mockImplementation(async (id) => id);
  vi.mocked(capturePageSnapshotV2).mockResolvedValue(snapshot);
  vi.mocked(captureScreenshot).mockResolvedValue(screenshot);
});

describe('书签媒体保存', () => {
  it('同时勾选时在同一来源标签页捕获并上传两种媒体', async () => {
    const result = await new BookmarkService().saveBookmark(input);
    expect(getActiveTabId).toHaveBeenCalledTimes(1);
    expect(prepareCaptureTab).toHaveBeenCalledExactlyOnceWith(42);
    expect(capturePageSnapshotV2).toHaveBeenCalledExactlyOnceWith(42);
    expect(captureScreenshot).toHaveBeenCalledExactlyOnceWith(42, { theme: 'dark' });
    expect(bookmarkAPI.createSnapshotV2).toHaveBeenCalledExactlyOnceWith('bookmark-1', {
      html_content: snapshot.html, title: input.title, url: input.url,
      images: [{ hash: 'abc123', data: 'data:image/png;base64,AA==', type: 'image/png' }],
    });
    expect(bookmarkAPI.uploadScreenshot).toHaveBeenCalledExactlyOnceWith('bookmark-1', {
      image: screenshot.result.dataUrl, width: 720, height: 900, source_url: input.url, title: input.title,
    });
    expect(result).toMatchObject({ success: true, bookmarkId: 'bookmark-1' });
    expect(result.snapshotError).toBeUndefined();
    expect(result.screenshotError).toBeUndefined();
  });

  it('不等待书签网络请求结束就开始两项捕获', async () => {
    let finishSave!: (value: { id: string }) => void;
    vi.mocked(bookmarkAPI.addBookmark).mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    const work = new BookmarkService().saveBookmark(input);
    await vi.waitFor(() => {
      expect(capturePageSnapshotV2).toHaveBeenCalledWith(42);
      expect(captureScreenshot).toHaveBeenCalledWith(42, { theme: 'dark' });
    });
    expect(bookmarkAPI.createSnapshotV2).not.toHaveBeenCalled();
    finishSave({ id: 'bookmark-1' });
    await work;
    expect(bookmarkAPI.createSnapshotV2).toHaveBeenCalledTimes(1);
    expect(bookmarkAPI.uploadScreenshot).toHaveBeenCalledTimes(1);
  });

  it('快照捕获失败时仍上传截图，并返回明确的快照错误', async () => {
    vi.mocked(capturePageSnapshotV2).mockRejectedValue(new Error('捕获脚本失败'));
    const result = await new BookmarkService().saveBookmark(input);
    expect(bookmarkAPI.createSnapshotV2).not.toHaveBeenCalled();
    expect(bookmarkAPI.uploadScreenshot).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, snapshotError: '捕获脚本失败' });
  });

  it('快照上传失败时仍上传截图', async () => {
    vi.mocked(bookmarkAPI.createSnapshotV2).mockRejectedValue(new Error('快照上传失败'));
    const result = await new BookmarkService().saveBookmark(input);
    expect(bookmarkAPI.uploadScreenshot).toHaveBeenCalledTimes(1);
    expect(result.snapshotError).toBe('快照上传失败');
  });

  it('截图捕获失败时仍上传快照', async () => {
    vi.mocked(captureScreenshot).mockRejectedValue(new Error('NO_CONTENT'));
    const result = await new BookmarkService().saveBookmark(input);
    expect(bookmarkAPI.createSnapshotV2).toHaveBeenCalledTimes(1);
    expect(bookmarkAPI.uploadScreenshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, screenshotError: 'NO_CONTENT' });
    expect(result.snapshotError).toBeUndefined();
  });

  it('仅选一种媒体时只捕获和上传所选类型', async () => {
    await new BookmarkService().saveBookmark({ ...input, createScreenshot: false });
    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(bookmarkAPI.uploadScreenshot).not.toHaveBeenCalled();
    expect(bookmarkAPI.createSnapshotV2).toHaveBeenCalledTimes(1);
  });

  it('均未勾选时无需查询或准备标签页', async () => {
    await new BookmarkService().saveBookmark({ ...input, createScreenshot: false, createSnapshot: false });
    expect(getActiveTabId).not.toHaveBeenCalled();
    expect(prepareCaptureTab).not.toHaveBeenCalled();
  });
});
