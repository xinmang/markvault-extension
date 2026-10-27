/**
 * 底部保存条：仅有未保存修改时滑出
 */

import { t } from '@/lib/i18n';
import { Button } from '../ui';

interface SaveBarProps {
  visible: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export function SaveBar({ visible, saving, onDiscard, onSave }: SaveBarProps) {
  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-card-bg)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur',
        'transition-transform duration-200 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--tab-options-title)]" role="status">
          <span className="h-2 w-2 rounded-full bg-[color:var(--tab-options-switch-amber-on)]" aria-hidden="true" />
          <span>
            {t('options_unsaved')}
            <span className="ml-2 hidden text-xs font-normal text-[color:var(--tab-options-text-muted)] sm:inline">
              {t('options_section_saved_hint')}
            </span>
          </span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={onDiscard} disabled={saving} tabIndex={visible ? 0 : -1}>
            {t('options_discard')}
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving} tabIndex={visible ? 0 : -1}>
            {saving ? t('btn_saving') : t('options_save')}
          </Button>
          <kbd className="hidden rounded border border-[color:var(--tab-options-button-border)] bg-[color:var(--tab-options-tag-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--tab-options-text-muted)] sm:inline-block">
            {t('options_save_shortcut')}
          </kbd>
        </div>
      </div>
    </div>
  );
}
