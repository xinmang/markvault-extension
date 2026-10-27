/**
 * 提示框：info / warning / success，用于能力说明与前置条件提示
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

type CalloutVariant = 'info' | 'warning';

interface CalloutProps {
  variant?: CalloutVariant;
  children: ReactNode;
  /** 加粗的标题行 */
  title?: ReactNode;
  className?: string;
}

export function Callout({ variant = 'info', title, children, className }: CalloutProps) {
  const Icon = variant === 'warning' ? AlertTriangle : Info;
  return (
    <div
      className={[
        'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-xs leading-relaxed',
        variant === 'warning'
          ? 'border-[color:var(--tab-message-warning-border)] bg-[color:var(--tab-message-warning-bg)] text-[color:var(--tab-options-text)]'
          : 'border-[color:var(--tab-message-info-border)] bg-[color:var(--tab-message-info-bg)] text-[color:var(--tab-options-text)]',
        className ?? '',
      ].join(' ')}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? (
          <p className="mb-1 font-medium text-[color:var(--tab-options-title)]">{title}</p>
        ) : null}
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );
}
