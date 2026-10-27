/**
 * 保存书签：网站截图（域名列表 + 配色）
 */

import type { FormPatch } from './types';
import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { DEFAULT_SCREENSHOT_DOMAINS, normalizeScreenshotDomains } from '@/lib/utils/storage';
import type { ThemeMode } from '@/types/form';
import { Button, Field, SegmentedControl, SettingsCard, TextInput } from '../ui';

interface ScreenshotSectionProps {
  screenshotDomains: string[];
  screenshotTheme: ThemeMode;
  patch: (patch: FormPatch) => void;
}

export function ScreenshotSection({ screenshotDomains, screenshotTheme, patch }: ScreenshotSectionProps) {
  const [draft, setDraft] = useState('');

  const addDomain = () => {
    const added = normalizeScreenshotDomains([draft]);
    // 无效域名保留在输入框里，方便用户修改
    if (added.length === 0) return;
    patch({ screenshotDomains: normalizeScreenshotDomains([...screenshotDomains, ...added]) });
    setDraft('');
  };

  const removeDomain = (domain: string) => {
    patch({ screenshotDomains: screenshotDomains.filter((item) => item !== domain) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDomain();
    }
  };

  return (
    <SettingsCard title={t('options_screenshot_card_title')} description={t('options_screenshot_card_desc')}>
      <Field
        label={t('options_screenshot_domains')}
        htmlFor="screenshot-domain-input"
        help={t('options_screenshot_domains_help')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch({ screenshotDomains: [...DEFAULT_SCREENSHOT_DOMAINS] })}
          >
            {t('options_screenshot_reset_default')}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            id="screenshot-domain-input"
            value={draft}
            placeholder={t('options_screenshot_domain_placeholder')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="max-w-xs flex-1"
          />
          <Button variant="secondary" onClick={addDomain} disabled={!draft.trim()}>
            {t('options_screenshot_add')}
          </Button>
        </div>

        {screenshotDomains.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {screenshotDomains.map((domain) => (
              <li key={domain}>
                <span className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[color:var(--tab-options-tag-border)] bg-[color:var(--tab-options-tag-bg)] pl-3 pr-1 text-xs font-medium text-[color:var(--tab-options-text)]">
                  {domain}
                  <button
                    type="button"
                    onClick={() => removeDomain(domain)}
                    aria-label={t('options_screenshot_remove', [domain])}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--tab-options-text-muted)] transition-colors hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[color:var(--tab-options-text-muted)]">{t('options_screenshot_domains_empty')}</p>
        )}
      </Field>

      <Field label={t('options_screenshot_theme')} help={t('options_screenshot_theme_help')}>
        <SegmentedControl<ThemeMode>
          ariaLabel={t('options_screenshot_theme')}
          value={screenshotTheme}
          onChange={(value) => patch({ screenshotTheme: value })}
          options={[
            { value: 'auto', label: t('options_screenshot_theme_auto') },
            { value: 'light', label: t('options_screenshot_theme_light') },
            { value: 'dark', label: t('options_screenshot_theme_dark') },
          ]}
        />
      </Field>
    </SettingsCard>
  );
}
