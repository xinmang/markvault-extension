import type { AIProvider, StorageConfig } from '@/types';

/** 解析后可直接调用的 AI 连接 */
export interface ResolvedAIConnection {
  provider: AIProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}

/**
 * 只做判定、不能生成文字的服务商（TypeSafe 的 jev 系列）。
 * 这类服务适合标签分类，但不能用来写书签描述。
 */
export function canGenerateText(provider: AIProvider): boolean {
  return provider !== 'typesafe';
}

/** 标签分类使用主服务与分类模型；没有密钥时视为未配置 */
export function getTagConnection(config: StorageConfig): ResolvedAIConnection | null {
  const { aiConfig } = config;
  const apiKey = aiConfig.apiKey.trim();
  if (!apiKey) return null;
  return {
    provider: aiConfig.provider,
    apiKey,
    apiUrl: aiConfig.apiUrl.trim() || undefined,
    model: aiConfig.model?.trim() || undefined,
  };
}

/**
 * 描述生成：开启独立服务时用独立服务，否则用主服务。
 * 模型优先取“描述模型”，留空时沿用分类模型；所选服务不能生成文字时返回 null。
 */
export function getDescriptionConnection(config: StorageConfig): ResolvedAIConnection | null {
  const { aiConfig } = config;
  const service = aiConfig.descriptionService;
  if (service?.enabled) {
    const apiKey = service.apiKey.trim();
    if (!apiKey || !canGenerateText(service.provider)) return null;
    return {
      provider: service.provider,
      apiKey,
      apiUrl: service.apiUrl.trim() || undefined,
      model: aiConfig.descriptionModel?.trim() || undefined,
    };
  }

  const primary = getTagConnection(config);
  if (!primary || !canGenerateText(primary.provider)) return null;
  return { ...primary, model: aiConfig.descriptionModel?.trim() || primary.model };
}

/** 是否需要单独调用描述模型（开启了 AI 描述且有可生成文字的连接） */
export function isDescriptionAIActive(config: StorageConfig): boolean {
  return config.preferences.enableAIDescription !== false && getDescriptionConnection(config) !== null;
}

/** 是否已配置 AI（主服务有密钥） */
export function isAIConfigured(config: StorageConfig | null | undefined): boolean {
  return Boolean(config && getTagConnection(config));
}
