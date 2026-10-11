import { AUDIO_BANK, isAmbienceSound, type AudioSettings, type SoundId } from './bank';
import { YardCueTracker, type LoopCue, type ShotCue } from './cues';
import type { YardRender } from '../render/presentation';
import type { Vec3 } from '../sim/math';

export type AudioStatus = 'locked' | 'loading' | 'ready' | 'error';
export interface AudioListener { readonly position: Vec3; readonly right: Vec3 }
interface Voice {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  readonly pan: StereoPannerNode;
  readonly sound: SoundId;
  readonly loop: boolean;
}
const MAX_VOICES = 24;
// Distant machinery has long, unequal gaps. These sounds do not mark game events.
const AMBIENT_TEXTURES: readonly { sound: 'distantDrill' | 'distantSteam'; at: Vec3; gap: number; rate: number }[] = [
  { sound: 'distantSteam', at: [-29, 4, -16], gap: 23, rate: 0.96 },
  { sound: 'distantDrill', at: [30, 3, 8], gap: 37, rate: 1 },
  { sound: 'distantSteam', at: [14, 4, -31], gap: 31, rate: 1.03 },
  { sound: 'distantDrill', at: [-31, 3, 14], gap: 43, rate: 0.94 },
];

/** One audio graph per app. Audio never changes the simulation. */
export class YardAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private meter: AnalyserNode | null = null;
  private readonly meterSamples = new Float32Array(1024);
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly voices = new Set<Voice>();
  private readonly loops = new Map<string, Voice>();
  private readonly tracker = new YardCueTracker();
  private readonly abort = new AbortController();
  private readonly played: { id: string; sound: SoundId }[] = [];
  private loading: Promise<void> | null = null;
  private disposed = false;
  private needsSeed = true;
  private active = false;
  private suspendTimer: number | null = null;
  private nextAmbientAt: number | null = null;
  private ambientIndex = 0;
  private status: AudioStatus = 'locked';
  private listener: AudioListener = { position: [0, 0, 0], right: [1, 0, 0] };

  constructor(private settings: AudioSettings, private readonly onStatus: (status: AudioStatus) => void, private readonly registerOutput?: (node: AudioNode) => void) {}

  /** Call from a trusted input event. Resume before any fetch or decode. */
  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const ctx = new AudioContext({ latencyHint: 'interactive' });
        this.context = ctx;
        this.master = ctx.createGain();
        this.ambience = ctx.createGain();
        this.effects = ctx.createGain();
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.15;
        this.ambience.connect(this.master);
        this.effects.connect(this.master);
        this.master.connect(this.limiter);
        if (import.meta.env.DEV) {
          this.meter = ctx.createAnalyser();
          this.meter.fftSize = 1024;
          this.limiter.connect(this.meter);
          this.meter.connect(ctx.destination);
        } else this.limiter.connect(ctx.destination);
        this.applySettings(this.settings);
        this.registerOutput?.(this.limiter);
      }
      this.cancelSuspend();
      void this.context.resume().then(() => {
        if (this.buffers.size === Object.keys(AUDIO_BANK).length) this.setStatus('ready');
      }).catch(() => this.setStatus('error'));
      if (!this.loading) this.loading = this.load();
      if (!this.active) this.scheduleSuspend();
    } catch {
      this.setStatus('error');
    }
  }

  private setStatus(status: AudioStatus): void {
    if (this.disposed) return;
    this.status = status;
    this.onStatus(status);
  }

  private async load(): Promise<void> {
    this.setStatus('loading');
    try {
      const ctx = this.context!;
      const entries = await Promise.all(Object.entries(AUDIO_BANK).map(async ([name, data]) => {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/${data.file}.mp3`, { signal: this.abort.signal });
        if (!response.ok) throw new Error(`Audio asset ${response.status}`);
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        return [name as SoundId, buffer] as const;
      }));
      if (this.disposed) return;
      for (const [name, buffer] of entries) this.buffers.set(name, buffer);
      this.needsSeed = true;
      this.setStatus('ready');
      if (!this.active) void ctx.suspend().catch(() => {});
    } catch {
      if (!this.disposed) { this.loading = null; this.setStatus('error'); }
    }
  }

  applySettings(settings: AudioSettings): void {
    const wasMuted = this.settings.muted;
    this.settings = settings;
    const now = this.context?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(settings.muted ? 0 : 0.8, now, 0.025);
    this.ambience?.gain.setTargetAtTime(settings.ambience, now, 0.12);
    this.effects?.gain.setTargetAtTime(settings.effects, now, 0.025);
    if (settings.muted) this.stopAll();
    if (settings.ambience === 0) {
      this.nextAmbientAt = null;
      for (const voice of this.voices) if (isAmbienceSound(voice.sound)) this.stopVoice(voice);
      this.loops.delete('ambient');
    }
    if (wasMuted !== settings.muted) this.needsSeed = true;
  }

  setActive(active: boolean): void {
    if (this.active === active || this.disposed) return;
    this.active = active;
    this.needsSeed = true;
    this.cancelSuspend();
    if (!active) {
      this.stopAll();
      this.scheduleSuspend();
    } else if (this.context && this.status === 'ready') {
      void this.context.resume().then(() => {
        if (this.buffers.size === Object.keys(AUDIO_BANK).length) this.setStatus('ready');
      }).catch(() => this.setStatus('error'));
    }
  }

  frame(render: YardRender, listener: AudioListener, session: number): void {
    this.listener = listener;
    if (!this.active || this.settings.muted || this.status !== 'ready' || this.context?.state !== 'running') {
      this.needsSeed = true;
      return;
    }
    if (this.needsSeed) {
      this.tracker.seed(render, session);
      this.needsSeed = false;
      this.nextAmbientAt = null;
      return;
    }
    const cues = this.tracker.update(render, session);
    const wanted = new Set(cues.loops.map(cue => cue.id));
    if (this.settings.ambience > 0) wanted.add('ambient');
    for (const [id, voice] of this.loops) if (!wanted.has(id) || (id !== 'ambient' && this.settings.effects === 0)) {
      this.loops.delete(id);
      this.stopVoice(voice);
    }
    if (this.settings.ambience > 0 && !this.loops.has('ambient')) {
      const voice = this.start('ambient', true);
      if (voice) { this.loops.set('ambient', voice); voice.gain.gain.setTargetAtTime(AUDIO_BANK.ambient.gain, this.context.currentTime, 0.8); }
    }
    this.ambientTexture();
    if (this.settings.effects === 0) return;
    for (const cue of cues.loops) this.loop(cue);
    for (const cue of cues.shots) this.shot(cue);
  }

  private ambientTexture(): void {
    if (this.settings.ambience === 0) return;
    const now = this.context!.currentTime;
    const texture = AMBIENT_TEXTURES[this.ambientIndex % AMBIENT_TEXTURES.length]!;
    if (this.nextAmbientAt === null) this.nextAmbientAt = now + texture.gap;
    if (now < this.nextAmbientAt) return;
    this.shot({ id: `ambience:${this.ambientIndex}`, sound: texture.sound, at: texture.at, gain: 1, rate: texture.rate });
    this.ambientIndex += 1;
    this.nextAmbientAt = now + AMBIENT_TEXTURES[this.ambientIndex % AMBIENT_TEXTURES.length]!.gap;
  }

  private start(sound: SoundId, loop: boolean): Voice | null {
    const ctx = this.context;
    const buffer = this.buffers.get(sound);
    if (!ctx || !buffer || this.voices.size >= MAX_VOICES) return null;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(pan);
    pan.connect(isAmbienceSound(sound) ? this.ambience! : this.effects!);
    const voice: Voice = { source, gain, pan, sound, loop };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect(); gain.disconnect(); pan.disconnect();
    };
    source.start();
    return voice;
  }

  private place(voice: Voice, cue: ShotCue | LoopCue, fade: number): void {
    const delta: Vec3 = [cue.at[0] - this.listener.position[0], cue.at[1] - this.listener.position[1], cue.at[2] - this.listener.position[2]];
    const distance = Math.hypot(...delta);
    const falloff = isAmbienceSound(cue.sound) ? 30 : 6;
    const attenuation = 1 / (1 + (distance / falloff) ** 2);
    const pan = distance < 1 ? 0 : Math.max(-0.85, Math.min(0.85, delta.reduce((sum, v, i) => sum + v * this.listener.right[i]!, 0) / distance));
    const now = this.context!.currentTime;
    voice.gain.gain.setTargetAtTime(cue.gain * AUDIO_BANK[cue.sound].gain * attenuation, now, fade);
    voice.pan.pan.setTargetAtTime(pan, now, 0.035);
    voice.source.playbackRate.setTargetAtTime(cue.rate, now, 0.08);
  }

  private loop(cue: LoopCue): void {
    let voice = this.loops.get(cue.id);
    if (!voice) {
      voice = this.start(cue.sound, true) ?? undefined;
      if (!voice) return;
      this.loops.set(cue.id, voice);
    }
    this.place(voice, cue, 0.045);
  }

  private shot(cue: ShotCue): void {
    // Reserve room for loops. Stop the oldest shot at the shot limit.
    if (this.voices.size >= MAX_VOICES - 9) {
      const oldest = [...this.voices].find(voice => !voice.loop);
      if (oldest) this.stopVoice(oldest, true);
    }
    const voice = this.start(cue.sound, false);
    if (!voice) return;
    this.place(voice, cue, 0.003);
    if (import.meta.env.DEV) {
      this.played.push({ id: cue.id, sound: cue.sound });
      if (this.played.length > 100) this.played.shift();
    }
    if (cue.sound === 'explosion') {
      const now = this.context!.currentTime;
      this.ambience!.gain.cancelScheduledValues(now);
      this.ambience!.gain.setTargetAtTime(this.settings.ambience * 0.4, now, 0.02);
      this.ambience!.gain.setTargetAtTime(this.settings.ambience, now + 0.3, 0.3);
    }
  }

  private stopVoice(voice: Voice, immediate = false): void {
    const now = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.01);
    try { voice.source.stop(immediate ? now : now + 0.05); } catch { /* The source can finish before the stop request. */ }
    if (immediate) this.voices.delete(voice);
  }

  private stopAll(): void {
    this.nextAmbientAt = null;
    this.loops.clear();
    for (const voice of this.voices) this.stopVoice(voice);
  }

  private scheduleSuspend(): void {
    this.cancelSuspend();
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null;
      if (!this.active && !this.disposed) void this.context?.suspend().catch(() => {});
    }, 80);
  }

  private cancelSuspend(): void {
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }

  inspect() {
    this.meter?.getFloatTimeDomainData(this.meterSamples);
    const outputRms = Math.sqrt(this.meterSamples.reduce((sum, value) => sum + value * value, 0) / this.meterSamples.length);
    return { outputRms, status: this.status, contextState: this.context?.state ?? 'uncreated', active: this.active, voices: this.voices.size, loops: [...this.loops.keys()], played: [...this.played], settings: this.settings };
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    this.cancelSuspend();
    this.stopAll();
    this.master?.disconnect(); this.ambience?.disconnect(); this.effects?.disconnect(); this.limiter?.disconnect(); this.meter?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
