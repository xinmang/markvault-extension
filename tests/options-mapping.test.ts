/**
 * 设置页表单映射测试：
 * - configToForm / formToConfig 往返
 * - 单一 AI 服务、描述独立服务
 * - 截图域名规范化
 * - 旧版 apiKeys / apiUrls / savedConnections 迁移
 * - isFormDirty 对数组按内容比较
 */

import { describe, expect, it } from 'vitest';
import {
  configToForm,
  defaultForm,
  formToConfig,
  isFormDirty,
} from '@/options/hooks/form/mapping';
import { StorageService, DEFAULT_SCREENSHOT_DOMAINS } from '@/lib/utils/storage';
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/constants/prompts';
import { DESCRIPTION_PROMPT_TEMPLATE } from '@/lib/services/description-generator';
import { NEWTAB_FOLDER_PROMPT_TEMPLATE } from '@/lib/constants/newtabPrompts';
import type { StorageConfig } from '@/types';
import type { OptionsFormData } from '@/types/form';

const baseConfig = (): StorageConfig => StorageService.mergeWithDefaults(undefined);

describe('configToForm / formToConfig', () => {
  it('默认配置往返后保持一致', () => {
    const config = baseConfig();
    const form = configToForm(config);
    const roundTripped = formToConfig(form, config);

    expect(configToForm(roundTripped)).toEqual(form);
  });

  it('单一 AI 服务：provider / apiUrl / apiKey / 模型都写回', () => {
    const config = baseConfig();
    const form: OptionsFormData = {
      ...configToForm(config),
      aiProvider: 'deepseek',
      apiUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      aiModel: 'deepseek-chat',
      descriptionModel: 'deepseek-reasoner',
    };

    const next = formToConfig(form, config);

    expect(next.aiConfig.provider).toBe('deepseek');
    expect(next.aiConfig.apiUrl).toBe('https://example.com/v1');
    expect(next.aiConfig.apiKey).toBe('sk-test');
    expect(next.aiConfig.model).toBe('deepseek-chat');
    expect(next.aiConfig.descriptionModel).toBe('deepseek-reasoner');
    expect(next.aiConfig.descriptionService?.enabled).toBe(false);
    expect(configToForm(next)).toEqual(form);
  });

  it('描述独立服务：enabled / provider / 地址与密钥都保留', () => {
    const config = baseConfig();
    const form: OptionsFormData = {
      ...configToForm(config),
      aiProvider: 'typesafe',
      apiUrl: 'https://api.typesafe.ai/v1',
      apiKey: 'ts-key',
      aiModel: 'jev-latest',
      descriptionServiceEnabled: true,
      descriptionProvider: 'deepseek',
      descriptionApiUrl: 'https://api.deepseek.com/v1',
      descriptionApiKey: 'sk-desc',
      descriptionModel: 'deepseek-chat',
    };

    const next = formToConfig(form, config);
    const service = next.aiConfig.descriptionService;

    expect(service).toEqual({
      enabled: true,
      provider: 'deepseek',
      apiUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-desc',
    });
    expect(next.aiConfig.model).toBe('jev-latest');
    expect(next.aiConfig.descriptionModel).toBe('deepseek-chat');

    const back = configToForm(next);
    expect(back.descriptionServiceEnabled).toBe(true);
    expect(back.descriptionProvider).toBe('deepseek');
    expect(back.descriptionApiUrl).toBe('https://api.deepseek.com/v1');
    expect(back.descriptionApiKey).toBe('sk-desc');
    expect(back.descriptionModel).toBe('deepseek-chat');
  });

  it('TypeSafe 作为标签服务时，独立描述服务始终视为启用', () => {
    const config = baseConfig();
    const form = {
      ...configToForm(config),
      aiProvider: 'typesafe' as const,
      apiKey: 'ts-key',
      aiModel: 'jev-latest',
    };

    // 表单里开关显示为开启（jev 无法生成文字）
    expect(configToForm(config).descriptionServiceEnabled).toBe(false);
    const next = formToConfig({ ...form, descriptionServiceEnabled: false }, config);
    expect(next.aiConfig.descriptionService?.enabled).toBe(true);
    expect(configToForm(next).descriptionServiceEnabled).toBe(true);
  });

  it('截图域名：去协议、www、路径，转小写并去重', () => {
    const config = baseConfig();
    const form: OptionsFormData = {
      ...configToForm(config),
      screenshotDomains: [
        'https://www.Example.com/path?q=1',
        'example.com',
        '*.x.com',
        'X.COM',
        'not a domain',
        '',
        'linux.do',
      ],
    };

    const next = formToConfig(form, config);

    expect(next.preferences.screenshotDomains).toEqual(['example.com', 'x.com', 'linux.do']);
    // 再读回表单时同样是规范化后的内容
    expect(configToForm(next).screenshotDomains).toEqual(['example.com', 'x.com', 'linux.do']);
  });

  it('模型列表、提示词和数值区间会被夹在合法范围内', () => {
    const config = baseConfig();
    const form: OptionsFormData = {
      ...configToForm(config),
      maxSuggestedTags: 99,
      newtabFolderRecommendCount: 0,
      maxImportGroups: 42,
      customPrompt: '自定义标签提示词',
      descriptionPrompt: '自定义描述提示词',
      newtabFolderPrompt: '自定义文件夹提示词',
      enableCustomPrompt: true,
      enableDescriptionPrompt: true,
      enableNewtabFolderPrompt: true,
    };

    const next = formToConfig(form, config);

    expect(next.preferences.maxSuggestedTags).toBe(10);
    expect(next.preferences.newtabFolderRecommendCount).toBe(1);
    expect(next.aiConfig.maxImportGroups).toBe(20);
    expect(next.aiConfig.customPrompt).toBe('自定义标签提示词');
    expect(next.aiConfig.descriptionPrompt).toBe('自定义描述提示词');
    expect(next.preferences.newtabFolderPrompt).toBe('自定义文件夹提示词');
  });

  it('表单外的字段（autoSync / syncInterval）保存后保持不变', () => {
    const config: StorageConfig = {
      ...baseConfig(),
      preferences: {
        ...baseConfig().preferences,
        autoSync: false,
        syncInterval: 6,
      },
    };

    const next = formToConfig(configToForm(config), config);

    expect(next.preferences.autoSync).toBe(false);
    expect(next.preferences.syncInterval).toBe(6);
  });

  it('defaultForm 保留 MarkVault 连接信息并回到默认 prompt 模板', () => {
    const form: OptionsFormData = {
      ...configToForm(baseConfig()),
      bookmarkApiUrl: 'https://vault.example.com',
      bookmarkApiKey: 'vault-key',
      customPrompt: '改过的提示词',
      enableAI: false,
    };

    const reset = defaultForm(form);

    expect(reset.bookmarkApiUrl).toBe('https://vault.example.com');
    expect(reset.bookmarkApiKey).toBe('vault-key');
    expect(reset.customPrompt).toBe(DEFAULT_PROMPT_TEMPLATE);
    expect(reset.descriptionPrompt).toBe(DESCRIPTION_PROMPT_TEMPLATE);
    expect(reset.newtabFolderPrompt).toBe(NEWTAB_FOLDER_PROMPT_TEMPLATE);
    expect(reset.enableAI).toBe(true);
    expect(reset.screenshotDomains).toEqual([...DEFAULT_SCREENSHOT_DOMAINS]);
  });
});

