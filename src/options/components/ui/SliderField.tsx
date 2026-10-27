/**
 * 滑块字段：标题一行显示当前值，下方为 range
 */

import type { ReactNode } from 'react';

interface SliderFieldProps {
  id?: string;
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  help?: ReactNode;
  /** 数值后缀，默认「个」 */
  unit?: string;
  disabled?: boolean;
}

export function SliderField({ id, label, value, min, max, onChange, help, unit = '个', disabled = false }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[color:var(--tab-options-title)]">
          {label}
        </label>
        <span className="min-w-[3rem] text-right text-sm font-semibold text-[color:var(--tab-options-title)]">
          {value} {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full cursor-pointer accent-[color:var(--tab-options-button-primary-bg)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)] focus-visible:ring-offset-2"
      />
      {help ? <p className="text-xs leading-relaxed text-[color:var(--tab-options-text-muted)]">{help}</p> : null}
    </div>
  );
}
