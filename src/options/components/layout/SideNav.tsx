/**
 * 左侧导航（≥1024px 竖排）与窄屏横向滚动标签行
 */

import { t } from '@/lib/i18n';
import { SECTION_GROUPS, type SectionId } from '../sections/sections';

interface SideNavProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

function NavButton({
  id,
  label,
  active,
  onSelect,
  variant,
}: {
  id: SectionId;
  label: string;
  active: boolean;
  onSelect: (id: SectionId) => void;
  variant: 'sidebar' | 'tabs';
}) {
  const base =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tab-options-focus-blue)] transition-colors';
  const className =
    variant === 'sidebar'
      ? [
          base,
          'flex min-h-[36px] w-full items-center rounded-lg px-3 py-1.5 text-left text-sm',
          active
            ? 'bg-[color:var(--tab-options-button-primary-bg)] font-medium text-[color:var(--tab-options-button-primary-text)]'
            : 'text-[color:var(--tab-options-text)] hover:bg-[color:var(--tab-options-button-hover-bg)] hover:text-[color:var(--tab-options-title)]',
        ].join(' ')
      : [
          base,
          'inline-flex min-h-[36px] flex-shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
          active
            ? 'bg-[color:var(--tab-options-button-primary-bg)] font-medium text-[color:var(--tab-options-button-primary-text)]'
            : 'border border-[color:var(--tab-options-card-border)] text-[color:var(--tab-options-text)] hover:bg-[color:var(--tab-options-button-hover-bg)]',
        ].join(' ');

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {label}
    </button>
  );
}

export function SideNav({ active, onSelect }: SideNavProps) {
  return (
    <>
      {/* 窄屏：横向滚动标签行 */}
      <nav
        aria-label={t('options_nav_aria')}
        className="mb-4 lg:hidden"
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <div className="flex min-w-max gap-2">
            {SECTION_GROUPS.flatMap((group) =>
              group.items.map((item) => (
                <NavButton
                  key={item.id}
                  id={item.id}
                  label={t(item.labelKey)}
                  active={active === item.id}
                  onSelect={onSelect}
                  variant="tabs"
                />
              ))
            )}
          </div>
        </div>
      </nav>

      {/* ≥1024px：分组竖排导航 */}
      <nav aria-label={t('options_nav_aria')} className="hidden lg:block">
        <div className="sticky top-[76px] space-y-5">
          {SECTION_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tab-options-text-muted)]">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavButton
                    key={item.id}
                    id={item.id}
                    label={t(item.labelKey)}
                    active={active === item.id}
                    onSelect={onSelect}
                    variant="sidebar"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
