// Subtitles control the rhythm. No intelligible words enter the audio system.
export class CreatureVoice {
  private active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {}

  speak(text: string): void {
    this.stop();
    const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 16);
    let time = this.ctx.currentTime + 0.02;
    for (const [index, word] of words.entries()) {
      const seed = [...word].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        index * 31,
      );
      const duration = 0.2 + (seed % 4) * 0.055;
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const throat = this.ctx.createBiquadFilter();
      const mouth = this.ctx.createBiquadFilter();
      oscillator.type = "sawtooth";
      const pitch = 49 + (seed % 19);
      oscillator.frequency.setValueAtTime(pitch, time);
      oscillator.frequency.linearRampToValueAtTime(
        pitch * 0.82,
        time + duration,
      );
      throat.type = "bandpass";
      throat.frequency.setValueAtTime(280 + (seed % 240), time);
      throat.frequency.linearRampToValueAtTime(
        220 + (seed % 130),
        time + duration,
      );
      throat.Q.value = 3;
      mouth.type = "bandpass";
      mouth.frequency.setValueAtTime(750 + (seed % 430), time);
      mouth.Q.value = 5;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.035);
      gain.gain.linearRampToValueAtTime(0.055, time + duration * 0.6);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      oscillator.connect(throat);
      oscillator.connect(mouth);
      throat.connect(gain);
      mouth.connect(gain);
      gain.connect(this.output);
      const syllable = { oscillator, gain };
      this.active.add(syllable);
      oscillator.onended = () => {
        this.active.delete(syllable);
        oscillator.disconnect();
        throat.disconnect();
        mouth.disconnect();
        gain.disconnect();
      };
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
      time += duration + (/[?.!…]/.test(word) ? 0.28 : 0.09);
    }
  }

  stop(): void {
    for (const { oscillator, gain } of this.active) {
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      oscillator.stop(this.ctx.currentTime);
    }
    this.active.clear();
  }
}
