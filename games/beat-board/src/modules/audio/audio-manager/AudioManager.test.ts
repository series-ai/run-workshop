import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioManagerStore, resetAudioManagerStore } from './AudioManager';

beforeEach(() => {
  resetAudioManagerStore();
});

describe('AudioManager', () => {
  it('setVolume clamps to 0 (below range)', () => {
    useAudioManagerStore.getState().setVolume('sfx', -0.5);
    expect(useAudioManagerStore.getState().sfxVolume).toBe(0);
  });

  it('setVolume clamps to 1 (above range)', () => {
    useAudioManagerStore.getState().setVolume('music', 1.5);
    expect(useAudioManagerStore.getState().musicVolume).toBe(1);
  });

  it('setVolume sets sfx volume', () => {
    useAudioManagerStore.getState().setVolume('sfx', 0.6);
    expect(useAudioManagerStore.getState().sfxVolume).toBe(0.6);
  });

  it('setVolume sets music volume', () => {
    useAudioManagerStore.getState().setVolume('music', 0.3);
    expect(useAudioManagerStore.getState().musicVolume).toBe(0.3);
  });

  it('mute makes getEffectiveVolume return 0', () => {
    useAudioManagerStore.getState().mute();
    expect(useAudioManagerStore.getState().getEffectiveVolume('sfx')).toBe(0);
    expect(useAudioManagerStore.getState().getEffectiveVolume('music')).toBe(0);
  });

  it('unmute restores volume', () => {
    useAudioManagerStore.getState().mute();
    useAudioManagerStore.getState().unmute();
    expect(useAudioManagerStore.getState().getEffectiveVolume('sfx')).toBeGreaterThan(0);
  });

  it('toggleMute toggles isMuted', () => {
    expect(useAudioManagerStore.getState().isMuted).toBe(false);
    useAudioManagerStore.getState().toggleMute();
    expect(useAudioManagerStore.getState().isMuted).toBe(true);
    useAudioManagerStore.getState().toggleMute();
    expect(useAudioManagerStore.getState().isMuted).toBe(false);
  });

  it('getEffectiveVolume returns configured value when not muted', () => {
    useAudioManagerStore.getState().setVolume('sfx', 0.7);
    expect(useAudioManagerStore.getState().getEffectiveVolume('sfx')).toBeCloseTo(0.7, 5);
  });

  it('duck reduces volume by factor', () => {
    useAudioManagerStore.getState().setVolume('music', 1.0);
    useAudioManagerStore.getState().duck('music', 0.3);
    expect(useAudioManagerStore.getState().getEffectiveVolume('music')).toBeCloseTo(0.3, 5);
  });

  it('duck is clamped to 0-1', () => {
    useAudioManagerStore.getState().duck('sfx', -0.5);
    expect(useAudioManagerStore.getState().getEffectiveVolume('sfx')).toBe(0);
    useAudioManagerStore.getState().duck('sfx', 1.5);
    const vol = useAudioManagerStore.getState().getEffectiveVolume('sfx');
    expect(vol).toBeCloseTo(useAudioManagerStore.getState().sfxVolume, 5);
  });
});
