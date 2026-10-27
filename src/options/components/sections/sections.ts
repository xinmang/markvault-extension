/**
 * 设置页分区与导航定义
 */

export type SectionId =
  | 'connection'
  | 'ai-service'
  | 'tagging'
  | 'description'
  | 'save-options'
  | 'screenshot'
  | 'newtab-folder'
  | 'appearance'
  | 'import'
  | 'data-sync';

export interface SectionNavItem {
  id: SectionId;
  /** i18n 键 */
  labelKey: string;
}

export interface SectionNavGroup {
  id: string;
  labelKey: string;
  items: SectionNavItem[];
}

export const SECTION_GROUPS: SectionNavGroup[] = [
  {
    id: 'start',
    labelKey: 'options_nav_group_start',
    items: [{ id: 'connection', labelKey: 'options_nav_connection' }],
  },
  {
    id: 'ai',
    labelKey: 'options_nav_group_ai',
    items: [
      { id: 'ai-service', labelKey: 'options_nav_ai_service' },
      { id: 'tagging', labelKey: 'options_nav_tagging' },
      { id: 'description', labelKey: 'options_nav_description' },
    ],
  },
  {
    id: 'save',
    labelKey: 'options_nav_group_save',
    items: [
      { id: 'save-options', labelKey: 'options_nav_save_options' },
      { id: 'screenshot', labelKey: 'options_nav_screenshot' },
    ],
  },
  {
    id: 'newtab',
    labelKey: 'options_nav_group_newtab',
    items: [{ id: 'newtab-folder', labelKey: 'options_nav_newtab_folder' }],
  },
  {
    id: 'other',
    labelKey: 'options_nav_group_other',
    items: [
      { id: 'appearance', labelKey: 'options_nav_appearance' },
      { id: 'import', labelKey: 'options_nav_import' },
      { id: 'data-sync', labelKey: 'options_nav_data_sync' },
    ],
  },
];

export const ALL_SECTIONS: SectionNavItem[] = SECTION_GROUPS.flatMap((group) => group.items);

export const DEFAULT_SECTION: SectionId = 'connection';

export function isSectionId(value: string): value is SectionId {
  return ALL_SECTIONS.some((section) => section.id === value);
}

/** 从 location.hash 解析分区（#ai-service），无效时返回默认分区 */
export function parseSectionHash(hash: string): SectionId {
  const raw = hash.replace(/^#/, '').trim();
  return isSectionId(raw) ? raw : DEFAULT_SECTION;
}
