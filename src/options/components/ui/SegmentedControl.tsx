/**
 * 分段控件：一组互斥选项（主题、样式、截图配色等）
 */

import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  /** 整组的无障碍名称 */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={[
        'inline-flex max-w-full flex-wrap gap-0.5 rounded-xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-segment-bg)] p-1',
        disabled ? 'opacity-60' : '',
        className ?? '',
      ].join(' ')}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              'min-h-[36px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]',
              selected
                ? 'bg-[color:var(--tab-options-button-primary-bg)] text-[color:var(--tab-options-button-primary-text)] shadow'
                : 'text-[color:var(--tab-options-segment-text)] hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)]',
              disabled ? 'cursor-not-allowed' : '',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
