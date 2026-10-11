import { useCallback, useEffect, useRef, useState } from 'react';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import { DEFAULT_AUDIO, readAudioSettings, saveAudioSettings, type AudioSettings } from './bank';
import { YardAudio, type AudioListener, type AudioStatus } from './mixer';
import type { YardRender } from '../render/presentation';

export interface YardAudioControl {
  readonly settings: AudioSettings;
  readonly status: AudioStatus;
  change(settings: AudioSettings): void;
  frame(render: YardRender, listener: AudioListener, session: number): void;
}

/** Owns audio permissions, host events, and cleanup. No audio starts at boot. */
export function useYardAudio(playing: boolean, sdkReady: boolean): YardAudioControl {
  const [settings, setSettings] = useState(DEFAULT_AUDIO);
  const [status, setStatus] = useState<AudioStatus>('locked');
  const settingsChanged = useRef(false);
  const engine = useRef<YardAudio | null>(null);
  const syncActive = useRef<() => void>(() => {});
  const current = useRef({ playing, settings });
  current.current = { playing, settings };

  useEffect(() => {
    let alive = true;
    if (sdkReady) void readAudioSettings().then(saved => {
      if (alive && !settingsChanged.current) setSettings(saved);
    });
    return () => { alive = false; };
  }, [sdkReady]);

  useEffect(() => {
    let hostSleeping = false;
    let focused = true;
    const sound = new YardAudio(current.current.settings, setStatus, sdkReady ? node => {
      try { RundotAPI.clips.useGameAudio(node); }
      catch { /* A host without clip capture still plays sound. */ }
    } : undefined);
    engine.current = sound;
    const update = () => sound.setActive(current.current.playing && !document.hidden && focused && !hostSleeping);
    syncActive.current = update;
    const unlock = (event: Event) => {
      if (!event.isTrusted) return;
      sound.unlock();
      update();
    };
    const blur = () => { focused = false; update(); };
    const focus = () => { focused = true; update(); };
    const sleep = () => { hostSleeping = true; update(); };
    const awake = () => { hostSleeping = false; update(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', update);
    const subscriptions = sdkReady ? [
      RundotAPI.lifecycles.onSleep(sleep), RundotAPI.lifecycles.onPause(sleep),
      RundotAPI.lifecycles.onAwake(awake), RundotAPI.lifecycles.onResume(awake),
    ] : [];
    if (import.meta.env.DEV) {
      (window as unknown as { __DEBUG_AUDIO__?: () => ReturnType<YardAudio['inspect']> }).__DEBUG_AUDIO__ = () => sound.inspect();
    }
    update();
    return () => {
      syncActive.current = () => {};
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', update);
      for (const subscription of subscriptions) subscription.unsubscribe();
      sound.dispose();
      if (engine.current === sound) engine.current = null;
      if (import.meta.env.DEV) delete (window as unknown as { __DEBUG_AUDIO__?: unknown }).__DEBUG_AUDIO__;
    };
  }, [sdkReady]);

  useEffect(() => { syncActive.current(); }, [playing]);
  useEffect(() => { engine.current?.applySettings(settings); }, [settings]);
  const change = useCallback((next: AudioSettings) => {
    settingsChanged.current = true;
    if (sdkReady) void saveAudioSettings(next);
    setSettings(next);
  }, [sdkReady]);
  const frame = useCallback((render: YardRender, listener: AudioListener, session: number) => {
    engine.current?.frame(render, listener, session);
  }, []);
  return { settings, status, change, frame };
}
