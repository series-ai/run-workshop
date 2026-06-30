import { create } from 'zustand';
import { AudioCategory } from './types';
import { defaultAudioState } from './config';

interface DuckState {
  sfx: number;
  music: number;
  voice: number;
}

interface AudioManagerStore {
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  duckFactors: DuckState;
  setVolume(category: AudioCategory, volume: number): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;
  getEffectiveVolume(category: AudioCategory): number;
  duck(category: AudioCategory, factor: number): void;
}

export const useAudioManagerStore = create<AudioManagerStore>((set, get) => ({
  sfxVolume: defaultAudioState.sfxVolume,
  musicVolume: defaultAudioState.musicVolume,
  isMuted: defaultAudioState.isMuted,
  duckFactors: { sfx: 1, music: 1, voice: 1 },

  setVolume(category: AudioCategory, volume: number) {
    const clamped = Math.min(Math.max(volume, 0), 1);
    if (category === 'sfx') {
      set({ sfxVolume: clamped });
    } else if (category === 'music') {
      set({ musicVolume: clamped });
    }
    // voice is not persisted as a separate volume in this store
  },

  mute() {
    set({ isMuted: true });
  },

  unmute() {
    set({ isMuted: false });
  },

  toggleMute() {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  getEffectiveVolume(category: AudioCategory): number {
    const { isMuted, sfxVolume, musicVolume, duckFactors } = get();
    if (isMuted) return 0;

    let baseVolume: number;
    if (category === 'sfx') {
      baseVolume = sfxVolume;
    } else if (category === 'music') {
      baseVolume = musicVolume;
    } else {
      baseVolume = 1;
    }

    const duck = duckFactors[category] ?? 1;
    return baseVolume * duck;
  },

  duck(category: AudioCategory, factor: number) {
    const clamped = Math.min(Math.max(factor, 0), 1);
    set((state) => ({
      duckFactors: { ...state.duckFactors, [category]: clamped },
    }));
  },
}));

export function resetAudioManagerStore() {
  useAudioManagerStore.setState({
    sfxVolume: defaultAudioState.sfxVolume,
    musicVolume: defaultAudioState.musicVolume,
    isMuted: defaultAudioState.isMuted,
    duckFactors: { sfx: 1, music: 1, voice: 1 },
  });
}
