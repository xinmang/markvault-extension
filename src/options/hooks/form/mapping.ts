/**
 * 存储配置 ⇄ 设置页表单 的双向映射（纯函数，便于测试）
 */

import { StorageService, normalizeScreenshotDomains } from '@/lib/utils/storage'
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/constants/prompts'
import { NEWTAB_FOLDER_PROMPT_TEMPLATE } from '@/lib/constants/newtabPrompts'
import { DESCRIPTION_PROMPT_TEMPLATE } from '@/lib/services/description-generator'
import type { StorageConfig } from '@/types'
import type { OptionsFormData } from '@/types/form'

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function configToForm(config: StorageConfig): OptionsFormData {
  const { aiConfig, preferences, bookmarkSite } = config
  const service = aiConfig.descriptionService
  return {
    theme: preferences.theme ?? 'auto',
    themeStyle: preferences.themeStyle ?? 'default',
    tagTheme: preferences.tagTheme ?? 'classic',

    bookmarkApiUrl: bookmarkSite.apiUrl,
    bookmarkApiKey: bookmarkSite.apiKey,

    aiProvider: aiConfig.provider,
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    aiModel: aiConfig.model || '',
    descriptionModel: aiConfig.descriptionModel || '',
    // TypeSafe（jev）只做分类、不能撰写描述，描述必须由独立服务完成；
    // 界面里这个开关对 TypeSafe 始终显示为开启，读回表单时保持同一口径
    descriptionServiceEnabled: Boolean(service?.enabled) || aiConfig.provider === 'typesafe',
    descriptionProvider: service?.provider || 'deepseek',
    descriptionApiUrl: service?.apiUrl || '',
    descriptionApiKey: service?.apiKey || '',

    enableAI: preferences.enableAI ?? true,
    maxSuggestedTags: clampInt(preferences.maxSuggestedTags, 1, 10, 5),
    enableCustomPrompt: aiConfig.enableCustomPrompt ?? false,
    customPrompt: aiConfig.customPrompt || DEFAULT_PROMPT_TEMPLATE,

    enableAIDescription: preferences.enableAIDescription ?? true,
    enableDescriptionPrompt: aiConfig.enableDescriptionPrompt ?? false,
    descriptionPrompt: aiConfig.descriptionPrompt || DESCRIPTION_PROMPT_TEMPLATE,

    defaultIncludeThumbnail: preferences.defaultIncludeThumbnail ?? true,
    defaultCreateSnapshot: preferences.defaultCreateSnapshot ?? false,
    defaultCreateScreenshot: preferences.defaultCreateScreenshot ?? false,
    defaultIsPublic: preferences.defaultIsPublic ?? true,

    screenshotDomains: normalizeScreenshotDomains(preferences.screenshotDomains ?? []),
    screenshotTheme: preferences.screenshotTheme ?? 'auto',

    enableNewtabAI: preferences.enableNewtabAI ?? true,
    newtabFolderRecommendCount: clampInt(preferences.newtabFolderRecommendCount, 1, 20, 10),
    enableNewtabFolderPrompt: preferences.enableNewtabFolderPrompt ?? false,
    newtabFolderPrompt: preferences.newtabFolderPrompt || NEWTAB_FOLDER_PROMPT_TEMPLATE,
    maxImportGroups: clampInt(aiConfig.maxImportGroups, 1, 20, 7),
  }
}

/** 把表单写回完整配置；未在表单中出现的字段（如自动同步）沿用当前配置 */
export function formToConfig(form: OptionsFormData, current: StorageConfig): StorageConfig {
  return StorageService.mergeWithDefaults({
    aiConfig: {
      provider: form.aiProvider,
      apiUrl: form.apiUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.aiModel.trim(),
      descriptionModel: form.descriptionModel.trim(),
      descriptionService: {
        // 与 configToForm 对应：TypeSafe 作为标签服务时，独立描述服务始终启用
        enabled: form.descriptionServiceEnabled || form.aiProvider === 'typesafe',
        provider: form.descriptionProvider,
        apiUrl: form.descriptionApiUrl.trim(),
        apiKey: form.descriptionApiKey.trim(),
      },
      enableDescriptionPrompt: form.enableDescriptionPrompt,
      descriptionPrompt: form.descriptionPrompt,
      enableCustomPrompt: form.enableCustomPrompt,
      customPrompt: form.customPrompt,
      maxImportGroups: clampInt(form.maxImportGroups, 1, 20, 7),
    },
    bookmarkSite: {
      apiUrl: form.bookmarkApiUrl.trim(),
      apiKey: form.bookmarkApiKey.trim(),
    },
    preferences: {
      ...current.preferences,
      theme: form.theme,
      themeStyle: form.themeStyle,
      tagTheme: form.tagTheme,
      enableAI: form.enableAI,
      maxSuggestedTags: clampInt(form.maxSuggestedTags, 1, 10, 5),
      enableAIDescription: form.enableAIDescription,
      defaultIncludeThumbnail: form.defaultIncludeThumbnail,
      defaultCreateSnapshot: form.defaultCreateSnapshot,
      defaultCreateScreenshot: form.defaultCreateScreenshot,
      defaultIsPublic: form.defaultIsPublic,
      screenshotDomains: normalizeScreenshotDomains(form.screenshotDomains),
      screenshotTheme: form.screenshotTheme,
      enableNewtabAI: form.enableNewtabAI,
      newtabFolderRecommendCount: clampInt(form.newtabFolderRecommendCount, 1, 20, 10),
      enableNewtabFolderPrompt: form.enableNewtabFolderPrompt,
      newtabFolderPrompt: form.newtabFolderPrompt,
    },
  })
}

/** 恢复默认后的表单（MarkVault 连接信息保留，避免重置后无法使用） */
export function defaultForm(current?: OptionsFormData): OptionsFormData {
  const defaults = configToForm(StorageService.mergeWithDefaults(undefined))
  return current
    ? { ...defaults, bookmarkApiUrl: current.bookmarkApiUrl, bookmarkApiKey: current.bookmarkApiKey }
    : defaults
}

/** 表单是否与已保存的配置不同（字段逐个比较，数组按内容比较） */
export function isFormDirty(form: OptionsFormData, saved: OptionsFormData): boolean {
  return (Object.keys(form) as Array<keyof OptionsFormData>).some((key) => {
    const a = form[key]
    const b = saved[key]
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length !== b.length || a.some((item, index) => item !== b[index])
    }
    return a !== b
  })
}
