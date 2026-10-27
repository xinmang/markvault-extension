import type { PageInfo } from './common';

// ============ AI Provider Types ============

export type AIProvider = 'openai' | 'claude' | 'deepseek' | 'zhipu' | 'modelscope' | 'siliconflow' | 'iflow' | 'typesafe' | 'custom';

/** 一个 AI 服务连接：服务商、接口地址与密钥 */
export interface AIServiceConnection {
  provider: AIProvider;
  /** 留空时使用服务商默认地址 */
  apiUrl: string;
  apiKey: string;
}

/**
 * AI 配置：只有一个主服务。
 * - 标签分类使用 `model`；
 * - 描述生成默认使用同一服务的 `descriptionModel`（留空则与分类模型相同）；
 * - 分类服务是 jev 这类只做判定、不生成文字的模型时，可让描述生成改用 `descriptionService`。
 */
export interface AIConfig {
  provider: AIProvider;
  apiUrl: string;
  apiKey: string;
  /** 标签分类模型 */
  model?: string;
  /** 描述生成模型 */
  descriptionModel?: string;
  /** 描述生成改用的独立服务 */
  descriptionService?: AIServiceConnection & { enabled: boolean };
  /** 描述生成的自定义提示词 */
  enableDescriptionPrompt?: boolean;
  descriptionPrompt?: string;
  customPrompt?: string;
  enableCustomPrompt?: boolean;
  maxImportGroups?: number; // AI 批量导入最多创建的分组数量，默认 7
}

/** 1.0.x 及更早版本保存的多套配置，仅用于读取时迁移 */
export interface LegacyAIConfigFields {
  apiKeys?: Partial<Record<AIProvider, string>>;
  apiUrls?: Partial<Record<AIProvider, string>>;
  savedConnections?: unknown;
}

// ============ AI Request/Response ============

export interface AIRequest {
  page: PageInfo;
  context: {
    existingTags: string[];
    recentBookmarks: Array<{
      title: string;
      tags: string[];
    }>;
  };
  options: {
    maxTags: number;
    preferExisting: boolean;
  };
}

export interface TagSuggestion {
  name: string;
  isNew: boolean;
  confidence: number;
}

export interface AIResponse {
  suggestedTags: TagSuggestion[];
  reasoning?: string;
  translatedTitle?: string;
  translatedDescription?: string;
}

export interface RecommendationResult {
  tags: TagSuggestion[];
  source: 'ai' | 'fallback';
  timestamp: number;
  message?: string | null;
  /**
   * AI 返回的中文标题。原始标题非中文时用于替换页面标题。
   */
  translatedTitle?: string;
  /**
   * AI 返回的中文描述。原始描述非中文时用于替换页面描述。
   */
  translatedDescription?: string;
}
