import type { StorageConfig, AIProvider, AIConfig } from '@/types';
import type { LegacyAIConfigFields } from '@/types/ai';
import { NEWTAB_FOLDER_PROMPT_TEMPLATE } from '@/lib/constants/newtabPrompts';

/** 默认开启网站截图的网站：帖子正文比网页样式更重要的社区 */
export const DEFAULT_SCREENSHOT_DOMAINS = ['x.com', 'twitter.com', 'linux.do'];

const DEFAULT_CONFIG: StorageConfig = {
  aiConfig: {
    provider: 'openai',
    apiUrl: '',
    apiKey: '',
    model: 'gpt-4o',
    descriptionModel: '',
    descriptionService: { enabled: false, provider: 'deepseek', apiUrl: '', apiKey: '' },
    enableDescriptionPrompt: false,
    descriptionPrompt: undefined,
    enableCustomPrompt: false,
    customPrompt: undefined,
  },
  bookmarkSite: {
    apiUrl: '',
    apiKey: ''
  },
  preferences: {
    theme: 'auto',
    themeStyle: 'default',
    autoSync: true,
    syncInterval: 24,
    maxSuggestedTags: 5,
    enableAI: true,
    defaultIncludeThumbnail: true,
    defaultCreateSnapshot: false,
    defaultIsPublic: true,
    tagTheme: 'classic',
    newtabFolderRecommendCount: 15,
    enableNewtabAI: true,
    enableNewtabFolderPrompt: false,
    newtabFolderPrompt: NEWTAB_FOLDER_PROMPT_TEMPLATE,
    enableAIDescription: true,
    defaultCreateScreenshot: false,
    screenshotDomains: [...DEFAULT_SCREENSHOT_DOMAINS],
    screenshotTheme: 'auto'
  }
};

const cloneDefaultConfig = (): StorageConfig => ({
  aiConfig: {
    ...DEFAULT_CONFIG.aiConfig,
    descriptionService: { ...DEFAULT_CONFIG.aiConfig.descriptionService! }
  },
  bookmarkSite: { ...DEFAULT_CONFIG.bookmarkSite },
  preferences: {
    ...DEFAULT_CONFIG.preferences,
    screenshotDomains: [...(DEFAULT_CONFIG.preferences.screenshotDomains || [])]
  }
});

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 规范化域名列表：去协议、路径与 www.，转小写并去重 */
export function normalizeScreenshotDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const domain = text(item)
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .replace(/[/?#].*$/, '')
      .replace(/^www\./, '')
      .replace(/^\*\./, '');
    if (domain && /^[a-z0-9.-]+$/.test(domain) && domain.length <= 253) seen.add(domain);
  }
  return [...seen].slice(0, 100);
}

/**
 * 读取 AI 配置并兼容旧版：旧版按服务商保存多套密钥与地址（apiKeys / apiUrls）以及“已保存配置”，
 * 现在只保留当前服务商的一套连接，其余旧数据在下次保存时自然丢弃。
 */
function normalizeAIConfig(input: (Partial<AIConfig> & LegacyAIConfigFields) | undefined, defaults: AIConfig): AIConfig {
  const provider = (input?.provider || defaults.provider) as AIProvider;
  const legacyKey = text(input?.apiKeys?.[provider]);
  const legacyUrl = text(input?.apiUrls?.[provider]);
  const service = input?.descriptionService;
  return {
    provider,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey : legacyKey,
    apiUrl: typeof input?.apiUrl === 'string' ? input.apiUrl : legacyUrl,
    model: input?.model ?? defaults.model,
    descriptionModel: text(input?.descriptionModel),
    descriptionService: {
      enabled: Boolean(service?.enabled),
      provider: (service?.provider || defaults.descriptionService!.provider) as AIProvider,
      apiUrl: text(service?.apiUrl),
      apiKey: text(service?.apiKey)
    },
    enableDescriptionPrompt: input?.enableDescriptionPrompt ?? defaults.enableDescriptionPrompt,
    descriptionPrompt: input?.descriptionPrompt ?? defaults.descriptionPrompt,
    customPrompt: input?.customPrompt ?? defaults.customPrompt,
    enableCustomPrompt: input?.enableCustomPrompt ?? defaults.enableCustomPrompt,
    ...(input?.maxImportGroups !== undefined ? { maxImportGroups: input.maxImportGroups } : {})
  };
}

