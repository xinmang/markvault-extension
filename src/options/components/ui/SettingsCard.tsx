/**
 * 设置卡片：标题 + 一行说明 + 内容
 */

import type { ReactNode } from 'react';

interface SettingsCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** 标题右侧的附加内容（如状态标签） */
  aside?: ReactNode;
  className?: string;
}

export function SettingsCard({ title, description, icon, children, footer, aside, className }: SettingsCardProps) {
  return (
    <section
      className={[
        'rounded-2xl border border-[color:var(--tab-options-card-border)] bg-[color:var(--tab-options-card-bg)] shadow-sm backdrop-blur',
        className ?? '',
      ].join(' ')}
    >
      <div className="p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[color:var(--tab-options-title)]">
              {icon ? <span className="flex-shrink-0 text-[color:var(--tab-options-text-muted)]">{icon}</span> : null}
              <span className="min-w-0 break-words">{title}</span>
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--tab-options-text)]">{description}</p>
            ) : null}
          </div>
          {aside ? <div className="flex-shrink-0">{aside}</div> : null}
        </header>
        {children ? <div className="mt-5 space-y-5">{children}</div> : null}
      </div>
      {footer ? (
        <div className="border-t border-[color:var(--tab-options-card-border)] px-5 py-4 sm:px-6">{footer}</div>
      ) : null}
    </section>
  );
}
