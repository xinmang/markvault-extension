/**
 * 新标签页：文件夹推荐
 */

import type { FormPatch } from './types';
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { NEWTAB_FOLDER_PROMPT_TEMPLATE } from '@/lib/constants/newtabPrompts';
import { Button, Collapsible, PromptEditor, SettingsCard, SliderField, Toggle, ToggleRow } from '../ui';

interface NewTabFolderSectionProps {
  enableNewtabAI: boolean;
  newtabFolderRecommendCount: number;
  enableNewtabFolderPrompt: boolean;
  newtabFolderPrompt: string;
  patch: (patch: FormPatch) => void;
  setSuccessMessage: (message: string | null) => void;
}

export function NewTabFolderSection({
  enableNewtabAI,
  newtabFolderRecommendCount,
  enableNewtabFolderPrompt,
  newtabFolderPrompt,
  patch,
  setSuccessMessage,
}: NewTabFolderSectionProps) {
  const [isLoadingFolderPaths, setIsLoadingFolderPaths] = useState(false);
  const [folderPathsError, setFolderPathsError] = useState<string | null>(null);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);

  const loadFolderPaths = async () => {
    try {
      setIsLoadingFolderPaths(true);
      setFolderPathsError(null);

      if (!chrome?.runtime?.sendMessage) {
        throw new Error(t('options_chrome_runtime_error'));
      }

      const resp = (await chrome.runtime.sendMessage({ type: 'GET_NEWTAB_FOLDERS' })) as {
        success: boolean;
        data?: {
          rootId: string;
          folders: Array<{ id: string; title: string; parentId: string | null; path: string }>;
        };
        error?: string;
      };

      if (!resp?.success) {
        throw new Error(resp?.error || t('options_load_paths_failed'));
      }

      const paths = (resp.data?.folders || [])
        .filter((folder) => folder.id !== resp.data?.rootId)
        .map((folder) => folder.path)
        .filter(Boolean);

      setFolderPaths(paths);
      setSuccessMessage(t('options_load_paths_success'));
    } catch (error) {
      setFolderPathsError(error instanceof Error ? error.message : t('options_load_paths_failed'));
      setFolderPaths([]);
    } finally {
      setIsLoadingFolderPaths(false);
    }
  };

  return (
    <SettingsCard title={t('options_newtab_folder_title')} description={t('options_newtab_card_desc')}>
      <ToggleRow
        id="enable-newtab-ai"
        checked={enableNewtabAI}
        onChange={(checked) => patch({ enableNewtabAI: checked })}
        label={t('options_newtab_enable')}
        description={t('options_newtab_enable_help')}
      />

      <SliderField
        id="newtab-folder-count"
        label={t('options_newtab_count')}
        value={newtabFolderRecommendCount}
        min={1}
        max={20}
        disabled={!enableNewtabAI}
        onChange={(value) => patch({ newtabFolderRecommendCount: value })}
        help={t('options_newtab_count_help')}
        unit={t('options_tag_max_unit')}
      />

      <Collapsible
        title={t('options_newtab_prompt_toggle')}
        aside={
          <span className="text-xs text-[color:var(--tab-options-text-muted)]">
            {enableNewtabFolderPrompt ? t('options_enabled') : t('options_disabled')}
          </span>
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--tab-options-title)]">{t('options_prompt_enable')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">
              {t('options_prompt_enable_help')}
            </p>
          </div>
          <div className="pt-0.5">
            <Toggle
              checked={enableNewtabFolderPrompt}
              disabled={!enableNewtabAI}
              onChange={(checked) => patch({ enableNewtabFolderPrompt: checked })}
              label={t('options_newtab_prompt_toggle')}
            />
          </div>
        </div>

        {enableNewtabFolderPrompt ? (
          <PromptEditor
            id="newtab-folder-prompt"
            value={newtabFolderPrompt}
            onChange={(value) => patch({ newtabFolderPrompt: value })}
            defaultTemplate={NEWTAB_FOLDER_PROMPT_TEMPLATE}
            variablesHelp={t('options_newtab_prompt_variables')}
            disabled={!enableNewtabAI}
          />
        ) : null}
      </Collapsible>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void loadFolderPaths()} loading={isLoadingFolderPaths}>
            {isLoadingFolderPaths ? t('options_loading_paths') : t('options_load_paths')}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{t('options_newtab_paths_help')}</p>
        {folderPathsError ? (
          <p className="text-xs text-[color:var(--tab-options-danger-text)]">{folderPathsError}</p>
        ) : null}
        {folderPaths.length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-tag-bg)] p-2">
            <p className="mb-1 text-xs text-[color:var(--tab-options-text-muted)]">
              {t('options_paths_loaded', [String(folderPaths.length)])}
            </p>
            {folderPaths.slice(0, 10).map((path) => (
              <div key={path} className="text-xs text-[color:var(--tab-options-text)]">
                {path}
              </div>
            ))}
            {folderPaths.length > 10 ? (
              <div className="text-xs text-[color:var(--tab-options-text-muted)]">
                {t('options_more_paths', [String(folderPaths.length - 10)])}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SettingsCard>
  );
}
