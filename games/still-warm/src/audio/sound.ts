import type { GameState } from "../game/model";
import { CreatureVoice } from "./creatureVoice";

interface WindowWithAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export interface SurgerySoundOptions {
  audioContextFactory?: () => AudioContext | null;
}

export interface BreathingProfile {
  breathsPerMinute: number;
  durationSeconds: number;
  volume: number;
  pitch: number;
}

export function getBreathingProfile(
  patient: Pick<GameState["patient"], "health" | "pain" | "blood">,
): BreathingProfile {
  const health = Math.max(0, Math.min(100, patient.health));
  const pain = Math.max(0, Math.min(100, patient.pain));
  const blood = Math.max(0, Math.min(100, patient.blood));
  const strain = (100 - health) * 0.45 + pain * 0.35 + (100 - blood) * 0.2;

  return {
    breathsPerMinute: 10 + strain * 0.22,
    durationSeconds: 1.55 - strain * 0.006,
    volume: 0.012 + strain * 0.00022,
    pitch: 105 + pain * 0.35 + (100 - blood) * 0.15,
  };
}

export const DEFAULT_MUTED = true;

export class SurgerySound {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private vitalGain: GainNode | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private creatureVoice: CreatureVoice | null = null;

  private muted = DEFAULT_MUTED;
  private disposed = false;
  private continuousActive = false;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private breathingTimer: ReturnType<typeof setTimeout> | null = null;
  private latestBpm = 60;
  private breathingProfile: BreathingProfile = {
    breathsPerMinute: 12,
    durationSeconds: 1.4,
    volume: 0.015,
    pitch: 115,
  };

  // Discrete state trackers for changes
  private lastDoorState: "quiet" | "knocking" | "barricaded" = "quiet";
  private lastEventCount = 0;
  private lastPendingId: number | null = null;
  private lastHolding: string | null = null;
  private lastContactCount = 0;
  private lastPain = 24;

  constructor(private readonly options?: SurgerySoundOptions) {}

