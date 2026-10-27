/**
 * 其他：外观
 */

import type { FormPatch } from './types';
import { t } from '@/lib/i18n';
import type { ThemeMode } from '@/types/form';
import { Field, SegmentedControl, SettingsCard } from '../ui';

interface AppearanceSectionProps {
  theme: ThemeMode;
  themeStyle: 'default' | 'bw' | 'tmarks';
  tagTheme: 'classic' | 'mono' | 'bw';
  patch: (patch: FormPatch) => void;
  onReset: () => void;
}

export function AppearanceSection({ theme, themeStyle, tagTheme, patch, onReset }: AppearanceSectionProps) {
  return (
    <SettingsCard title={t('options_appearance_card_title')} description={t('options_appearance_card_desc')}>
      <Field label={t('options_appearance_theme')} help={t('options_appearance_theme_help')}>
        <SegmentedControl<ThemeMode>
          ariaLabel={t('options_appearance_theme')}
          value={theme}
          onChange={(value) => patch({ theme: value })}
          options={[
            { value: 'auto', label: t('pref_theme_auto') },
            { value: 'light', label: t('pref_theme_light') },
            { value: 'dark', label: t('pref_theme_dark') },
          ]}
        />
      </Field>

      <Field label={t('options_appearance_style')} help={t('options_appearance_style_help')}>
        <SegmentedControl<'default' | 'bw' | 'tmarks'>
          ariaLabel={t('options_appearance_style')}
          value={themeStyle}
          onChange={(value) => patch({ themeStyle: value })}
          options={[
            { value: 'default', label: t('pref_style_default') },
            { value: 'bw', label: t('pref_style_bw') },
            { value: 'tmarks', label: 'MarkVault' },
          ]}
        />
      </Field>

      <Field label={t('options_appearance_tag_style')} help={t('options_appearance_tag_style_help')}>
        <SegmentedControl<'classic' | 'mono' | 'bw'>
          ariaLabel={t('options_appearance_tag_style')}
          value={tagTheme}
          onChange={(value) => patch({ tagTheme: value })}
          options={[
            { value: 'classic', label: t('pref_tag_classic') },
            { value: 'mono', label: t('pref_tag_mono') },
            { value: 'bw', label: t('pref_style_bw') },
          ]}
        />
      </Field>

      <div className="border-t border-[color:var(--tab-options-card-border)] pt-4">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-[36px] items-center rounded-lg px-1 text-sm font-medium text-[color:var(--tab-options-danger-text)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
        >
          {t('options_appearance_reset')}
        </button>
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">
          {t('options_appearance_reset_help')}
        </p>
      </div>
    </SettingsCard>
  );
}
