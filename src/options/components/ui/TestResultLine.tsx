/**
 * 连接测试结果行（绿色 ✓ / 红色 ✗ + 文案）
 */

import type { ConnectionTestResult } from '../../hooks/form/types';

interface TestResultLineProps {
  result?: ConnectionTestResult;
  /** 测试进行中时显示占位文案 */
  pendingText?: string;
  pending?: boolean;
}

export function TestResultLine({ result, pending = false, pendingText }: TestResultLineProps) {
  if (pending) {
    return (
      <p className="flex items-start gap-2 text-xs text-[color:var(--tab-options-text-muted)]" role="status">
        <span className="mt-[1px] inline-block h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>{pendingText}</span>
      </p>
    );
  }

  if (!result) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={[
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed',
        result.ok
          ? 'border-[color:var(--tab-message-success-border)] bg-[color:var(--tab-message-success-bg)] text-[color:var(--tab-message-success-icon)]'
          : 'border-[color:var(--tab-message-danger-border)] bg-[color:var(--tab-message-danger-bg)] text-[color:var(--tab-message-danger-icon)]',
      ].join(' ')}
    >
      <span aria-hidden="true" className="mt-[1px] flex-shrink-0 font-semibold">
        {result.ok ? '✓' : '✗'}
      </span>
      <span className="whitespace-pre-wrap break-words">{result.message}</span>
    </p>
  );
}
