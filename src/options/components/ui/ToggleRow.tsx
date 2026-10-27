/**
 * 开关行：左侧标题与说明，右侧开关
 */

import type { ReactNode } from 'react';
import { Toggle } from './Toggle';

interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  /** 关闭时在标题右侧显示的提示 */
  badge?: ReactNode;
}

export function ToggleRow({ checked, onChange, label, description, disabled, id, badge }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-sm font-medium text-[color:var(--tab-options-title)]">
            {label}
          </label>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="pt-0.5">
        <Toggle id={id} checked={checked} onChange={onChange} disabled={disabled} label={typeof label === 'string' ? label : undefined} />
      </div>
    </div>
  );
}
