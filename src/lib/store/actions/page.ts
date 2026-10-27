/**
 * Page 相关 actions
 */

import type { PageInfo, Message, StorageConfig } from '@/types';
import { t } from '@/lib/i18n';
import { getFallbackDescription, normalizePageText } from '@/lib/utils/page-description';
import { defaultCreateScreenshot } from '@/lib/utils/screenshot-prefs';

export interface PageActions {
  currentPage: PageInfo | null;
  pageRevision: number;
  setCurrentPage: (page: PageInfo | null) => void;
  extractPageInfo: () => Promise<void>;
}

type PageState = PageActions & {
  config: StorageConfig | null;
  includeThumbnail: boolean;
  createScreenshot: boolean;
  isPublic: boolean;
};

/** 更换页面时清理属于上一个页面的推荐和提示。 */
const resetPageFeedback = () => ({
  recommendedTags: [],
  selectedTags: [],
  existingBookmark: null,
  isRecommending: false,
  error: null,
  successMessage: null,
  loadingMessage: null,
  lastRecommendationSource: null,
  lastRecommendationMessage: null,
  lastRecommendationDurationMs: null,
  descriptionStatus: 'idle',
  descriptionMessage: null,
});

export const createPageActions = (set: any, get: () => PageState): PageActions => ({
  currentPage: null,
  pageRevision: 0,
  setCurrentPage: (page) => set((state: PageState) => {
    const isSamePage = Boolean(state.currentPage && page && state.currentPage.url === page.url);
    const defaultIncludeThumbnail = state.config?.preferences.defaultIncludeThumbnail ?? true;
    const defaultIsPublic = state.config?.preferences.defaultIsPublic ?? true;

    return {
      ...(!isSamePage ? { ...resetPageFeedback(), isLoading: false } : {}),
      currentPage: page,
      pageRevision: isSamePage ? state.pageRevision : state.pageRevision + 1,
      includeThumbnail: Boolean(page?.thumbnail) && (isSamePage ? state.includeThumbnail : defaultIncludeThumbnail),
      // 截图网站列表中的页面（如 x.com、linux.do）默认生成网站截图
      createScreenshot: isSamePage
        ? state.createScreenshot
        : Boolean(page && state.config && defaultCreateScreenshot(page.url, state.config.preferences)),
      isPublic: isSamePage ? state.isPublic : defaultIsPublic,
    };
  }),

  extractPageInfo: async () => {
    // 即使再次提取同一网址，也使上次提取和推荐失效。
    get().setCurrentPage(null);
    const revision = get().pageRevision;
    set({ isLoading: true, error: null });
    try {
      const response = await chrome.runtime.sendMessage<Message, any>({
        type: 'EXTRACT_PAGE_INFO',
      });
      if (get().pageRevision !== revision) return;
      if (response?.success === false) {
        throw new Error(response.error || t('error_extract_failed'));
      }

      const pageInfo: PageInfo = response?.data || response;
      if (!pageInfo || typeof pageInfo.url !== 'string' || !pageInfo.url.trim() || typeof pageInfo.title !== 'string') {
        throw new Error(t('error_extract_failed'));
      }
      get().setCurrentPage({
        ...pageInfo,
        description: normalizePageText(pageInfo.description) || getFallbackDescription(pageInfo),
      });
      set({ isLoading: false });
    } catch (err) {
      if (get().pageRevision !== revision) return;
      set({
        error: err instanceof Error ? err.message : t('error_extract_failed'),
        isLoading: false,
      });
    }
  },
});
