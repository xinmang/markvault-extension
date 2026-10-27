/**
 * 开关：原生 button + role="switch"，支持键盘操作
 */

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 供读屏使用的名称（没有可见 label 时必填） */
  label?: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, label, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        // 扩大点击热区到 36px 以上，视觉尺寸保持不变
        "after:absolute after:-inset-2 after:content-['']",
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--tab-options-card-bg)]',
        checked ? 'bg-[color:var(--tab-options-switch-blue-on)]' : 'bg-[color:var(--tab-options-switch-track-off)]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[color:var(--tab-options-switch-thumb)] shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
