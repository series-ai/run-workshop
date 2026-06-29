import { create } from 'zustand';
import { Tab, TabStore } from './types';

export function createTabStore(tabs: Tab[], defaultTabId?: string) {
  const initialActiveId = defaultTabId ?? tabs[0]?.id ?? '';

  return create<TabStore>((set, get) => ({
    tabs: [...tabs],
    activeTabId: initialActiveId,

    setActive(id: string) {
      const exists = get().tabs.some((t) => t.id === id);
      if (!exists) return;
      set({ activeTabId: id });
    },

    setBadge(tabId: string, count: number) {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, badge: count } : t)),
      }));
    },

    clearBadge(tabId: string) {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, badge: undefined } : t)),
      }));
    },
  }));
}
