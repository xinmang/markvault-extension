/**
 * 顶部状态栏：扩展图标 + 标题 + 两个实时状态胶囊
 */

import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';

type PillTone = 'ok' | 'warn' | 'error' | 'neutral';

export type MarkVaultStatus = 'connected' | 'no-key' | 'test-failed';

interface TopBarProps {
  markVaultStatus: MarkVaultStatus;
  /** 分类模型，空表示未配置 */
  aiTagModel: string;
  /** 实际生效的描述模型，空表示不生成 */
  aiDescriptionModel: string;
}

const TONE_BORDER: Record<PillTone, string> = {
  ok: 'border-[color:var(--tab-message-success-border)]',
  warn: 'border-[color:var(--tab-message-warning-border)]',
  error: 'border-[color:var(--tab-message-danger-border)]',
  neutral: 'border-[color:var(--tab-options-card-border)]',
};

const TONE_DOT: Record<PillTone, string> = {
  ok: 'bg-[color:var(--tab-options-switch-blue-on)]',
  warn: 'bg-[color:var(--tab-options-switch-amber-on)]',
  error: 'bg-[color:var(--tab-message-danger-icon)]',
  neutral: 'bg-[color:var(--tab-options-text-muted)]',
};

function StatusPill({
  label,
  tone,
  children,
  title,
}: {
  label: string;
  tone: PillTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={[
        'inline-flex min-h-[28px] max-w-full items-center gap-2 rounded-full border bg-[color:var(--tab-options-tag-bg)] px-3 py-1 text-xs text-[color:var(--tab-options-text)]',
        TONE_BORDER[tone],
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[tone]].join(' ')} aria-hidden="true" />
      <span className="flex-shrink-0 font-medium text-[color:var(--tab-options-title)]">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** 依据 API Key 与最近一次测试结果得出 MarkVault 状态 */
export function resolveMarkVaultStatus(hasKey: boolean, lastTestOk?: boolean): MarkVaultStatus {
  // 未填写 Key 时优先提示补全；填好 Key 后以最近一次测试结果为准
  if (!hasKey) return 'no-key';
  if (lastTestOk === false) return 'test-failed';
  return 'connected';
}

export function TopBar({ markVaultStatus, aiTagModel, aiDescriptionModel }: TopBarProps) {
  const markVaultLabel =
    markVaultStatus === 'connected'
      ? t('options_status_connected')
      : markVaultStatus === 'no-key'
        ? t('options_status_no_key')
        : t('options_status_test_failed');

  const markVaultTone: PillTone =
    markVaultStatus === 'connected' ? 'ok' : markVaultStatus === 'no-key' ? 'warn' : 'error';

  const aiText = t('options_status_ai_pill', [
    aiTagModel || t('options_status_unconfigured'),
    aiDescriptionModel || t('options_status_no_description'),
  ]);
  const aiTitle = `${t('options_ai_tag_pill_label')}: ${aiTagModel || t('options_status_unconfigured')} · ${t('options_ai_desc_pill_label')}: ${aiDescriptionModel || t('options_status_no_description')}`;

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-card-bg)] backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/icons/icon-48.png" alt="" className="h-6 w-6 flex-shrink-0 rounded" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-[color:var(--tab-options-title)]">
            {t('options_header_title')}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
          <StatusPill label={t('options_status_markvault')} tone={markVaultTone}>
            {markVaultLabel}
          </StatusPill>
          <StatusPill label={t('options_status_ai')} tone={aiTagModel ? 'ok' : 'warn'} title={aiTitle}>
            {aiText}
          </StatusPill>
        </div>
      </div>
    </header>
  );
}
