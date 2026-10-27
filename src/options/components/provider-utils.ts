/**
 * AI 服务商相关的共享小工具：名称、默认地址、密钥占位符
 */

import { t } from '@/lib/i18n';
import { AI_SERVICE_URLS } from '@/lib/constants/urls';
import type { AIProvider } from '@/types';

export const AI_PROVIDERS: AIProvider[] = [
  'openai',
  'claude',
  'deepseek',
  'zhipu',
  'modelscope',
  'siliconflow',
  'iflow',
  'typesafe',
  'custom',
];

const PROVIDER_NAME_KEYS: Record<AIProvider, string> = {
  openai: 'provider_openai',
  claude: 'provider_claude',
  deepseek: 'provider_deepseek',
  zhipu: 'provider_zhipu',
  modelscope: 'provider_modelscope',
  siliconflow: 'provider_siliconflow',
  iflow: 'provider_iflow',
  typesafe: 'provider_typesafe',
  custom: 'provider_custom',
};

const PROVIDER_KEY_PLACEHOLDER_KEYS: Record<AIProvider, string> = {
  openai: 'options_api_key_placeholder_openai',
  claude: 'options_api_key_placeholder_claude',
  deepseek: 'options_api_key_placeholder_deepseek',
  zhipu: 'options_api_key_placeholder_zhipu',
  modelscope: 'options_api_key_placeholder_modelscope',
  siliconflow: 'options_api_key_placeholder_siliconflow',
  iflow: 'options_api_key_placeholder_iflow',
  typesafe: 'options_api_key_placeholder_typesafe',
  custom: 'options_api_key_placeholder_custom',
};

/** 服务商默认 API 地址；自定义服务没有默认值 */
export function getDefaultApiUrl(provider: AIProvider): string {
  const urls: Partial<Record<AIProvider, string>> = {
    openai: AI_SERVICE_URLS.OPENAI,
    claude: AI_SERVICE_URLS.CLAUDE,
    deepseek: AI_SERVICE_URLS.DEEPSEEK,
    zhipu: AI_SERVICE_URLS.ZHIPU,
    modelscope: AI_SERVICE_URLS.MODELSCOPE,
    siliconflow: AI_SERVICE_URLS.SILICONFLOW,
    iflow: AI_SERVICE_URLS.IFLOW,
    typesafe: AI_SERVICE_URLS.TYPESAFE,
  };
  return urls[provider] ?? '';
}

export function getApiUrlPlaceholder(provider: AIProvider): string {
  return getDefaultApiUrl(provider) || t('options_custom_api_placeholder');
}

export function getProviderName(provider: AIProvider): string {
  return t(PROVIDER_NAME_KEYS[provider]);
}

export function getApiKeyPlaceholder(provider: AIProvider): string {
  return t(PROVIDER_KEY_PLACEHOLDER_KEYS[provider]);
}

const MODEL_PLACEHOLDERS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  deepseek: 'deepseek-chat',
  zhipu: 'glm-4-flash',
  modelscope: 'qwen-plus',
  siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  iflow: 'spark-lite',
  typesafe: 'jev-latest',
  custom: '',
};

export function getModelPlaceholder(provider: AIProvider): string {
  return MODEL_PLACEHOLDERS[provider];
}
