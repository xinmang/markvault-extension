/**
 * MarkVault 扩展设置页
 *
 * 结构：顶部状态栏 + 左侧分组导航（窄屏为横向标签）+ 单分区内容 + 底部保存条
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorMessage } from '@/components/ErrorMessage';
import { SuccessMessage } from '@/components/SuccessMessage';
import { t } from '@/lib/i18n';
import { useOptionsForm } from './hooks/useOptionsForm';
import { TopBar, resolveMarkVaultStatus } from './components/layout/TopBar';
import { SideNav } from './components/layout/SideNav';
import { SaveBar } from './components/layout/SaveBar';
import { ConnectionSection } from './components/sections/ConnectionSection';
import { AIServiceSection } from './components/sections/AIServiceSection';
import { TaggingSection } from './components/sections/TaggingSection';
import { DescriptionSection } from './components/sections/DescriptionSection';
import { SaveOptionsSection } from './components/sections/SaveOptionsSection';
import { ScreenshotSection } from './components/sections/ScreenshotSection';
import { NewTabFolderSection } from './components/sections/NewTabFolderSection';
import { AppearanceSection } from './components/sections/AppearanceSection';
import { ImportSettingsSection } from './components/sections/ImportSettingsSection';
import { DataSyncSection } from './components/sections/DataSyncSection';
import { DEFAULT_SECTION, isSectionId, type SectionId } from './components/sections/sections';
import type { FormPatch } from './components/sections/types';
import { getEffectiveDescriptionModel, getEffectiveTagModel, hasUsableDescriptionModel } from './components/sections/derived';

type FormPatchSetter = (values: FormPatch) => void;

function readSectionFromHash(): SectionId {
  if (typeof window === 'undefined') return DEFAULT_SECTION;
  const raw = window.location.hash.replace(/^#/, '').trim();
  return isSectionId(raw) ? raw : DEFAULT_SECTION;
}

export function Options() {
  const {
    error,
    successMessage,
    isLoading,
    setError,
    setSuccessMessage,
    formData,
    setFormData,
    isDirty,
    loaded,
    discardChanges,
    stats,
    tagModels,
    descriptionModels,
    testing,
    testResults,
    handleProviderChange,
    handleDescriptionProviderChange,
    handleSave,
    handleSync,
    handleTest,
    handleReset,
    formatDate,
  } = useOptionsForm();

  const [section, setSection] = useState<SectionId>(readSectionFromHash);
  const [saving, setSaving] = useState(false);

  // 记住最后一次分区：写入 location.hash，刷新或外部链接都能回到同一位置
  useEffect(() => {
    const onHashChange = () => setSection(readSectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${DEFAULT_SECTION}`);
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectSection = useCallback((next: SectionId) => {
    setSection(next);
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const patch = useCallback<FormPatchSetter>(
    (values) => {
      setFormData((prev) => ({ ...prev, ...values }));
    },
    [setFormData]
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      await handleSave();
    } finally {
      setSaving(false);
    }
  }, [handleSave]);

  const markVaultStatus = useMemo(
    () => resolveMarkVaultStatus(Boolean(formData.bookmarkApiKey.trim()), testResults.markvault?.ok),
    [formData.bookmarkApiKey, testResults.markvault]
  );

  const tagModel = useMemo(() => getEffectiveTagModel(formData), [formData]);
  const descriptionModel = useMemo(() => getEffectiveDescriptionModel(formData), [formData]);
  const descriptionModelAvailable = useMemo(() => hasUsableDescriptionModel(formData), [formData]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tab-options-page-bg-via)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--tab-options-text-muted)] border-t-transparent"
          role="status"
          aria-label={t('options_loading')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--tab-options-page-bg-from)] via-[var(--tab-options-page-bg-via)] to-[var(--tab-options-page-bg-to)]">
      {/* 通知：固定在顶部居中 */}
      <div className="pointer-events-none fixed left-0 right-0 top-[60px] z-50 flex justify-center px-4 pt-2">
        <div className="pointer-events-auto w-full max-w-md space-y-2">
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
          {successMessage && <SuccessMessage message={successMessage} onDismiss={() => setSuccessMessage(null)} />}
        </div>
      </div>

      <TopBar
        markVaultStatus={markVaultStatus}
        aiTagModel={tagModel}
        aiDescriptionModel={descriptionModel}
      />

      <div className="mx-auto max-w-[1100px] px-4 pb-32 pt-6 sm:px-6">
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <SideNav active={section} onSelect={selectSection} />

          <main className="mx-auto w-full max-w-[760px] space-y-5">
            {section === 'connection' && (
              <ConnectionSection
                apiUrl={formData.bookmarkApiUrl}
                apiKey={formData.bookmarkApiKey}
                onChange={patch}
                onTest={() => void handleTest('markvault')}
                isTesting={testing === 'markvault'}
                testResult={testResults.markvault}
              />
            )}

            {section === 'ai-service' && (
              <AIServiceSection
                provider={formData.aiProvider}
                apiUrl={formData.apiUrl}
                apiKey={formData.apiKey}
                onProviderChange={handleProviderChange}
                patch={patch}
                tagModels={tagModels}
                isTestingTags={testing === 'tags'}
                tagTestResult={testResults.tags}
                aiModel={formData.aiModel}
                descriptionModel={formData.descriptionModel}
                descriptionModels={descriptionModels}
                descriptionServiceEnabled={formData.descriptionServiceEnabled}
                descriptionProvider={formData.descriptionProvider}
                descriptionApiUrl={formData.descriptionApiUrl}
                descriptionApiKey={formData.descriptionApiKey}
                onDescriptionProviderChange={handleDescriptionProviderChange}
                onTestTags={() => void handleTest('tags')}
                onTestDescription={() => void handleTest('description')}
                isTestingDescription={testing === 'description'}
                descriptionTestResult={testResults.description}
                hasDescriptionModel={descriptionModelAvailable}
              />
            )}

            {section === 'tagging' && (
              <TaggingSection
                enableAI={formData.enableAI}
                maxSuggestedTags={formData.maxSuggestedTags}
                enableCustomPrompt={formData.enableCustomPrompt}
                customPrompt={formData.customPrompt}
                patch={patch}
              />
            )}

            {section === 'description' && (
              <DescriptionSection
                enableAIDescription={formData.enableAIDescription}
                enableDescriptionPrompt={formData.enableDescriptionPrompt}
                descriptionPrompt={formData.descriptionPrompt}
                hasDescriptionModel={descriptionModelAvailable}
                onOpenAIService={() => selectSection('ai-service')}
                patch={patch}
              />
            )}

            {section === 'save-options' && (
              <SaveOptionsSection
                defaultIncludeThumbnail={formData.defaultIncludeThumbnail}
                defaultCreateSnapshot={formData.defaultCreateSnapshot}
                defaultIsPublic={formData.defaultIsPublic}
                defaultCreateScreenshot={formData.defaultCreateScreenshot}
                patch={patch}
              />
            )}

            {section === 'screenshot' && (
              <ScreenshotSection
                screenshotDomains={formData.screenshotDomains}
                screenshotTheme={formData.screenshotTheme}
                patch={patch}
              />
            )}

            {section === 'newtab-folder' && (
              <NewTabFolderSection
                enableNewtabAI={formData.enableNewtabAI}
                newtabFolderRecommendCount={formData.newtabFolderRecommendCount}
                enableNewtabFolderPrompt={formData.enableNewtabFolderPrompt}
                newtabFolderPrompt={formData.newtabFolderPrompt}
                patch={patch}
                setSuccessMessage={setSuccessMessage}
              />
            )}

            {section === 'appearance' && (
              <AppearanceSection
                theme={formData.theme}
                themeStyle={formData.themeStyle}
                tagTheme={formData.tagTheme}
                patch={patch}
                onReset={handleReset}
              />
            )}

            {section === 'import' && (
              <ImportSettingsSection
                formData={formData}
                setSuccessMessage={setSuccessMessage}
                setError={setError}
                patch={patch}
              />
            )}

            {section === 'data-sync' && (
              <DataSyncSection
                stats={stats}
                isLoading={isLoading}
                onSync={() => void handleSync()}
                formatDate={formatDate}
              />
            )}
          </main>
        </div>
      </div>

      <SaveBar
        visible={isDirty}
        saving={saving}
        onDiscard={discardChanges}
        onSave={() => void onSave()}
      />
    </div>
  );
}
