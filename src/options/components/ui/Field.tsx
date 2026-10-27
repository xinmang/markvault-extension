/**
 * 表单字段：标签 + 说明 + 错误提示，统一间距
 */

import type { ReactNode } from 'react';

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  /** 字段下方的一行灰色说明 */
  help?: ReactNode;
  error?: string | null;
  /** 字段右上角的操作（如刷新按钮） */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, help, error, action, children, className }: FieldProps) {
  return (
    <div className={['space-y-2', className ?? ''].join(' ')}>
      {(label || action) && (
        <div className="flex items-start justify-between gap-3">
          {label ? (
            <label htmlFor={htmlFor} className="text-sm font-medium text-[color:var(--tab-options-title)]">
              {label}
            </label>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
      {help && !error && (
        <p className="text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{help}</p>
      )}
      {error && <p className="text-xs leading-relaxed text-[color:var(--tab-options-danger-text)]">{error}</p>}
    </div>
  );
}
