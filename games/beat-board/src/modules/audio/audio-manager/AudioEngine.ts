/** Audio playback engine using Web Audio API */

export interface AudioEngineConfig {
  /** Master volume 0-1 */
  masterVolume?: number
  /** Music volume 0-1 */
  musicVolume?: number
  /** SFX volume 0-1 */
  sfxVolume?: number
  /** Crossfade duration in seconds */
  crossfadeDuration?: number
}

export interface SfxOptions {
  /** Volume 0-1. Default: 1 */
  volume?: number
  /** Playback rate (pitch). 1 = normal, 2 = double speed/octave up, 0.5 = half speed. Default: 1 */
  pitch?: number
}

export interface RandomSfxOptions {
  /** Volume range [min, max]. Default: [1, 1] */
  volume?: [number, number]
  /** Pitch range [min, max]. Default: [1, 1] */
  pitch?: [number, number]
}

export interface AudioEngine {
  /** Load an audio buffer from a URL or Blob. Caches by key. */
  loadAudio(key: string, source: Blob | ArrayBuffer): Promise<void>
  /** Play a one-shot sound effect. Accepts a volume number (backward compat) or SfxOptions object. */
  playSfx(key: string, opts?: number | SfxOptions): void
  /** Play a random SFX from the given keys with optional volume/pitch randomization. */
  playSfxRandom(keys: string[], opts?: RandomSfxOptions): void
  /** Play music track (stops current, crossfades if configured) */
  playMusic(key: string, loop?: boolean): void
  /** Stop current music (with optional fade-out) */
  stopMusic(fadeOutSeconds?: number): void
  /** Set master volume */
  setMasterVolume(volume: number): void
  /** Set music volume */
  setMusicVolume(volume: number): void
  /** Set SFX volume */
  setSfxVolume(volume: number): void
  /** Mute/unmute all audio */
  setMuted(muted: boolean): void
  /** Check if muted */
  isMuted(): boolean
  /** Check if a key is loaded */
  isLoaded(key: string): boolean
  /** Release all resources */
  dispose(): void
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

export function createAudioEngine(config?: AudioEngineConfig): AudioEngine {
  const crossfadeDuration = config?.crossfadeDuration ?? 2.0;

  let masterVolume = clamp01(config?.masterVolume ?? 1);
  let musicVolume = clamp01(config?.musicVolume ?? 0.5);
  let sfxVolume = clamp01(config?.sfxVolume ?? 0.8);
  let muted = false;

  let audioContext: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;

  let currentMusicSource: AudioBufferSourceNode | null = null;
  let currentMusicKey: string | null = null;

  const bufferCache = new Map<string, AudioBuffer>();

  function ensureContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext();

      masterGain = audioContext.createGain();
      musicGain = audioContext.createGain();
      sfxGain = audioContext.createGain();

      masterGain.connect(audioContext.destination);
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);