describe('StorageService.mergeWithDefaults 旧版迁移', () => {
  it('apiKeys / apiUrls 迁移为单一服务的 apiKey / apiUrl', () => {
    const merged = StorageService.mergeWithDefaults({
      aiConfig: {
        provider: 'deepseek',
        apiKeys: { openai: 'sk-openai', deepseek: 'sk-deepseek' },
        apiUrls: { deepseek: 'https://api.deepseek.com/v1' },
        model: 'deepseek-chat',
        savedConnections: [{ id: '1', name: '旧配置' }],
      },
      bookmarkSite: { apiUrl: 'http://localhost:8787', apiKey: 'vault-key' },
      preferences: baseConfig().preferences,
    } as unknown as StorageConfig);

    expect(merged.aiConfig.provider).toBe('deepseek');
    expect(merged.aiConfig.apiKey).toBe('sk-deepseek');
    expect(merged.aiConfig.apiUrl).toBe('https://api.deepseek.com/v1');
    expect(merged.aiConfig.model).toBe('deepseek-chat');
    // 旧版多套配置字段不再出现在保存结果里
    expect((merged.aiConfig as unknown as Record<string, unknown>).apiKeys).toBeUndefined();
    expect((merged.aiConfig as unknown as Record<string, unknown>).savedConnections).toBeUndefined();

    // 迁移后的配置可以正常进入表单
    const form = configToForm(merged);
    expect(form.apiKey).toBe('sk-deepseek');
    expect(form.apiUrl).toBe('https://api.deepseek.com/v1');
    expect(form.bookmarkApiKey).toBe('vault-key');
  });

  it('已有 apiKey / apiUrl 优先于旧版映射', () => {
    const merged = StorageService.mergeWithDefaults({
      aiConfig: {
        provider: 'openai',
        apiKey: 'sk-new',
        apiUrl: 'https://new.example.com/v1',
        apiKeys: { openai: 'sk-old' },
        apiUrls: { openai: 'https://old.example.com/v1' },
      },
      bookmarkSite: { apiUrl: '', apiKey: '' },
      preferences: baseConfig().preferences,
    } as unknown as StorageConfig);

    expect(merged.aiConfig.apiKey).toBe('sk-new');
    expect(merged.aiConfig.apiUrl).toBe('https://new.example.com/v1');
  });

  it('旧配置里的截图域名会被规范化', () => {
    const merged = StorageService.mergeWithDefaults({
      ...baseConfig(),
      preferences: {
        ...baseConfig().preferences,
        screenshotDomains: ['https://www.x.com/home', 'x.com', 'Linux.DO'],
      },
    });

    expect(merged.preferences.screenshotDomains).toEqual(['x.com', 'linux.do']);
  });
});

