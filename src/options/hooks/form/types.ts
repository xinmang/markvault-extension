/**
 * Options 表单类型定义
 */

export type { OptionsFormData, FormDataSetter } from '@/types/form'

export interface FormStats {
  tags: number
  bookmarks: number
  lastSync: number
}

export interface ModelFetchState {
  availableModels: string[]
  isFetchingModels: boolean
  modelFetchError: string | null
  modelFetchNonce: number
}

/** 连接测试的结果，显示在对应的设置区块内 */
export interface ConnectionTestResult {
  ok: boolean
  message: string
  testedAt: number
}

export type ConnectionTestTarget = 'markvault' | 'tags' | 'description'
