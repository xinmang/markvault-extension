/**
 * 其他：导入书签（容器 + AI 批量导入分组数）
 */

import type { OptionsFormData } from '@/types/form';
import type { FormPatch } from './types';
import { t } from '@/lib/i18n';
import { ImportSection } from '../ImportSection';
import { SettingsCard, SliderField } from '../ui';

interface ImportSettingsSectionProps {
  formData: OptionsFormData;
  setSuccessMessage: (message: string | null) => void;
  setError: (message: string | null) => void;
  patch: (patch: FormPatch) => void;
}

export function ImportSettingsSection({ formData, setSuccessMessage, setError, patch }: ImportSettingsSectionProps) {
  return (
    <div className="space-y-5">
      <SettingsCard title={t('options_import_card_title')} description={t('options_import_card_desc')}>
        <SliderField
          id="max-import-groups"
          label={t('options_import_max_groups')}
          value={formData.maxImportGroups}
          min={1}
          max={20}
          onChange={(value) => patch({ maxImportGroups: value })}
          help={t('options_import_max_groups_help')}
          unit={t('options_tag_max_unit')}
        />
      </SettingsCard>

      <ImportSection formData={formData} setSuccessMessage={setSuccessMessage} setError={setError} />
    </div>
  );
}