  async unlock(): Promise<void> {
    if (this.disposed) return;

    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch {
          // Safe ignore
        }
      }
      this.startContinuous();
      return;
    }

    try {
      let context: AudioContext | null = null;
      if (this.options?.audioContextFactory) {
        context = this.options.audioContextFactory();
      } else if (typeof window !== "undefined") {
        const win = window as unknown as WindowWithAudio;
        const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
        if (AudioCtor) {
          context = new AudioCtor();
        }
      }

      if (!context) return;
      this.ctx = context;

      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }

      this.setupAudioGraph(context);
      this.startContinuous();
    } catch {
      // AudioContext failure is non-fatal
    }
  }

  private setupAudioGraph(ctx: AudioContext): void {
    if (this.disposed) return;

    try {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
      this.creatureVoice = new CreatureVoice(ctx, this.masterGain);

      this.vitalGain = ctx.createGain();
      this.vitalGain.gain.setValueAtTime(0, ctx.currentTime);
      this.vitalGain.connect(this.masterGain);

      // Ambient hum graph
      this.humGain = ctx.createGain();
      this.humGain.gain.setValueAtTime(0, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(220, ctx.currentTime);

      this.humGain.connect(filter);
      filter.connect(this.masterGain);

      this.humOsc1 = ctx.createOscillator();
      this.humOsc1.type = "sine";
      this.humOsc1.frequency.setValueAtTime(55, ctx.currentTime);
      this.humOsc1.connect(this.humGain);
      this.humOsc1.start();

      this.humOsc2 = ctx.createOscillator();
      this.humOsc2.type = "triangle";
      this.humOsc2.frequency.setValueAtTime(110, ctx.currentTime);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.25, ctx.currentTime);
      this.humOsc2.connect(osc2Gain);
      osc2Gain.connect(this.humGain);
      this.humOsc2.start();
    } catch {
      // Non-fatal if WebAudio initialization fails
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(
          muted ? 0 : 1,
          this.ctx.currentTime,
        );
      } catch {
        // Safe ignore
      }
    }
    if (muted) {
      this.silenceContinuous();
      this.stopSpeech();
    } else if (this.continuousActive) {
      this.startContinuous();
    }
  }

  call(): void {
    this.speak("… … …");
  }

  speak(text: string): void {
    if (this.muted || this.disposed || !text.trim()) return;
    this.creatureVoice?.speak(text);
  }

  stopSpeech(): void {
    this.creatureVoice?.stop();
  }

  update(state: GameState): void {
    if (this.disposed) return;

    const isInactive =
      state.paused ||
      state.phase === "ready" ||
      state.phase === "won" ||
      state.phase === "lost";

    if (isInactive) {
      this.continuousActive = false;
      this.silenceContinuous();

      if (state.paused || state.phase === "won" || state.phase === "lost") {
        this.stopSpeech();
      }

      // Sync discrete baseline so no backlog triggers on resume
      this.lastDoorState = state.environment.door;
      this.lastEventCount = state.environment.eventCount;
      this.lastPendingId = state.pending?.id ?? null;
      this.lastHolding = state.holding;
      this.lastContactCount = state.contactCount;
      this.lastPain = state.patient.pain;
      return;
    }

    this.continuousActive = true;

    // Active playing or blackout state:
    // 1. Maintain subtle background hum.
    if (this.humGain && this.ctx) {
      try {
        this.humGain.gain.setTargetAtTime(
          this.muted ? 0 : 0.035,
          this.ctx.currentTime,
          0.2,
        );
      } catch {
        // Safe ignore
      }
    }
    // 2. Drive heartbeat
    const pain = Math.max(0, Math.min(100, state.patient.pain));
    const health = Math.max(0, Math.min(100, state.patient.health));
    this.latestBpm = Math.max(
      45,
      Math.min(130, 50 + pain * 0.5 + (100 - health) * 0.3),
    );
    this.breathingProfile = getBreathingProfile(state.patient);

    if (!this.muted) {
      this.startContinuous();
    }

    // 3. Discrete door knocking event (no loud jump scares)
    const isKnocking = state.environment.door === "knocking";
    if (
      isKnocking &&
      (this.lastDoorState !== "knocking" ||
        state.environment.eventCount > this.lastEventCount)
    ) {
      this.playDoorKnock();
    }

    // 4. Action and tool changes: tiny tool clink
    const currentPendingId = state.pending?.id ?? null;
    const pendingStarted =
      currentPendingId !== null && currentPendingId !== this.lastPendingId;
    const holdingChanged =
      state.holding !== null && state.holding !== this.lastHolding;
    const contactChanged = state.contactCount > this.lastContactCount;

    if (pendingStarted || holdingChanged || contactChanged) {
      this.playToolClink();
    }

    // 5. Sudden pain spike
    if (state.patient.pain > this.lastPain + 4) {
      this.playPainReaction();
    }

    // Update trackers
    this.lastDoorState = state.environment.door;
    this.lastEventCount = state.environment.eventCount;
    this.lastPendingId = currentPendingId;
    this.lastHolding = state.holding;
    this.lastContactCount = state.contactCount;
    this.lastPain = state.patient.pain;
  }

  private silenceContinuous(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer);
      this.breathingTimer = null;
    }
    if (this.humGain && this.ctx) {
      try {
        this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      } catch {
        // Safe ignore
      }
    }
    if (this.vitalGain && this.ctx) {
      try {
        this.vitalGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      } catch {
        // Safe ignore
      }
    }
  }

  private startContinuous(): void {
    if (
      this.disposed ||
      this.muted ||
      !this.continuousActive ||
      !this.ctx ||
      this.ctx.state !== "running"
    )
      return;

    if (this.humGain) {
      try {
        this.humGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
      } catch {
        // Safe ignore
      }
    }
    if (this.vitalGain) {
      try {
        this.vitalGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.04);
      } catch {
        // Safe ignore
      }
    }
    if (!this.heartbeatTimer) {
      this.scheduleHeartbeat(100);
    }
    if (!this.breathingTimer) {
      this.scheduleBreath(160);
    }
  }

  private scheduleHeartbeat(delayMs: number): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.disposed) return;

    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      if (this.disposed) return;
      this.playHeartbeat();
      const intervalMs = (60 / this.latestBpm) * 1000;
      this.scheduleHeartbeat(intervalMs);
    }, delayMs);
  }

  private playHeartbeat(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      !this.vitalGain ||
      this.muted ||
      this.ctx.state !== "running"
    )
      return;
    try {
      const t = this.ctx.currentTime;
      // Pulse 1: "lub"
      this.scheduleHeartbeatPulse(t, 65, 35, 0.08, 0.08);
      // Pulse 2: "dub" (0.12s later)
      this.scheduleHeartbeatPulse(t + 0.12, 55, 30, 0.06, 0.07);
    } catch {
      // Non-fatal WebAudio error
    }
  }

  private scheduleBreath(delayMs: number): void {
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer);
      this.breathingTimer = null;
    }
    if (this.disposed || this.muted || !this.continuousActive) return;

    this.breathingTimer = setTimeout(() => {
      this.breathingTimer = null;
      if (this.disposed || this.muted || !this.continuousActive) return;
      this.playBreath();
      const intervalMs = (60 / this.breathingProfile.breathsPerMinute) * 1000;
      this.scheduleBreath(intervalMs);
    }, delayMs);
  }

  private playBreath(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      !this.vitalGain ||
      this.muted ||
      this.ctx.state !== "running"
    )
      return;

    try {
      const t = this.ctx.currentTime;
      const { durationSeconds, pitch, volume } = this.breathingProfile;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, pitch * 0.72),
        t + durationSeconds,
      );

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(480 + pitch, t);
      filter.Q.setValueAtTime(0.55, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(volume, t + durationSeconds * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSeconds);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.vitalGain);
      osc.start(t);
      osc.stop(t + durationSeconds + 0.02);
    } catch {
      // Safe ignore
    }
  }

  private scheduleHeartbeatPulse(
    startTime: number,
    startFreq: number,
    endFreq: number,
    gainVal: number,
    duration: number,
  ): void {
    if (!this.ctx || !this.vitalGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFreq),
        startTime + duration,
      );

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.vitalGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    } catch {
      // Safe ignore
    }
  }

  private playDoorKnock(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      this.muted ||
      this.ctx.state !== "running"
    )
      return;
    try {
      const baseTime = this.ctx.currentTime;
      const offsets = [0, 0.13, 0.27];
      for (const offset of offsets) {
        this.playKnockTap(baseTime + offset);
      }
    } catch {
      // Safe ignore
    }
  }

  private playKnockTap(time: number): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.05);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(160, time);
      filter.Q.setValueAtTime(2.5, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.06);
    } catch {
      // Safe ignore
    }
  }

  private playToolClink(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      this.muted ||
      this.ctx.state !== "running"
    )
      return;
    try {
      const t = this.ctx.currentTime;
      this.playMetallicTone(t, 2500, 0.035, 0.05);
      this.playMetallicTone(t, 4100, 0.02, 0.04);
    } catch {
      // Safe ignore
    }
  }

  private playMetallicTone(
    time: number,
    freq: number,
    volume: number,
    duration: number,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch {
      // Safe ignore
    }
  }

  private playPainReaction(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      this.muted ||
      this.ctx.state !== "running"
    )
      return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.22);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch {
      // Safe ignore
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer);
      this.breathingTimer = null;
    }

    this.stopSpeech();

    if (this.humOsc1) {
      try {
        this.humOsc1.stop();
        this.humOsc1.disconnect();
      } catch {
        // Safe ignore
      }
      this.humOsc1 = null;
    }

    if (this.humOsc2) {
      try {
        this.humOsc2.stop();
        this.humOsc2.disconnect();
      } catch {
        // Safe ignore
      }
      this.humOsc2 = null;
    }

    if (this.ctx) {
      try {
        void this.ctx.close().catch(() => undefined);
      } catch {
        // Safe ignore
      }
      this.ctx = null;
    }
  }
}
