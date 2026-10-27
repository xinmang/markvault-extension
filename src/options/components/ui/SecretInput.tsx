/**
 * 密钥输入框：默认隐藏，可切换显示
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { t } from '@/lib/i18n';
import { inputClassName } from './TextInput';

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  autoComplete?: string;
}

export function SecretInput({ value, onChange, placeholder, id, autoComplete = 'off' }: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className={[inputClassName, 'pr-11'].join(' ')}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? t('options_secret_hide') : t('options_secret_show')}
        aria-pressed={visible}
        title={visible ? t('options_secret_hide') : t('options_secret_show')}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--tab-options-text-muted)] transition-colors hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
