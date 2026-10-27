/**
 * 文本输入框（统一外观、焦点环与最小高度）
 */

import { forwardRef, type InputHTMLAttributes } from 'react';

export const inputClassName = [
  'w-full min-h-[40px] rounded-lg border border-[color:var(--tab-options-button-border)]',
  'bg-[color:var(--tab-options-card-bg)] px-3 py-2 text-sm text-[color:var(--tab-options-title)]',
  'placeholder:text-[color:var(--tab-options-text-muted)]',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)] focus-visible:border-[color:var(--tab-options-focus-blue)]',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, ...rest },
  ref
) {
  return <input ref={ref} {...rest} className={[inputClassName, className ?? ''].join(' ')} />;
});
