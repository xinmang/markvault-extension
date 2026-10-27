/**
 * AI：描述生成
 */

import type { FormPatch } from './types';
import { t } from '@/lib/i18n';
import { DESCRIPTION_PROMPT_TEMPLATE } from '@/lib/services/description-generator';
import { Callout, Collapsible, PromptEditor, SettingsCard, Toggle, ToggleRow } from '../ui';

interface DescriptionSectionProps {
  enableAIDescription: boolean;
  enableDescriptionPrompt: boolean;
  descriptionPrompt: string;
  /** 是否有可用的描述模型 */
  hasDescriptionModel: boolean;
  /** 跳转到 AI 服务与模型 */
  onOpenAIService: () => void;
  patch: (patch: FormPatch) => void;
}

export function DescriptionSection({
  enableAIDescription,
  enableDescriptionPrompt,
  descriptionPrompt,
  hasDescriptionModel,
  onOpenAIService,
  patch,
}: DescriptionSectionProps) {
  return (
    <SettingsCard title={t('options_desc_card_title')} description={t('options_desc_card_desc')}>
      <ToggleRow
        id="enable-ai-description"
        checked={enableAIDescription}
        onChange={(checked) => patch({ enableAIDescription: checked })}
        label={t('options_desc_enable')}
        description={t('options_desc_enable_help')}
      />

      {!hasDescriptionModel ? (
        <Callout
          variant="warning"
          title={t('options_desc_unavailable')}
        >
          <button
            type="button"
            onClick={onOpenAIService}
            className="inline-flex min-h-[36px] items-center font-medium text-[color:var(--tab-options-title)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
          >
            {t('options_desc_unavailable_link')}
          </button>
        </Callout>
      ) : null}

      <Collapsible
        title={t('options_desc_prompt_toggle')}
        aside={
          <span className="text-xs text-[color:var(--tab-options-text-muted)]">
            {enableDescriptionPrompt ? t('options_enabled') : t('options_disabled')}
          </span>
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--tab-options-title)]">{t('options_prompt_enable')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">
              {t('options_prompt_enable_help')}
            </p>
          </div>
          <div className="pt-0.5">
            <Toggle
              checked={enableDescriptionPrompt}
              disabled={!enableAIDescription}
              onChange={(checked) => patch({ enableDescriptionPrompt: checked })}
              label={t('options_desc_prompt_toggle')}
            />
          </div>
        </div>

        {enableDescriptionPrompt ? (
          <PromptEditor
            id="description-prompt"
            value={descriptionPrompt}
            onChange={(value) => patch({ descriptionPrompt: value })}
            defaultTemplate={DESCRIPTION_PROMPT_TEMPLATE}
            variablesHelp={t('options_desc_prompt_variables')}
            disabled={!enableAIDescription}
          />
        ) : null}
      </Collapsible>
    </SettingsCard>
  );
}
