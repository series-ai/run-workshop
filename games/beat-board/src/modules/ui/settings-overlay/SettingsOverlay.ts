import { create } from 'zustand';
import { SettingsState } from './types';
import { defaultSettings } from './config';

interface SettingsStore extends SettingsState {
  toggle(key: keyof SettingsState): void;
  setVolume(type: 'sound' | 'music', value: number): void;
  reset(): void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,

  toggle(key: keyof SettingsState) {
    set((state) => {
      const current = state[key];
      if (typeof current !== 'boolean') return state;
      return { [key]: !current } as Partial<SettingsStore>;
    });
  },

  setVolume(type: 'sound' | 'music', value: number) {
    const clamped = Math.min(Math.max(value, 0), 1);
    if (type === 'sound') {
      set({ soundVolume: clamped });
    } else {
      set({ musicVolume: clamped });
    }
  },

  reset() {
    set({ ...defaultSettings });
  },
}));

export function resetSettingsStore() {
  useSettingsStore.setState({ ...defaultSettings });
}
