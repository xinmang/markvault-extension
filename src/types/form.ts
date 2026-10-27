/**
 * 设置页表单类型
 */

import type { AIProvider } from './ai';

export type ThemeMode = 'light' | 'dark' | 'auto';

// Options 表单数据：与 StorageConfig 一一映射，保存时整体写回
export interface OptionsFormData {
  // 外观
  theme: ThemeMode;
  themeStyle: 'default' | 'bw' | 'tmarks';
  tagTheme: 'classic' | 'mono' | 'bw';

  // MarkVault 连接
  bookmarkApiUrl: string;
  bookmarkApiKey: string;

  // AI 服务（只有一套）
  aiProvider: AIProvider;
  apiUrl: string;
  apiKey: string;
  /** 标签分类模型 */
  aiModel: string;
  /** 描述生成模型，留空表示与标签分类模型相同 */
  descriptionModel: string;
  /** 描述生成改用另一个服务（标签分类用 jev 等只做判定的模型时需要） */
  descriptionServiceEnabled: boolean;
  descriptionProvider: AIProvider;
  descriptionApiUrl: string;
  descriptionApiKey: string;

  // 标签推荐
  enableAI: boolean;
  maxSuggestedTags: number;
  enableCustomPrompt: boolean;
  customPrompt: string;

  // 描述生成
  enableAIDescription: boolean;
  enableDescriptionPrompt: boolean;
  descriptionPrompt: string;

  // 保存书签时的默认选项
  defaultIncludeThumbnail: boolean;
  defaultCreateSnapshot: boolean;
  defaultCreateScreenshot: boolean;
  defaultIsPublic: boolean;

  // 网站截图
  screenshotDomains: string[];
  screenshotTheme: ThemeMode;

  // NewTab
  enableNewtabAI: boolean;
  newtabFolderRecommendCount: number;
  enableNewtabFolderPrompt: boolean;
  newtabFolderPrompt: string;
  maxImportGroups: number;
}

// 部分表单数据更新函数类型
export type FormDataSetter = (updater: Partial<OptionsFormData> | ((prev: OptionsFormData) => OptionsFormData)) => void;
