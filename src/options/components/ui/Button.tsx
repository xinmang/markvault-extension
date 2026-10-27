/**
 * 按钮：primary / secondary / ghost 三种外观，最小 36px 高度
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--tab-options-button-primary-bg)] text-[color:var(--tab-options-button-primary-text)] hover:bg-[color:var(--tab-options-button-primary-hover)] shadow-sm',
  secondary:
    'border border-[color:var(--tab-options-button-border)] bg-transparent text-[color:var(--tab-options-button-text)] hover:bg-[color:var(--tab-options-button-hover-bg)]',
  ghost:
    'border border-transparent bg-transparent text-[color:var(--tab-options-text)] hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)]',
  danger:
    'border border-[color:var(--tab-options-danger-border)] bg-[color:var(--tab-options-danger-bg)] text-[color:var(--tab-options-danger-text)] hover:opacity-80',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg px-3.5 font-medium transition-colors',
        'text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--tab-options-card-bg)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'text-xs' : 'text-sm',
        VARIANT_CLASSES[variant],
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
