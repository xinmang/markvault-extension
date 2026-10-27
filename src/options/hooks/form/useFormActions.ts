/**
 * 表单操作：保存、同步缓存、连接测试与恢复默认
 */

import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { db } from '@/lib/db'
import { TIMEOUTS } from '@/lib/constants/timeouts'
import { t } from '@/lib/i18n'
import { UserAPI } from '@/lib/api/user'
import { getAIProvider } from '@/lib/providers'
import { generateDescription } from '@/lib/services/description-generator'
import { getDescriptionConnection, getTagConnection } from '@/lib/services/ai-connection'
import type { StorageConfig } from '@/types'
import type { FormDataSetter, OptionsFormData } from '@/types/form'
import type { ConnectionTestResult, ConnectionTestTarget, FormStats } from './types'
import { defaultForm, formToConfig } from './mapping'

const SAMPLE_PAGE = {
  title: 'vercel/next.js: The React Framework',
  url: 'https://github.com/vercel/next.js',
  description: 'Contribute to vercel/next.js development by creating an account on GitHub.',
  content:
    'Next.js is a React framework for building full-stack web applications. It provides routing, server rendering, ' +
    'static site generation, image optimization and built-in support for TypeScript and Tailwind CSS.',
}

export function useFormActions(
  formData: OptionsFormData,
  setFormData: FormDataSetter,
  setStats: React.Dispatch<React.SetStateAction<FormStats>>
) {
  const { config, saveConfig, syncCache, setError, setSuccessMessage, setLoading } = useAppStore()
  const [testing, setTesting] = useState<ConnectionTestTarget | null>(null)
  const [testResults, setTestResults] = useState<Partial<Record<ConnectionTestTarget, ConnectionTestResult>>>({})

  const flash = useCallback(
    (message: string) => {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(null), TIMEOUTS.NOTIFICATION)
    },
    [setSuccessMessage]
  )

  /** 以表单草稿构造配置，测试时无需先保存 */
  const draftConfig = useCallback(
    (): StorageConfig | null => (config ? formToConfig(formData, config) : null),
    [config, formData]
  )

  const handleSave = useCallback(async () => {
    if (!config) {
      setError(t('error_config_not_loaded'))
      return
    }
    await saveConfig(formToConfig(formData, config))
    flash(t('msg_settings_saved'))
  }, [config, flash, formData, saveConfig, setError])

  const handleSync = useCallback(async () => {
    try {
      setLoading(true)
      await syncCache()
      setStats(await db.getStats())
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error_save_failed'))
    } finally {
      setLoading(false)
    }
  }, [setError, setLoading, setStats, syncCache])

  const record = (target: ConnectionTestTarget, ok: boolean, message: string) =>
    setTestResults((prev) => ({ ...prev, [target]: { ok, message, testedAt: Date.now() } }))

  const handleTest = useCallback(
    async (target: ConnectionTestTarget) => {
      const draft = draftConfig()
      if (!draft) return
      setTesting(target)
      try {
        if (target === 'markvault') {
          if (!draft.bookmarkSite.apiKey) throw new Error(t('options_test_need_key'))
          const api = new UserAPI({ apiKey: draft.bookmarkSite.apiKey, baseUrl: draft.bookmarkSite.apiUrl })
          const me = (await api.getMe()) as { data?: { user?: { username?: string } } }
          record(target, true, t('options_test_markvault_ok', me?.data?.user?.username || '—'))
          return
        }
        if (target === 'tags') {
          const connection = getTagConnection(draft)
          if (!connection) throw new Error(t('error_api_key_required'))
          const provider = getAIProvider(connection.provider)
          const response = await provider.generateTags(
            {
              page: SAMPLE_PAGE,
              context: { existingTags: ['开发', 'React', '前端', '工具', 'AI'], recentBookmarks: [] },
              options: { maxTags: 3, preferExisting: true },
            },
            connection.apiKey,
            connection.model,
            connection.apiUrl,
            draft.aiConfig.enableCustomPrompt ? draft.aiConfig.customPrompt : undefined
          )
          const names = response.suggestedTags.map((tag) => tag.name).filter(Boolean)
          record(target, true, t('options_test_tags_ok', names.join('、') || '—'))
          return
        }
        if (!getDescriptionConnection(draft)) throw new Error(t('options_description_unavailable'))
        const generated = await generateDescription(SAMPLE_PAGE, draft)
        if (!generated?.description) throw new Error(t('options_test_description_empty'))
        record(target, true, generated.description)
      } catch (e) {
        record(target, false, e instanceof Error ? e.message : t('api_test_failed'))
      } finally {
        setTesting(null)
      }
    },
    [draftConfig]
  )

  const handleReset = useCallback(() => {
    if (confirm(t('confirm_reset'))) {
      setFormData((prev) => defaultForm(prev))
      flash(t('msg_settings_reset'))
    }
  }, [flash, setFormData])

  const formatDate = useCallback((timestamp: number) => {
    if (!timestamp) return t('never_synced')
    return new Date(timestamp).toLocaleString()
  }, [])

  return {
    testing,
    testResults,
    handleSave,
    handleSync,
    handleTest,
    handleReset,
    formatDate,
  }
}
