/**
 * AI：AI 服务与模型（服务连接 + 模型分工）
 */

import { t } from '@/lib/i18n';
import type { AIProvider } from '@/types';
import type { ConnectionTestResult } from '../../hooks/form/types';
import {
  AI_PROVIDERS,
  getApiKeyPlaceholder,
  getApiUrlPlaceholder,
  getModelPlaceholder,
  getProviderName,
} from '../provider-utils';
import {
  Button,
  Callout,
  Field,
  ModelPicker,
  SecretInput,
  SettingsCard,
  TestResultLine,
  TextInput,
  ToggleRow,
} from '../ui';
import type { ModelListState } from '../ui';
import type { FormPatch } from './types';

interface AIServiceSectionProps {
  provider: AIProvider;
  apiUrl: string;
  apiKey: string;
  onProviderChange: (provider: AIProvider) => void;
  patch: (patch: FormPatch) => void;

  tagModels: ModelListState;
  isTestingTags: boolean;
  tagTestResult?: ConnectionTestResult;

  aiModel: string;
  descriptionModel: string;
  descriptionModels: ModelListState;
  descriptionServiceEnabled: boolean;
  descriptionProvider: AIProvider;
  descriptionApiUrl: string;
  descriptionApiKey: string;
  onDescriptionProviderChange: (provider: AIProvider) => void;

  onTestTags: () => void;
  onTestDescription: () => void;
  isTestingDescription: boolean;
  descriptionTestResult?: ConnectionTestResult;
  /** 是否存在可用的描述模型（仅用于提示；测试按钮始终可点，结果行会给出原因） */
  hasDescriptionModel: boolean;
}

/** 服务商下拉框 */
function ProviderSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as AIProvider)}
      className="min-h-[40px] w-full rounded-lg border border-[color:var(--tab-options-button-border)] bg-[color:var(--tab-options-card-bg)] px-3 py-2 text-sm text-[color:var(--tab-options-title)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
    >
      {AI_PROVIDERS.map((item) => (
        <option key={item} value={item}>
          {getProviderName(item)}
        </option>
      ))}
    </select>
  );
}

/** 模型列表状态行：获取中 / 失败 / 已获取 N 个 + 刷新 */
function ModelListStatus({ models, hasApiKey }: { models: ModelListState; hasApiKey: boolean }) {
  const { availableModels, isFetchingModels, modelFetchError, modelFetchSupported, refreshModelOptions } = models;

  const statusText = isFetchingModels
    ? t('options_models_loading')
    : modelFetchError
      ? `${t('options_model_load_failed')}: ${modelFetchError}`
      : availableModels.length > 0
        ? t('options_models_count', [String(availableModels.length)])
        : modelFetchSupported
          ? hasApiKey
            ? t('options_models_none')
            : t('options_model_fetch_hint')
          : t('options_models_manual');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] px-3 py-2">
      <p
        className={[
          'text-xs leading-relaxed',
          modelFetchError
            ? 'text-[color:var(--tab-options-danger-text)]'
            : 'text-[color:var(--tab-options-text-muted)]',
        ].join(' ')}
      >
        {statusText}
      </p>
      {modelFetchSupported ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshModelOptions}
          disabled={!hasApiKey || isFetchingModels}
          loading={isFetchingModels}
        >
          {isFetchingModels ? t('options_fetching_models') : t('options_refresh_models')}
        </Button>
      ) : null}
    </div>
  );
}

