/**
 * 折叠区：默认收起，展开/收起有旋转箭头
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** 标题右侧的附加信息（例如「已启用」） */
  aside?: ReactNode;
}

export function Collapsible({ title, children, defaultOpen = false, aside }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[color:var(--tab-options-card-border)]">
      <div className="flex min-h-[44px] items-center justify-between gap-3 px-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex min-h-[44px] flex-1 items-center gap-2 py-2 text-left text-sm font-medium text-[color:var(--tab-options-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)]"
        >
          <ChevronDown
            aria-hidden="true"
            className={['h-4 w-4 flex-shrink-0 text-[color:var(--tab-options-text-muted)] transition-transform', open ? '' : '-rotate-90'].join(' ')}
          />
          <span className="min-w-0">{title}</span>
        </button>
        {aside ? <div className="flex flex-shrink-0 items-center gap-2">{aside}</div> : null}
      </div>
      {open ? <div className="space-y-4 border-t border-[color:var(--tab-options-card-border)] px-3 py-4">{children}</div> : null}
    </div>
  );
}
