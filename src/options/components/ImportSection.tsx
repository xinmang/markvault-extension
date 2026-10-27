/**
 * 导入功能组件 - 支持导入到 MarkVault 或 NewTab
 * 容器使用设置页的新卡片样式；具体导入流程沿用 import/** 下的组件
 */

import { useState } from 'react'
import { ArrowLeft, FolderTree } from 'lucide-react'
import { TMarksImport } from './import/TMarksImport'
import { NewTabImport } from './import/NewTabImport'
import { SettingsCard } from './ui'
import { t } from '@/lib/i18n'

interface ImportSectionProps {
  formData: any
  setSuccessMessage: (msg: string) => void
  setError: (msg: string) => void
}

type ImportTarget = 'tmarks' | 'newtab'

function BackToTargets({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[color:var(--tab-options-text)] transition-colors hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t('btn_back')}
    </button>
  )
}

export function ImportSection({ formData, setSuccessMessage, setError }: ImportSectionProps) {
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null)

  // 如果已选择目标，显示对应的导入组件
  if (importTarget === 'tmarks') {
    return (
      <div className="space-y-4">
        <BackToTargets onClick={() => setImportTarget(null)} />
        <TMarksImport
          formData={formData}
          setSuccessMessage={setSuccessMessage}
          setError={setError}
          onBack={() => setImportTarget(null)}
        />
      </div>
    )
  }

  if (importTarget === 'newtab') {
    return (
      <div className="space-y-4">
        <BackToTargets onClick={() => setImportTarget(null)} />
        <NewTabImport
          setSuccessMessage={setSuccessMessage}
          setError={setError}
          onBack={() => setImportTarget(null)}
        />
      </div>
    )
  }

  return (
    <SettingsCard title={t('import_select_target')} description={t('import_select_target_desc')}>
      <div className="grid gap-3 md:grid-cols-2">
        {/* 导入到 MarkVault */}
        <button
          type="button"
          onClick={() => setImportTarget('tmarks')}
          className="group flex h-full flex-col gap-3 rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] p-4 text-left transition-colors hover:border-[color:var(--tab-options-button-border)] hover:bg-[color:var(--tab-options-button-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-card-bg)] text-[color:var(--tab-options-title)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-[color:var(--tab-options-title)]">{t('import_to_tmarks')}</span>
          <span className="text-xs leading-relaxed text-[color:var(--tab-options-text)]">{t('import_to_tmarks_desc')}</span>
          <ul className="mt-auto space-y-1 text-xs text-[color:var(--tab-options-text-muted)]">
            <li>• {t('import_tmarks_feature_1')}</li>
            <li>• {t('import_tmarks_feature_2')}</li>
            <li>• {t('import_tmarks_feature_3')}</li>
          </ul>
        </button>

        {/* 导入到 NewTab */}
        <button
          type="button"
          onClick={() => setImportTarget('newtab')}
          className="group flex h-full flex-col gap-3 rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] p-4 text-left transition-colors hover:border-[color:var(--tab-options-button-border)] hover:bg-[color:var(--tab-options-button-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-card-bg)] text-[color:var(--tab-options-title)]">
            <FolderTree className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-[color:var(--tab-options-title)]">{t('import_to_newtab')}</span>
          <span className="text-xs leading-relaxed text-[color:var(--tab-options-text)]">{t('import_to_newtab_desc')}</span>
          <ul className="mt-auto space-y-1 text-xs text-[color:var(--tab-options-text-muted)]">
            <li>• {t('import_newtab_feature_1')}</li>
            <li>• {t('import_newtab_feature_2')}</li>
            <li>• {t('import_newtab_feature_3')}</li>
          </ul>
        </button>
      </div>
    </SettingsCard>
  )
}
