import type { VocalCue } from "../game/model";

export interface CreatureCall {
  cue: VocalCue;
  id: number;
}

interface CallProfile {
  duration: number;
  pitch: number;
  pitchFall: number;
  breath: number;
  creak: number;
  resonance: number;
  pulses: readonly {
    start: number;
    end: number;
    power: number;
    gain: number;
  }[];
}

const CALLS: Record<VocalCue, CallProfile> = {
  fear: {
    duration: 2.6,
    pitch: 54,
    pitchFall: 0.075,
    breath: 0.9,
    creak: 0.35,
    resonance: 310,
    pulses: [
      { start: 0.04, end: 1, power: 1.4, gain: 0.75 },
      { start: 1.3, end: 2.5, power: 1.6, gain: 1 },
    ],
  },
  effort: {
    duration: 2.5,
    pitch: 47,
    pitchFall: 0.025,
    breath: 0.7,
    creak: 0.5,
    resonance: 280,
    pulses: [
      { start: 0.05, end: 1.45, power: 0.85, gain: 0.9 },
      { start: 1.7, end: 2.4, power: 1.2, gain: 0.65 },
    ],
  },
  pain: {
    duration: 1.3,
    pitch: 67,
    pitchFall: 0.2,
    breath: 1.25,
    creak: 0.4,
    resonance: 390,
    pulses: [
      { start: 0.01, end: 0.62, power: 0.8, gain: 1 },
      { start: 0.8, end: 1.24, power: 1.8, gain: 0.35 },
    ],
  },
  anger: {
    duration: 2.15,
    pitch: 40,
    pitchFall: 0.035,
    breath: 0.55,
    creak: 0.65,
    resonance: 235,
    pulses: [{ start: 0.025, end: 2.05, power: 0.75, gain: 1 }],
  },
  relief: {
    duration: 2.3,
    pitch: 43,
    pitchFall: 0.08,
    breath: 1.6,
    creak: 0.15,
    resonance: 255,
    pulses: [{ start: 0.12, end: 2.2, power: 1.6, gain: 0.65 }],
  },
};

export function callEnvelope(cue: VocalCue, time: number): number {
  let envelope = 0;
  for (const pulse of CALLS[cue].pulses) {
    if (time <= pulse.start || time >= pulse.end) continue;
    const progress = (time - pulse.start) / (pulse.end - pulse.start);
    envelope +=
      Math.pow(Math.sin(Math.PI * progress), pulse.power) * pulse.gain;
  }
  return envelope;
}

// Calls use breath, uneven pitch, and throat resonance. They contain no words.
export function renderCreatureCall(
  sampleRate: number,
  cue: VocalCue,
  seed: number,
): Float32Array {
  const profile = CALLS[cue];
  const samples = new Float32Array(Math.ceil(sampleRate * profile.duration));
  let random = seed >>> 0;
  let phase = 0;
  let breath = 0;
  let previous = 0;
  let older = 0;
  const resonance = profile.resonance + (seed % 41) - 20;
  const radius = Math.exp((-Math.PI * 160) / sampleRate);
  const coefficient =
    2 * radius * Math.cos((2 * Math.PI * resonance) / sampleRate);
  const pitch = profile.pitch + (seed % 7) - 3;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const noise = random / 2147483648 - 1;
    breath +=
      (1 - Math.exp((-2 * Math.PI * 1450) / sampleRate)) * (noise - breath);
    const envelope = callEnvelope(cue, time);
    const effort =
      1 + 0.045 * Math.sin(time * 23) + 0.018 * Math.sin(time * 113);
    phase +=
      (2 * Math.PI * pitch * (1 - time * profile.pitchFall) * effort) /
      sampleRate;
    const creak =
      1 -
      profile.creak +
      profile.creak * Math.pow((1 + Math.sin(phase * 0.49)) * 0.5, 4);
    const throat = Math.tanh(
      2.2 *
        (Math.sin(phase) +
          0.45 * Math.sin(phase * 2) +
          0.2 * Math.sin(phase * 3)),
    );
    const resonant =
      (1 - radius) * (throat * creak + breath * profile.breath) +
      coefficient * previous -
      radius * radius * older;
    older = previous;
    previous = resonant;
    const exhale =
      breath * profile.breath * (0.28 + (0.3 * time) / profile.duration);
    samples[i] =
      Math.tanh(resonant * 1.7 + Math.sin(phase * 0.5) * 0.2 + exhale) *
      envelope *
      0.16;
  }
  return samples;
}

export class CreatureVoice {
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null =
    null;
  private calls = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {}

  vocalize(cue: VocalCue): void {
    this.stop();
    // Each call varies slightly within its emotion profile.
    const seed = [...cue].reduce(
      (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
      ++this.calls,
    );
    const samples = renderCreatureCall(this.ctx.sampleRate, cue, seed);
    const buffer = this.ctx.createBuffer(
      1,
      samples.length,
      this.ctx.sampleRate,
    );
    buffer.getChannelData(0).set(samples);
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.output);
    this.active = { source, gain };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.active?.source === source) this.active = null;
    };
    source.start(this.ctx.currentTime + 0.02);
  }

  stop(): void {
    if (!this.active) return;
    const { source, gain } = this.active;
    this.active = null;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    source.stop(this.ctx.currentTime);
    source.onended = null;
    source.disconnect();
    gain.disconnect();
  }
}
