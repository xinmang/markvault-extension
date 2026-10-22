/**
 * 全局状态管理 Store
 */

import { create } from 'zustand';
import { createUIActions, type UIActions } from './actions/ui';
import { createPageActions, type PageActions } from './actions/page';
import { createTagActions, type TagActions } from './actions/tags';
import { createConfigActions, type ConfigActions } from './actions/config';
import { createBookmarkActions, type BookmarkActions } from './actions/bookmark';
import { createRecommendActions, type RecommendActions } from './actions/recommend';

interface AppState extends
  UIActions,
  PageActions,
  TagActions,
  ConfigActions,
  BookmarkActions,
  RecommendActions {}

export const useAppStore = create<AppState>((set, get) => ({
  ...createUIActions(set),
  ...createPageActions(set, get),
  ...createTagActions(set, get),
  ...createConfigActions(set),
  ...createBookmarkActions(set, get),
  ...createRecommendActions(set, get),
}));
