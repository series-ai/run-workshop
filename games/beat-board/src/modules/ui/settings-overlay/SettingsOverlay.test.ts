import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, resetSettingsStore } from './SettingsOverlay';

beforeEach(() => {
  resetSettingsStore();
});

describe('SettingsOverlay', () => {
  it('toggle flips soundEnabled', () => {
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
    useSettingsStore.getState().toggle('soundEnabled');
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
    useSettingsStore.getState().toggle('soundEnabled');
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
  });

  it('toggle flips musicEnabled', () => {
    useSettingsStore.getState().toggle('musicEnabled');
    expect(useSettingsStore.getState().musicEnabled).toBe(false);
  });

  it('setVolume clamps to 0', () => {
    useSettingsStore.getState().setVolume('sound', -0.5);
    expect(useSettingsStore.getState().soundVolume).toBe(0);
  });

  it('setVolume clamps to 1', () => {
    useSettingsStore.getState().setVolume('music', 1.5);
    expect(useSettingsStore.getState().musicVolume).toBe(1);
  });

  it('setVolume sets sound volume', () => {
    useSettingsStore.getState().setVolume('sound', 0.6);
    expect(useSettingsStore.getState().soundVolume).toBe(0.6);
  });

  it('setVolume sets music volume', () => {
    useSettingsStore.getState().setVolume('music', 0.3);
    expect(useSettingsStore.getState().musicVolume).toBe(0.3);
  });

  it('reset restores defaults', () => {
    useSettingsStore.getState().toggle('soundEnabled');
    useSettingsStore.getState().setVolume('sound', 0.1);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
    expect(useSettingsStore.getState().soundVolume).toBe(1.0);
    expect(useSettingsStore.getState().musicVolume).toBe(1.0);
  });
});
