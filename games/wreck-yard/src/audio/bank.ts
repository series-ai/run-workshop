import RundotAPI from '@series-inc/rundot-game-sdk/api';

export const AUDIO_BANK = {
  ambient: { file: 'city-hum', loop: true, gain: 0.6 },
  distantDrill: { file: 'distant-drill', loop: false, gain: 0.3 },
  distantSteam: { file: 'distant-steam', loop: false, gain: 0.22 },
  torch: { file: 'torch', loop: true, gain: 0.38 },
  gravity: { file: 'gravity-loop', loop: true, gain: 0.32 },
  jet: { file: 'jet-loop', loop: true, gain: 0.45 },
  buggy: { file: 'buggy-loop', loop: true, gain: 0.38 },
  metal: { file: 'metal-impact', loop: false, gain: 0.65 },
  wood: { file: 'wood-impact', loop: false, gain: 0.65 },
  concrete: { file: 'concrete-impact', loop: false, gain: 0.6 },
  rubber: { file: 'rubber-impact', loop: false, gain: 0.55 },
  glass: { file: 'glass-impact', loop: false, gain: 0.4 },
  /** A floodlight is 11 m up, so its sounds carry farther than an impact. */
  glassBreak: { file: 'glass-break', loop: false, gain: 0.65, falloff: 18 },
  lampFizz: { file: 'lamp-fizz', loop: false, gain: 0.25, falloff: 18 },
  crateBreak: { file: 'crate-break', loop: false, gain: 0.9 },
  /** Lights out and relamp play at the listener: the whole yard hears them. */
  lightsOut: { file: 'lights-out', loop: false, gain: 0.65 },
  relamp: { file: 'relamp', loop: false, gain: 0.75 },
  pulse: { file: 'gravity-pulse', loop: false, gain: 0.6 },
  explosion: { file: 'explosion', loop: false, gain: 0.8 },
  splash: { file: 'water-splash', loop: false, gain: 0.55 },
  mechanism: { file: 'mechanism', loop: false, gain: 0.5 },
  step: { file: 'robot-step', loop: false, gain: 0.16 },
  switch: { file: 'tool-switch', loop: false, gain: 0.4 },
  quench: { file: 'quench', loop: false, gain: 0.42 },
} as const;

export type SoundId = keyof typeof AUDIO_BANK;
export interface AudioSettings { readonly muted: boolean; readonly ambience: number; readonly effects: number }
export const DEFAULT_AUDIO: AudioSettings = { muted: false, ambience: 0.12, effects: 0.7 };
const STORAGE_KEY = 'wreck-yard-audio-v1';

export function parseAudioSettings(raw: unknown): AudioSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_AUDIO;
  const value = raw as Record<string, unknown>;
  const level = (item: unknown, fallback: number) => typeof item === 'number' && Number.isFinite(item) ? Math.max(0, Math.min(1, item)) : fallback;
  // Keep the saved level when the Music control becomes Ambience.
  return { muted: value.muted === true, ambience: level(value.ambience ?? value.music, DEFAULT_AUDIO.ambience), effects: level(value.effects, DEFAULT_AUDIO.effects) };
}

/** Distance (m) at which a sound falls to half its level. */
export function soundFalloff(sound: SoundId): number {
  const entry = AUDIO_BANK[sound];
  if ('falloff' in entry) return entry.falloff;
  return isAmbienceSound(sound) ? 30 : 6;
}

export function isAmbienceSound(sound: SoundId): boolean {
  return sound === 'ambient' || sound === 'distantDrill' || sound === 'distantSteam';
}

export async function readAudioSettings(): Promise<AudioSettings> {
  try {
    return parseAudioSettings(JSON.parse(await RundotAPI.deviceCache.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_AUDIO;
  }
}

export async function saveAudioSettings(settings: AudioSettings): Promise<void> {
  try { await RundotAPI.deviceCache.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  catch { /* A host without device cache keeps the settings for this session. */ }
}
