/**
 * 设置页：根据表单与测试结果推导出的展示状态
 */

import { canGenerateText } from '@/lib/services/ai-connection';
import type { OptionsFormData } from '@/types/form';
import { getProviderName } from '../provider-utils';

/** 标签分类实际使用的模型名；没填模型时显示服务商（使用其默认模型），没有密钥时返回空串 */
export function getEffectiveTagModel(form: OptionsFormData): string {
  if (!form.apiKey.trim()) return '';
  return form.aiModel.trim() || getProviderName(form.aiProvider);
}

/**
 * 描述生成实际使用的模型名。
 * 没有可生成文字的连接、或用户关闭了描述生成时返回空串（UI 显示「不生成」）；
 * 没填模型时显示服务商名称，表示使用该服务的默认模型。
 */
export function getEffectiveDescriptionModel(form: OptionsFormData): string {
  if (!form.enableAIDescription) return '';
  if (form.descriptionServiceEnabled) {
    if (!form.descriptionApiKey.trim() || !canGenerateText(form.descriptionProvider)) return '';
    return form.descriptionModel.trim() || getProviderName(form.descriptionProvider);
  }
  if (!form.apiKey.trim() || !canGenerateText(form.aiProvider)) return '';
  return form.descriptionModel.trim() || form.aiModel.trim() || getProviderName(form.aiProvider);
}

/** 是否存在可用的描述模型（与 getDescriptionConnection 的判定一致） */
export function hasUsableDescriptionModel(form: OptionsFormData): boolean {
  if (form.descriptionServiceEnabled) {
    return Boolean(form.descriptionApiKey.trim()) && canGenerateText(form.descriptionProvider);
  }
  return Boolean(form.apiKey.trim()) && canGenerateText(form.aiProvider);
}
