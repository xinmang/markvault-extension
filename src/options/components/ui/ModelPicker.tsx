/**
 * 模型输入：文本框 + datalist 候选，附带模型列表加载状态与刷新按钮
 */

import { t } from '@/lib/i18n';
import type { AIProvider } from '@/types';
import { Field } from './Field';
import { TextInput } from './TextInput';
import { getModelPlaceholder } from '../provider-utils';

export interface ModelListState {
  availableModels: string[];
  isFetchingModels: boolean;
  modelFetchError: string | null;
  modelFetchSupported: boolean;
  refreshModelOptions: () => void;
}

interface ModelPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  provider: AIProvider;
  models: ModelListState;
  /** 是否有可用于请求的密钥；没有时刷新按钮禁用 */
  hasApiKey: boolean;
  listId: string;
  /** 是否在输入框下方显示模型列表状态（服务卡片里已统一展示时可关闭） */
  showStatus?: boolean;
}

export function ModelPicker({
  id,
  label,
  value,
  onChange,
  placeholder,
  help,
  provider,
  models,
  hasApiKey,
  listId,
  showStatus = true,
}: ModelPickerProps) {
  const { availableModels, isFetchingModels, modelFetchError, modelFetchSupported } = models;

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
    <Field label={label} htmlFor={id} help={help}>
      <TextInput
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? getModelPlaceholder(provider)}
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id={listId}>
        {availableModels.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      {showStatus ? (
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
      ) : null}
    </Field>
  );
}
