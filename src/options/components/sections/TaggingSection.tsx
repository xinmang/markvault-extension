/**
 * AI：标签推荐
 */

import type { FormPatch } from './types';
import { t } from '@/lib/i18n';
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/constants/prompts';
import { Collapsible, PromptEditor, SettingsCard, SliderField, Toggle, ToggleRow } from '../ui';

interface TaggingSectionProps {
  enableAI: boolean;
  maxSuggestedTags: number;
  enableCustomPrompt: boolean;
  customPrompt: string;
  patch: (patch: FormPatch) => void;
}

export function TaggingSection({
  enableAI,
  maxSuggestedTags,
  enableCustomPrompt,
  customPrompt,
  patch,
}: TaggingSectionProps) {
  return (
    <SettingsCard title={t('options_tag_card_title')} description={t('options_tag_card_desc')}>
      <ToggleRow
        id="enable-ai-tags"
        checked={enableAI}
        onChange={(checked) => patch({ enableAI: checked })}
        label={t('options_tag_enable')}
        description={t('options_tag_enable_help')}
      />

      <SliderField
        id="max-suggested-tags"
        label={t('options_tag_max')}
        value={maxSuggestedTags}
        min={1}
        max={10}
        disabled={!enableAI}
        onChange={(value) => patch({ maxSuggestedTags: value })}
        help={t('options_tag_max_help')}
        unit={t('options_tag_max_unit')}
      />

      <Collapsible
        title={t('options_advanced_prompt')}
        aside={
          <span className="text-xs text-[color:var(--tab-options-text-muted)]">
            {enableCustomPrompt ? t('options_enabled') : t('options_disabled')}
          </span>
        }
      >
        <p className="-mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">
          {t('options_tag_prompt_toggle_help')}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--tab-options-title)]">{t('options_prompt_enable')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">
              {t('options_prompt_enable_help')}
            </p>
          </div>
          <div className="pt-0.5">
            <Toggle
              checked={enableCustomPrompt}
              disabled={!enableAI}
              onChange={(checked) => patch({ enableCustomPrompt: checked })}
              label={t('options_tag_prompt_toggle')}
            />
          </div>
        </div>

        {enableCustomPrompt ? (
          <PromptEditor
            id="custom-tag-prompt"
            value={customPrompt}
            onChange={(value) => patch({ customPrompt: value })}
            defaultTemplate={DEFAULT_PROMPT_TEMPLATE}
            variablesHelp={t('options_prompt_variables_tag')}
            disabled={!enableAI}
          />
        ) : null}
      </Collapsible>
    </SettingsCard>
  );
}
