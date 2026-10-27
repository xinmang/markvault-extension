/**
 * AI 推荐相关 actions
 */

import type { Message } from '@/types';
import { t } from '@/lib/i18n';
import { normalizeTranslatedText } from '@/lib/utils/text';

export type DescriptionStatus = 'idle' | 'generating' | 'done' | 'failed';

export interface RecommendActions {
  recommendTags: () => Promise<void>;
  /** 描述模型生成描述的进度，供弹窗显示 */
  descriptionStatus: DescriptionStatus;
  descriptionMessage: string | null;
  generateDescription: () => Promise<void>;
}

export const createRecommendActions = (set: any, get: any): RecommendActions => {
  let latestRequestId = 0;
  let latestDescriptionRequestId = 0;

  return {
    descriptionStatus: 'idle',
    descriptionMessage: null,

    generateDescription: async () => {
      const { currentPage, pageRevision } = get();
      if (!currentPage) return;

      const requestId = ++latestDescriptionRequestId;
      const isCurrentRequest = () => requestId === latestDescriptionRequestId
        && get().pageRevision === pageRevision
        && get().currentPage?.url === currentPage.url;

      set({ descriptionStatus: 'generating', descriptionMessage: null });
      try {
        const response = await chrome.runtime.sendMessage<Message, any>({
          type: 'GENERATE_DESCRIPTION',
          payload: currentPage
        });
        if (!isCurrentRequest()) return;
        if (response?.success === false) {
          throw new Error(response.error || t('options_test_description_empty'));
        }

        const data = response?.data as { description?: string; title?: string } | null | undefined;
        if (!data) {
          // 未配置描述模型：保持原描述，不显示状态
          set({ descriptionStatus: 'idle' });
          return;
        }

        const description = normalizeTranslatedText(data.description);
        const title = normalizeTranslatedText(data.title);
        // 只回填仍与请求原文一致的字段，保留等待期间用户手动修改的内容
        const latestPage = get().currentPage;
        if (latestPage && (description || title)) {
          set({
            currentPage: {
              ...latestPage,
              title: latestPage.title === currentPage.title ? title || latestPage.title : latestPage.title,
              description: latestPage.description === currentPage.description
                ? description || latestPage.description : latestPage.description
            }
          });
        }
        set({
          descriptionStatus: description ? 'done' : 'failed',
          descriptionMessage: description ? null : t('options_test_description_empty')
        });
      } catch (error) {
        if (!isCurrentRequest()) return;
        set({
          descriptionStatus: 'failed',
          descriptionMessage: error instanceof Error ? error.message : t('options_test_description_empty')
        });
      }
    },

    recommendTags: async () => {
      const { currentPage, pageRevision } = get();

      if (!currentPage) {
        set({ error: t('error_no_page_info') });
        return;
      }

      const startTime = Date.now();
      const requestId = ++latestRequestId;
      const isCurrentRequest = () => requestId === latestRequestId
        && get().pageRevision === pageRevision
        && get().currentPage?.url === currentPage.url;

      try {
        set({
          isLoading: true,
          isRecommending: true,
          error: null,
          successMessage: null,
          lastRecommendationSource: null,
          lastRecommendationMessage: null,
          lastRecommendationDurationMs: null
        });

        const response = await chrome.runtime.sendMessage<Message, any>({
          type: 'RECOMMEND_TAGS',
          payload: currentPage
        });

        // 页面切换或新请求发出后，旧结果（包括错误）不能再写入当前状态。
        if (!isCurrentRequest()) return;
        if (response?.success === false) {
          throw new Error(response.error || t('error_recommend_tags'));
        }
        const result = response?.data || response;
        if (!Array.isArray(result?.tags)) {
          throw new Error(t('error_recommend_tags'));
        }

        const endTime = Date.now();
        const elapsedMs = endTime - startTime;

        // Auto-select all recommended tags
        const autoSelectedTags = Array.isArray(result?.tags) ? result.tags.map((t: any) => t.name) : [];

        const baseState = {
          recommendedTags: Array.isArray(result?.tags) ? result.tags : [],
          selectedTags: autoSelectedTags,
          isLoading: false,
          isRecommending: false,
          lastRecommendationSource: result?.source || 'unknown',
          lastRecommendationMessage: result?.message || null,
          lastRecommendationDurationMs: elapsedMs
        };

        if (result?.source === 'fallback') {
          set({
            ...baseState,
            error: result.message
              ? t('error_ai_recommend_fallback_with_msg', result.message)
              : t('error_ai_recommend_fallback')
          });
        } else {
          set({
            ...baseState,
            error: null
          });

          // 只回填仍与请求原文一致的字段，保留等待期间用户手动修改的内容。
          const latestPage = get().currentPage;
          // 复用统一归一化：null/undefined/暂无描述等占位值以及非中文回填都视为不可用，
          // 不能覆盖用户当前已确认的有效标题和描述。
          const translatedTitle = normalizeTranslatedText(result?.translatedTitle);
          const translatedDescription = normalizeTranslatedText(result?.translatedDescription);

          if (latestPage && (translatedTitle || translatedDescription)) {
            set({
              currentPage: {
                ...latestPage,
                title: latestPage.title === currentPage.title
                  ? translatedTitle || latestPage.title : latestPage.title,
                description: latestPage.description === currentPage.description
                  ? translatedDescription || latestPage.description : latestPage.description
              }
            });
          }

          // 0 个标签时不要报“推荐完成”——那会让用户以为功能坏了却没有任何线索。
          // TypeSafe 这类“只从标签库分拣”的引擎，标签库为空或确实无匹配时就会是 0 个。
          const aiMessage =
            autoSelectedTags.length === 0
              ? t('msg_ai_recommend_empty')
              : t('msg_ai_recommend_complete', (elapsedMs / 1000).toFixed(2));
          set({ successMessage: aiMessage });
          setTimeout(() => {
            if (isCurrentRequest() && get().successMessage === aiMessage) {
              set({ successMessage: null });
            }
          }, 4000);
        }
      } catch (error) {
        if (!isCurrentRequest()) return;
        const elapsedMs = Date.now() - startTime;
        set({
          error: error instanceof Error ? error.message : t('error_recommend_tags'),
          isLoading: false,
          isRecommending: false,
          lastRecommendationSource: null,
          lastRecommendationMessage: null,
          lastRecommendationDurationMs: elapsedMs
        });
      }
    },
  };
};
