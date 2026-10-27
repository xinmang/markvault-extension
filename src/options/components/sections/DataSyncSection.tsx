/**
 * 其他：数据与同步
 */

import { RefreshCw } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { FormStats } from '../../hooks/form/types';
import { Button, SettingsCard } from '../ui';

interface DataSyncSectionProps {
  stats: FormStats;
  isLoading: boolean;
  onSync: () => void;
  formatDate: (timestamp: number) => string;
}

export function DataSyncSection({ stats, isLoading, onSync, formatDate }: DataSyncSectionProps) {
  return (
    <SettingsCard title={t('options_data_card_title')} description={t('options_data_card_desc')}>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] px-4 py-3">
          <dd className="text-2xl font-semibold text-[color:var(--tab-options-title)]">{stats.tags}</dd>
          <dt className="mt-1 text-xs text-[color:var(--tab-options-text-muted)]">{t('options_data_tags')}</dt>
        </div>
        <div className="rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] px-4 py-3">
          <dd className="text-2xl font-semibold text-[color:var(--tab-options-title)]">{stats.bookmarks}</dd>
          <dt className="mt-1 text-xs text-[color:var(--tab-options-text-muted)]">{t('options_data_bookmarks')}</dt>
        </div>
        <div className="rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] px-4 py-3">
          <dd className="text-sm font-medium leading-6 text-[color:var(--tab-options-title)]">
            {t('options_data_last_sync_value', [formatDate(stats.lastSync)])}
          </dd>
          <dt className="mt-1 text-xs text-[color:var(--tab-options-text-muted)]">{t('options_last_sync')}</dt>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={onSync}
          loading={isLoading}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          {isLoading ? t('options_syncing') : t('options_sync_now')}
        </Button>
        <p className="text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{t('options_data_sync_help')}</p>
      </div>
    </SettingsCard>
  );
}
