/**
 * 提示词编辑器：textarea + 恢复默认模板 + 变量说明
 */

import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { inputClassName } from './TextInput';
import { Button } from './Button';

interface PromptEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** 默认模板，用于「恢复默认模板」 */
  defaultTemplate: string;
  /** 变量说明文案（已翻译） */
  variablesHelp: ReactNode;
  rows?: number;
  disabled?: boolean;
}

export function PromptEditor({
  id,
  value,
  onChange,
  defaultTemplate,
  variablesHelp,
  rows = 12,
  disabled = false,
}: PromptEditorProps) {
  return (
    <div className="space-y-3">
      <textarea
        id={id}
        value={value}
        rows={rows}
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={[inputClassName, 'resize-y font-mono text-xs leading-relaxed'].join(' ')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{variablesHelp}</p>
        <Button variant="secondary" size="sm" onClick={() => onChange(defaultTemplate)} disabled={disabled}>
          {t('options_prompt_reset_default')}
        </Button>
      </div>
    </div>
  );
}
