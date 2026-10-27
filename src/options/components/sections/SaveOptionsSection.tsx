/**
 * 保存书签：保存选项
 */

import type { FormPatch } from './types';
import { t } from '@/lib/i18n';
import { SettingsCard, ToggleRow } from '../ui';

interface SaveOptionsSectionProps {
  defaultIncludeThumbnail: boolean;
  defaultCreateSnapshot: boolean;
  defaultIsPublic: boolean;
  defaultCreateScreenshot: boolean;
  patch: (patch: FormPatch) => void;
}

export function SaveOptionsSection({
  defaultIncludeThumbnail,
  defaultCreateSnapshot,
  defaultIsPublic,
  defaultCreateScreenshot,
  patch,
}: SaveOptionsSectionProps) {
  return (
    <SettingsCard title={t('options_save_card_title')} description={t('options_save_card_desc')}>
      <div className="divide-y divide-[color:var(--tab-options-card-border)]">
        <div className="pb-3">
          <ToggleRow
            id="default-include-thumbnail"
            checked={defaultIncludeThumbnail}
            onChange={(checked) => patch({ defaultIncludeThumbnail: checked })}
            label={t('options_save_thumbnail')}
            description={t('options_save_thumbnail_help')}
          />
        </div>
        <div className="py-3">
          <ToggleRow
            id="default-create-snapshot"
            checked={defaultCreateSnapshot}
            onChange={(checked) => patch({ defaultCreateSnapshot: checked })}
            label={t('options_save_snapshot')}
            description={t('options_save_snapshot_help')}
          />
        </div>
        <div className="py-3">
          <ToggleRow
            id="default-is-public"
            checked={defaultIsPublic}
            onChange={(checked) => patch({ defaultIsPublic: checked })}
            label={t('options_save_public')}
            description={t('options_save_public_help')}
          />
        </div>
        <div className="pt-3">
          <ToggleRow
            id="default-create-screenshot"
            checked={defaultCreateScreenshot}
            onChange={(checked) => patch({ defaultCreateScreenshot: checked })}
            label={t('options_save_screenshot')}
            description={t('options_save_screenshot_help')}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