export function AIServiceSection(props: AIServiceSectionProps) {
  const {
    provider,
    apiUrl,
    apiKey,
    onProviderChange,
    patch,
    tagModels,
    isTestingTags,
    tagTestResult,
    aiModel,
    descriptionModel,
    descriptionModels,
    descriptionServiceEnabled,
    descriptionProvider,
    descriptionApiUrl,
    descriptionApiKey,
    onDescriptionProviderChange,
    onTestTags,
    onTestDescription,
    isTestingDescription,
    descriptionTestResult,
    hasDescriptionModel,
  } = props;

  const isTypeSafe = provider === 'typesafe';
  /** TypeSafe 只能分类，描述必须走独立服务，因此强制展示独立服务字段 */
  const showDescriptionService = isTypeSafe || descriptionServiceEnabled;

  return (
    <div className="space-y-5">
      <SettingsCard title={t('options_ai_service_card_title')} description={t('options_ai_service_card_desc')}>
        <Field label={t('options_ai_provider')} htmlFor="ai-provider">
          <ProviderSelect
            id="ai-provider"
            value={provider}
            onChange={(next) => {
              onProviderChange(next);
              // 只做分类的服务商无法撰写描述，切换后直接启用独立描述服务
              if (next === 'typesafe') patch({ descriptionServiceEnabled: true });
            }}
          />
        </Field>

        <Field label={t('options_api_url')} htmlFor="ai-api-url" help={t('options_api_url_help')}>
          <TextInput
            id="ai-api-url"
            type="url"
            value={apiUrl}
            placeholder={getApiUrlPlaceholder(provider)}
            onChange={(event) => patch({ apiUrl: event.target.value })}
            spellCheck={false}
            autoComplete="off"
          />
        </Field>

        <Field label={t('options_api_key')} htmlFor="ai-api-key">
          <SecretInput
            id="ai-api-key"
            value={apiKey}
            onChange={(value) => patch({ apiKey: value })}
            placeholder={getApiKeyPlaceholder(provider)}
          />
        </Field>

        <ModelListStatus models={tagModels} hasApiKey={Boolean(apiKey.trim())} />
      </SettingsCard>

      <SettingsCard title={t('options_ai_split_card_title')} description={t('options_ai_split_card_desc')}>
        <ModelPicker
          id="ai-tag-model"
          listId="ai-tag-model-options"
          provider={provider}
          label={t('options_tag_model_label')}
          value={aiModel}
          onChange={(value) => patch({ aiModel: value })}
          help={t('options_tag_model_help')}
          models={tagModels}
          hasApiKey={Boolean(apiKey.trim())}
          showStatus={false}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onTestTags} loading={isTestingTags}>
            {isTestingTags ? t('options_testing') : t('options_test_tags')}
          </Button>
        </div>
        <TestResultLine result={tagTestResult} pending={isTestingTags} pendingText={t('options_testing')} />

        <hr className="border-[color:var(--tab-options-card-border)]" />

        {isTypeSafe ? (
          <Callout variant="info" title={getProviderName('typesafe')}>
            <p>{t('options_typesafe_desc_notice')}</p>
          </Callout>
        ) : null}

        {showDescriptionService ? null : (
          <ModelPicker
            id="ai-description-model"
            listId="ai-description-model-options"
            provider={provider}
            label={t('options_description_model_label')}
            value={descriptionModel}
            onChange={(value) => patch({ descriptionModel: value })}
            placeholder={t('options_description_model_placeholder')}
            help={t('options_description_model_help')}
            models={tagModels}
            hasApiKey={Boolean(apiKey.trim())}
            showStatus={false}
          />
        )}

        <ToggleRow
          id="description-service-enabled"
          checked={showDescriptionService}
          onChange={(checked) => patch({ descriptionServiceEnabled: checked })}
          label={t('options_desc_service_toggle')}
          description={t('options_desc_service_toggle_help')}
          disabled={isTypeSafe}
        />

        {showDescriptionService ? (
          <div className="space-y-5 rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] p-4">
            <Field label={t('options_ai_provider')} htmlFor="description-provider">
              <ProviderSelect
                id="description-provider"
                value={descriptionProvider}
                onChange={(next) => {
                  onDescriptionProviderChange(next);
                  patch({ descriptionServiceEnabled: true });
                }}
              />
            </Field>

            <Field label={t('options_api_url')} htmlFor="description-api-url" help={t('options_api_url_help')}>
              <TextInput
                id="description-api-url"
                type="url"
                value={descriptionApiUrl}
                placeholder={getApiUrlPlaceholder(descriptionProvider)}
                onChange={(event) =>
                  patch({ descriptionApiUrl: event.target.value, descriptionServiceEnabled: true })
                }
                spellCheck={false}
                autoComplete="off"
              />
            </Field>

            <Field label={t('options_api_key')} htmlFor="description-api-key">
              <SecretInput
                id="description-api-key"
                value={descriptionApiKey}
                onChange={(value) => patch({ descriptionApiKey: value, descriptionServiceEnabled: true })}
                placeholder={getApiKeyPlaceholder(descriptionProvider)}
              />
            </Field>

            <ModelListStatus models={descriptionModels} hasApiKey={Boolean(descriptionApiKey.trim())} />

            <ModelPicker
              id="ai-description-model"
              listId="ai-description-model-options"
              provider={descriptionProvider}
              label={t('options_description_model_label')}
              value={descriptionModel}
              onChange={(value) => patch({ descriptionModel: value, descriptionServiceEnabled: true })}
              placeholder={getModelPlaceholder(descriptionProvider)}
              help={t('options_description_model_help')}
              models={descriptionModels}
              hasApiKey={Boolean(descriptionApiKey.trim())}
              showStatus={false}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onTestDescription} loading={isTestingDescription}>
            {isTestingDescription ? t('options_testing') : t('options_test_description')}
          </Button>
        </div>

        {!hasDescriptionModel ? (
          <Callout variant="warning">
            <p>{t('options_description_unavailable')}</p>
          </Callout>
        ) : null}

        {descriptionTestResult?.ok ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[color:var(--tab-options-title)]">✓ {t('options_test_ok')}</p>
            <p className="text-xs font-medium text-[color:var(--tab-options-text-muted)]">{t('options_test_sample')}</p>
            <blockquote className="rounded-lg border-l-4 border-[color:var(--tab-options-button-primary-bg)] bg-[color:var(--tab-options-tag-bg)] px-3 py-2 text-sm leading-relaxed text-[color:var(--tab-options-text)]">
              {descriptionTestResult.message}
            </blockquote>
          </div>
        ) : (
          <TestResultLine
            result={descriptionTestResult}
            pending={isTestingDescription}
            pendingText={t('options_testing')}
          />
        )}
      </SettingsCard>
    </div>
  );
}