      masterGain.gain.value = muted ? 0 : masterVolume;
      musicGain.gain.value = musicVolume;
      sfxGain.gain.value = sfxVolume;
    }
    return audioContext;
  }

  return {
    async loadAudio(key: string, source: Blob | ArrayBuffer): Promise<void> {
      const ctx = ensureContext();
      let arrayBuffer: ArrayBuffer;
      if (source instanceof Blob) {
        arrayBuffer = await source.arrayBuffer();
      } else {
        arrayBuffer = source;
      }
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      bufferCache.set(key, buffer);
    },

    playSfx(key: string, opts?: number | SfxOptions): void {
      const ctx = ensureContext();
      const buffer = bufferCache.get(key);
      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Parse opts — backward compatible
      let volume: number | undefined;
      let pitch = 1;
      if (typeof opts === 'number') {
        volume = opts;
      } else if (opts) {
        volume = opts.volume;
        pitch = opts.pitch ?? 1;
      }

      // Apply pitch
      source.playbackRate.value = pitch;

      if (volume !== undefined) {
        const oneOffGain = ctx.createGain();
        oneOffGain.gain.value = clamp01(volume);
        oneOffGain.connect(sfxGain!);
        source.connect(oneOffGain);
      } else {
        source.connect(sfxGain!);
      }

      source.start(0);
    },

    playSfxRandom(keys: string[], opts?: RandomSfxOptions): void {
      if (keys.length === 0) return;

      // Pick random key from available (loaded) keys
      const loadedKeys = keys.filter(k => bufferCache.has(k));
      if (loadedKeys.length === 0) return;

      const key = loadedKeys[Math.floor(Math.random() * loadedKeys.length)];
      if (key === undefined) return;

      // Randomize within ranges
      const volumeRange = opts?.volume ?? [1, 1];
      const pitchRange = opts?.pitch ?? [1, 1];

      const volume = volumeRange[0] + Math.random() * (volumeRange[1] - volumeRange[0]);
      const pitch = pitchRange[0] + Math.random() * (pitchRange[1] - pitchRange[0]);

      this.playSfx(key, { volume, pitch });
    },

    playMusic(key: string, loop?: boolean): void {
      const ctx = ensureContext();
      const buffer = bufferCache.get(key);
      if (!buffer) return;

      // Crossfade out current music if playing
      if (currentMusicSource && musicGain) {
        const now = ctx.currentTime;
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(0, now + crossfadeDuration);

        const oldSource = currentMusicSource;
        const fadeMs = crossfadeDuration * 1000;
        setTimeout(() => {
          try { oldSource.stop(); } catch { /* already stopped */ }
        }, fadeMs);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop ?? true;
      source.connect(musicGain!);

      // If we were crossfading, ramp gain back up
      if (currentMusicKey !== null && musicGain) {
        const now = ctx.currentTime;
        musicGain.gain.setValueAtTime(0, now + crossfadeDuration);
        musicGain.gain.linearRampToValueAtTime(musicVolume, now + crossfadeDuration * 2);
        const startDelay = crossfadeDuration;
        source.start(ctx.currentTime + startDelay);
      } else {
        if (musicGain) {
          musicGain.gain.value = musicVolume;
        }
        source.start(0);
      }

      currentMusicSource = source;
      currentMusicKey = key;
    },

    stopMusic(fadeOutSeconds?: number): void {
      if (!currentMusicSource || !musicGain || !audioContext) return;

      if (fadeOutSeconds && fadeOutSeconds > 0) {
        const now = audioContext.currentTime;
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(0, now + fadeOutSeconds);

        const sourceToStop = currentMusicSource;
        setTimeout(() => {
          try { sourceToStop.stop(); } catch { /* already stopped */ }
        }, fadeOutSeconds * 1000);
      } else {
        try { currentMusicSource.stop(); } catch { /* already stopped */ }
      }

      currentMusicSource = null;
      currentMusicKey = null;
    },

    setMasterVolume(volume: number): void {
      masterVolume = clamp01(volume);
      if (masterGain) {
        masterGain.gain.value = muted ? 0 : masterVolume;
      }
    },

    setMusicVolume(volume: number): void {
      musicVolume = clamp01(volume);
      if (musicGain) {
        musicGain.gain.value = musicVolume;
      }
    },

    setSfxVolume(volume: number): void {
      sfxVolume = clamp01(volume);
      if (sfxGain) {
        sfxGain.gain.value = sfxVolume;
      }
    },

    setMuted(m: boolean): void {
      muted = m;
      if (masterGain) {
        masterGain.gain.value = muted ? 0 : masterVolume;
      }
    },

    isMuted(): boolean {
      return muted;
    },

    isLoaded(key: string): boolean {
      return bufferCache.has(key);
    },

    dispose(): void {
      if (currentMusicSource) {
        try { currentMusicSource.stop(); } catch { /* already stopped */ }
        currentMusicSource = null;
        currentMusicKey = null;
      }

      bufferCache.clear();

      if (audioContext) {
        audioContext.close();
        audioContext = null;
        masterGain = null;
        musicGain = null;
        sfxGain = null;
      }
    },
  };
}
