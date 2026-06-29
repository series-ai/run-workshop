import { create } from 'zustand';
import { BadgeStore } from './types';
import { badgeConfig } from './config';

export const useBadgeStore = create<BadgeStore>((set, get) => ({
  badges: {},

  set(key: string, count: number) {
    set((state) => ({
      badges: {
        ...state.badges,
        [key]: { key, count, isNew: count > 0 },
      },
    }));
  },

  increment(key: string) {
    set((state) => {
      const existing = state.badges[key];
      const currentCount = existing?.count ?? 0;
      const newCount = Math.min(currentCount + 1, badgeConfig.maxCount);
      return {
        badges: {
          ...state.badges,
          [key]: { key, count: newCount, isNew: true },
        },
      };
    });
  },

  clear(key: string) {
    set((state) => ({
      badges: {
        ...state.badges,
        [key]: { key, count: 0, isNew: false },
      },
    }));
  },

  markSeen(key: string) {
    set((state) => {
      const existing = state.badges[key];
      if (!existing) return state;
      return {
        badges: {
          ...state.badges,
          [key]: { ...existing, isNew: false },
        },
      };
    });
  },

  total(): number {
    return Object.values(get().badges).reduce((sum, b) => sum + b.count, 0);
  },
}));

export function resetBadgeStore() {
  useBadgeStore.setState({ badges: {} });
}
