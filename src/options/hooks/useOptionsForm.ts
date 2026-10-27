/**
 * Options 表单主 Hook（组合所有子 Hook）
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { useFormState } from './form/useFormState'
import { useModelFetch } from './form/useModelFetch'
import { useFormActions } from './form/useFormActions'
import { useTheme } from './form/useTheme'

export function useOptionsForm() {
  const { config, error, successMessage, isLoading, setError, setSuccessMessage } = useAppStore()

  const {
    formData,
    setFormData,
    isDirty,
    loaded,
    discardChanges,
    stats,
    setStats,
    handleProviderChange,
    handleDescriptionProviderChange,
  } = useFormState()

  // 主题管理
  useTheme(formData.theme, formData.themeStyle)

  // 主服务的模型列表（标签分类模型与默认的描述模型都从这里选择）
  const tagModels = useModelFetch(formData.aiProvider, formData.apiUrl, formData.apiKey, (models) => {
    if (!formData.aiModel && models.length > 0) {
      setFormData({ aiModel: models[0] })
    }
  })

  // 独立描述服务的模型列表
  const descriptionModels = useModelFetch(
    formData.descriptionProvider,
    formData.descriptionApiUrl,
    formData.descriptionServiceEnabled ? formData.descriptionApiKey : ''
  )

  const actions = useFormActions(formData, setFormData, setStats)

  // Ctrl/Cmd + S 保存；监听只注册一次，通过 ref 读取最新状态
  const saveShortcut = useRef({ isDirty, save: actions.handleSave })
  saveShortcut.current = { isDirty, save: actions.handleSave }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (saveShortcut.current.isDirty) void saveShortcut.current.save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 有未保存的修改时离开页面前提示
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  return {
    config,
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

    handleProviderChange: (provider: Parameters<typeof handleProviderChange>[0]) => {
      handleProviderChange(provider)
      tagModels.resetModelFetch()
    },
    handleDescriptionProviderChange: (provider: Parameters<typeof handleDescriptionProviderChange>[0]) => {
      handleDescriptionProviderChange(provider)
      descriptionModels.resetModelFetch()
    },
    ...actions,
  }
}