export class StorageService {
  private static STORAGE_KEY = 'config';
  private static configCache: StorageConfig | null = null;
  private static initialized = false;

  static mergeWithDefaults(config?: StorageConfig): StorageConfig {
    const defaults = cloneDefaultConfig();
    if (!config) {
      return defaults;
    }

    const preferences = { ...defaults.preferences, ...(config.preferences || {}) };
    preferences.screenshotDomains = Array.isArray(config.preferences?.screenshotDomains)
      ? normalizeScreenshotDomains(config.preferences.screenshotDomains)
      : defaults.preferences.screenshotDomains;

    return {
      aiConfig: normalizeAIConfig(config.aiConfig, defaults.aiConfig),
      bookmarkSite: {
        apiUrl: config.bookmarkSite?.apiUrl ?? defaults.bookmarkSite.apiUrl,
        apiKey: config.bookmarkSite?.apiKey ?? defaults.bookmarkSite.apiKey
      },
      preferences
    };
  }

  private static ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const change = changes[this.STORAGE_KEY];
      if (!change) {
        return;
      }

      this.configCache = this.mergeWithDefaults(change.newValue as StorageConfig | undefined);
    });

    this.initialized = true;
  }

  /**
   * Load configuration from chrome.storage.local
   */
  static async loadConfig(): Promise<StorageConfig> {
    this.ensureInitialized();

    if (this.configCache) {
      return this.configCache;
    }

    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const config = this.mergeWithDefaults(result[this.STORAGE_KEY] as StorageConfig | undefined);
      this.configCache = config;
      return config;
    } catch (error) {
      const fallback = cloneDefaultConfig();
      this.configCache = fallback;
      return fallback;
    }
  }

  /**
   * Save configuration to chrome.storage.local
   * 写入的始终是规范化后的完整配置，旧版的多套配置字段不会再写回。
   */
  static async saveConfig(config: Partial<StorageConfig>): Promise<void> {
    const currentConfig = await this.loadConfig();
    const newConfig = this.mergeWithDefaults({
      aiConfig: { ...currentConfig.aiConfig, ...(config.aiConfig || {}) },
      bookmarkSite: { ...currentConfig.bookmarkSite, ...(config.bookmarkSite || {}) },
      preferences: { ...currentConfig.preferences, ...(config.preferences || {}) }
    });

    await chrome.storage.local.set({ [this.STORAGE_KEY]: newConfig });
    this.configCache = newConfig;
  }

  /**
   * Get bookmark site API key
   */
  static async getBookmarkSiteApiKey(): Promise<string> {
    const config = await this.loadConfig();
    return config.bookmarkSite.apiKey;
  }

  /**
   * Get bookmark site API URL
   */
  static async getBookmarkSiteApiUrl(): Promise<string> {
    const config = await this.loadConfig();
    return config.bookmarkSite.apiUrl;
  }

  /**
   * Get TMarks configuration (API URL and API Key)
   */
  static async getTMarksConfig(): Promise<{ bookmarkApiUrl: string; bookmarkApiKey: string }> {
    const config = await this.loadConfig();
    return {
      bookmarkApiUrl: config.bookmarkSite.apiUrl,
      bookmarkApiKey: config.bookmarkSite.apiKey
    };
  }

  /**
   * Clear all stored data
   */
  static async clear(): Promise<void> {
    await chrome.storage.local.clear();
    this.configCache = null;
  }
}
