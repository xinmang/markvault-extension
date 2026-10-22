import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createPageActions, type PageActions } from '@/lib/store/actions/page';
import { createRecommendActions, type RecommendActions } from '@/lib/store/actions/recommend';
import { createUIActions, type UIActions } from '@/lib/store/actions/ui';
import { createTagActions, type TagActions } from '@/lib/store/actions/tags';
import { createBookmarkActions, type BookmarkActions } from '@/lib/store/actions/bookmark';
import type { PageInfo, StorageConfig } from '@/types';

vi.mock('@/lib/i18n', () => ({ t: (key: string) => key }));

type TestState = PageActions & RecommendActions & UIActions & TagActions & BookmarkActions & { config: StorageConfig | null };
const pageA: PageInfo = { url: 'https://example.com/a', title: '页面 A', description: '页面 A 的原始描述' };
const pageB: PageInfo = { url: 'https://example.com/b', title: '页面 B', description: '页面 B 的原始描述' };
const sendMessage = vi.fn();

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createTestStore() {
  const store = createStore<TestState>((set, get) => ({
    ...createUIActions(set),
    ...createPageActions(set, get),
    ...createTagActions(set, get),
    ...createRecommendActions(set, get),
    ...createBookmarkActions(set, get),
    config: null,
  }));
  store.getState().setCurrentPage({ ...pageA });
  return store;
}

const recommendation = (description: string) => ({
  success: true,
  data: {
    tags: [{ name: '开发', isNew: false, confidence: 0.9 }],
    source: 'ai', translatedTitle: 'AI 中文标题', translatedDescription: description,
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  sendMessage.mockReset();
  vi.stubGlobal('chrome', { runtime: { sendMessage }, notifications: { create: vi.fn() } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AI 推荐回填', () => {
  it('切换页面后丢弃旧页面的描述、标签和完成提示', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageB });
    pending.resolve(recommendation('页面 A 的 AI 描述'));
    await work;
    expect(store.getState().currentPage).toEqual(pageB);
    expect(store.getState().selectedTags).toEqual([]);
    expect(store.getState().successMessage).toBeNull();
    expect(store.getState().isRecommending).toBe(false);
  });

  it('切到其他页面再返回原网址，也不接受上次会话的结果', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageB });
    store.getState().setCurrentPage({ ...pageA });
    pending.resolve(recommendation('旧会话描述'));
    await work;
    expect(store.getState().currentPage).toEqual(pageA);
  });

  it('旧请求失败不会污染新页面的错误状态', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageB });
    pending.reject(new Error('旧请求失败'));
    await work;
    expect(store.getState().error).toBeNull();
  });

  it('同一页面的多次推荐乱序返回时保留最新请求结果', async () => {
    const first = deferred();
    const second = deferred();
    sendMessage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createTestStore();
    const firstWork = store.getState().recommendTags();
    const secondWork = store.getState().recommendTags();
    second.resolve(recommendation('最新描述'));
    await secondWork;
    first.resolve(recommendation('过期描述'));
    await firstWork;
    expect(store.getState().currentPage?.description).toBe('最新描述');
  });

  it('保留用户编辑的标题和描述，保存时发送这些值', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageA, title: '我的标题', description: '我的描述' });
    pending.resolve(recommendation('AI 描述'));
    await work;
    sendMessage.mockResolvedValueOnce({ success: true, data: { success: true } });
    await store.getState().saveBookmark();
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'SAVE_BOOKMARK',
      payload: expect.objectContaining({ url: pageA.url, title: '我的标题', description: '我的描述' }),
    }));
  });

  it('只编辑标题时仍可回填未编辑的描述', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageA, title: '我的标题' });
    pending.resolve(recommendation('当前页面的中文描述'));
    await work;
    expect(store.getState().currentPage).toMatchObject({ title: '我的标题', description: '当前页面的中文描述' });
  });

  it('保留用户主动清空的描述', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise);
    const store = createTestStore();
    const work = store.getState().recommendTags();
    store.getState().setCurrentPage({ ...pageA, description: undefined });
    pending.resolve(recommendation('AI 描述'));
    await work;
    expect(store.getState().currentPage?.description).toBeUndefined();
  });

  it('翻译字段是占位字符串时不覆盖当前有效描述', async () => {
    sendMessage.mockResolvedValueOnce({
      success: true,
      data: {
        tags: [{ name: '开发', isNew: false, confidence: 0.9 }],
        source: 'ai',
        translatedTitle: 'undefined',
        translatedDescription: 'null',
      },
    });
    const store = createTestStore();
    await store.getState().recommendTags();
    expect(store.getState().currentPage).toEqual(pageA);
  });

  it('翻译字段是空占位或英文回填时保留当前有效描述', async () => {
    sendMessage.mockResolvedValueOnce({
      success: true,
      data: {
        tags: [{ name: '开发', isNew: false, confidence: 0.9 }],
        source: 'ai',
        translatedTitle: '暂无标题',
        translatedDescription: 'This page has not been translated.',
      },
    });
    const store = createTestStore();
    await store.getState().recommendTags();
    expect(store.getState().currentPage).toEqual(pageA);
  });

  it('有效中文翻译仍会覆盖未编辑的描述', async () => {
    sendMessage.mockResolvedValueOnce(recommendation('当前页面的中文描述'));
    const store = createTestStore();
    await store.getState().recommendTags();
    expect(store.getState().currentPage).toMatchObject({
      title: 'AI 中文标题',
      description: '当前页面的中文描述',
    });
  });

  it('纯分类模型没有翻译字段时保留网页描述', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: { tags: [], source: 'ai' } });
    const store = createTestStore();
    await store.getState().recommendTags();
    expect(store.getState().currentPage).toEqual(pageA);
  });

  it('后台失败不会被误报为推荐完成', async () => {
    sendMessage.mockResolvedValueOnce({ success: false, error: '服务暂不可用' });
    const store = createTestStore();
    await store.getState().recommendTags();
    expect(store.getState().error).toBe('服务暂不可用');
    expect(store.getState().successMessage).toBeNull();
  });
});

describe('页面提取状态', () => {
  it('提取乱序完成时只保留最新页面', async () => {
    const first = deferred();
    const second = deferred();
    sendMessage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createTestStore();
    const firstWork = store.getState().extractPageInfo();
    const secondWork = store.getState().extractPageInfo();
    second.resolve({ success: true, data: pageB });
    await secondWork;
    first.resolve({ success: true, data: pageA });
    await firstWork;
    expect(store.getState().currentPage).toEqual(pageB);
  });

  it('提取失败时不留下可误存的旧页面和标签', async () => {
    sendMessage.mockResolvedValueOnce({ success: false, error: '提取失败' });
    const store = createTestStore();
    store.getState().addCustomTag('旧标签');
    await store.getState().extractPageInfo();
    expect(store.getState().currentPage).toBeNull();
    expect(store.getState().selectedTags).toEqual([]);
    expect(store.getState().error).toBe('提取失败');
  });

  it('空描述使用同一页面的正文兜底', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, data: { ...pageB, description: ' ', content: '页面 B 的正文' } });
    const store = createTestStore();
    await store.getState().extractPageInfo();
    expect(store.getState().currentPage?.description).toBe('页面 B 的正文');
  });

  it('重新提取时同时使尚未完成的推荐失效', async () => {
    const pending = deferred();
    sendMessage.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ success: true, data: pageA });
    const store = createTestStore();
    const work = store.getState().recommendTags();
    await store.getState().extractPageInfo();
    pending.resolve(recommendation('提取前的旧描述'));
    await work;
    expect(store.getState().currentPage).toEqual(pageA);
  });
});
