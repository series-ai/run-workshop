// Calls use breath, uneven pitch, and throat resonance. They contain no words.
export function renderCreatureCall(
  sampleRate: number,
  seed: number,
): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * 2.6));
  let random = seed >>> 0;
  let phase = 0;
  let breath = 0;
  let previous = 0;
  let older = 0;
  const resonance = 260 + (seed % 110);
  const radius = Math.exp((-Math.PI * 160) / sampleRate);
  const coefficient =
    2 * radius * Math.cos((2 * Math.PI * resonance) / sampleRate);
  const pitch = 46 + (seed % 13);
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const noise = random / 2147483648 - 1;
    breath +=
      (1 - Math.exp((-2 * Math.PI * 1450) / sampleRate)) * (noise - breath);
    const first = Math.max(0, Math.min(1, (time - 0.04) / 0.96));
    const second = Math.max(0, Math.min(1, (time - 1.3) / 1.2));
    const envelope =
      Math.pow(Math.sin(Math.PI * first), 1.4) * 0.75 +
      Math.pow(Math.sin(Math.PI * second), 1.6);
    const effort =
      1 + 0.045 * Math.sin(time * 23) + 0.018 * Math.sin(time * 113);
    phase += (2 * Math.PI * pitch * (1 - time * 0.075) * effort) / sampleRate;
    const creak = 0.65 + 0.35 * Math.pow((1 + Math.sin(phase * 0.49)) * 0.5, 4);
    const throat = Math.tanh(
      2.2 *
        (Math.sin(phase) +
          0.45 * Math.sin(phase * 2) +
          0.2 * Math.sin(phase * 3)),
    );
    const resonant =
      (1 - radius) * (throat * creak + breath * 0.9) +
      coefficient * previous -
      radius * radius * older;
    older = previous;
    previous = resonant;
    const exhale = breath * (0.28 + (0.3 * time) / 2.6);
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

  speak(cue: string): void {
    this.stop();
    // The cue changes texture, not syllables or spoken content.
    const seed = [...cue].reduce(
      (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
      ++this.calls,
    );
    const samples = renderCreatureCall(this.ctx.sampleRate, seed);
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
