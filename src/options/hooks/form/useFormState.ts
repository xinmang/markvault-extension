/**
 * 表单状态管理：加载已保存的配置，记录草稿与是否有未保存的修改
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { db } from '@/lib/db'
import type { AIProvider } from '@/types'
import type { FormDataSetter, OptionsFormData } from '@/types/form'
import type { FormStats } from './types'
import { configToForm, defaultForm, isFormDirty } from './mapping'

export function useFormState() {
  const { config, loadConfig } = useAppStore()

  const [formData, setFormDataState] = useState<OptionsFormData>(() => defaultForm())
  const [savedForm, setSavedForm] = useState<OptionsFormData>(() => defaultForm())
  const [loaded, setLoaded] = useState(false)
  const [stats, setStats] = useState<FormStats>({ tags: 0, bookmarks: 0, lastSync: 0 })

  useEffect(() => {
    const init = async () => {
      await loadConfig()
      setStats(await db.getStats())
    }
    void init()
  }, [loadConfig])

  // 配置加载或保存后，草稿与“已保存”快照同步为最新配置
  useEffect(() => {
    if (!config) return
    const next = configToForm(config)
    setFormDataState(next)
    setSavedForm(next)
    setLoaded(true)
  }, [config])

  /** 支持传入部分字段或更新函数 */
  const setFormData: FormDataSetter = useCallback((updater) => {
    setFormDataState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))
  }, [])

  /** 切换服务商时清空不再适用的地址与模型，密钥保留由用户确认 */
  const handleProviderChange = useCallback(
    (provider: AIProvider) => {
      setFormData((prev) => (prev.aiProvider === provider ? prev : { ...prev, aiProvider: provider, apiUrl: '', aiModel: '' }))
    },
    [setFormData]
  )

  const handleDescriptionProviderChange = useCallback(
    (provider: AIProvider) => {
      setFormData((prev) =>
        prev.descriptionProvider === provider
          ? prev
          : { ...prev, descriptionProvider: provider, descriptionApiUrl: '', descriptionModel: '' }
      )
    },
    [setFormData]
  )

  const isDirty = useMemo(() => loaded && isFormDirty(formData, savedForm), [formData, loaded, savedForm])

  const discardChanges = useCallback(() => setFormDataState(savedForm), [savedForm])

  return {
    formData,
    setFormData,
    savedForm,
    isDirty,
    loaded,
    discardChanges,
    stats,
    setStats,
    handleProviderChange,
    handleDescriptionProviderChange,
  }
}