describe('isFormDirty', () => {
  const form = (): OptionsFormData => configToForm(baseConfig());

  it('完全相同时返回 false', () => {
    expect(isFormDirty(form(), form())).toBe(false);
  });

  it('数组按内容比较而不是引用', () => {
    const a = { ...form(), screenshotDomains: ['x.com', 'linux.do'] };
    const b = { ...form(), screenshotDomains: ['x.com', 'linux.do'] };
    const c = { ...form(), screenshotDomains: ['linux.do', 'x.com'] };

    expect(isFormDirty(a, b)).toBe(false);
    expect(isFormDirty(a, c)).toBe(true);
  });

  it('数组长度或元素变化视为有修改', () => {
    const base = form();
    expect(isFormDirty({ ...base, screenshotDomains: ['x.com'] }, { ...base, screenshotDomains: [] })).toBe(true);
    expect(isFormDirty({ ...base, screenshotDomains: ['x.com'] }, { ...base, screenshotDomains: ['y.com'] })).toBe(true);
  });

  it('普通字段逐个比较', () => {
    const base = form();
    expect(isFormDirty({ ...base, aiModel: 'other-model' }, base)).toBe(true);
    expect(isFormDirty({ ...base, enableAI: !base.enableAI }, base)).toBe(true);
    expect(isFormDirty({ ...base, maxSuggestedTags: base.maxSuggestedTags + 1 }, base)).toBe(true);
  });
});
