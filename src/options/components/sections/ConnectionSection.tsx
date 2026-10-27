/**
 * 开始：连接 MarkVault
 */

import { ExternalLink } from 'lucide-react';
import { t } from '@/lib/i18n';
import { TMARKS_URLS } from '@/lib/constants/urls';
import type { ConnectionTestResult } from '../../hooks/form/types';
import { Button, Field, SecretInput, SettingsCard, TestResultLine, TextInput } from '../ui';

interface ConnectionSectionProps {
  apiUrl: string;
  apiKey: string;
  onChange: (patch: Record<string, unknown>) => void;
  onTest: () => void;
  isTesting: boolean;
  testResult?: ConnectionTestResult;
}

/** 由站点地址拼出「创建 API Key」页面地址；未填写或地址无效时返回 null */
export function buildApiKeyUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const base = withProtocol.replace(/\/+$/, '').replace(/\/api$/, '');
  try {
    const parsed = new URL(base);
    if (!parsed.hostname) return null;
  } catch {
    return null;
  }
  return `${base}/settings/general?section=api`;
}

export function ConnectionSection({ apiUrl, apiKey, onChange, onTest, isTesting, testResult }: ConnectionSectionProps) {
  const apiKeyUrl = buildApiKeyUrl(apiUrl);

  return (
    <SettingsCard
      title={t('options_connection_card_title')}
      description={t('options_connection_card_desc')}
    >
      <Field
        label={t('options_server_address')}
        htmlFor="connection-api-url"
        help={t('options_connection_url_help')}
      >
        <TextInput
          id="connection-api-url"
          type="url"
          value={apiUrl}
          placeholder={TMARKS_URLS.DEFAULT_BASE_URL}
          onChange={(event) => onChange({ bookmarkApiUrl: event.target.value })}
          spellCheck={false}
          autoComplete="off"
        />
      </Field>

      <Field label={t('options_api_key')} htmlFor="connection-api-key" help={t('options_connection_key_help')}>
        <SecretInput
          id="connection-api-key"
          value={apiKey}
          onChange={(value) => onChange({ bookmarkApiKey: value })}
          placeholder={t('options_api_key_placeholder')}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onTest} loading={isTesting}>
          {isTesting ? t('options_testing') : t('options_connection_test')}
        </Button>
        {apiKeyUrl ? (
          <a
            href={apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[color:var(--tab-options-text)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
          >
            {t('options_connection_create_key')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <TestResultLine result={testResult} pending={isTesting} pendingText={t('options_testing')} />
    </SettingsCard>
  );
}
