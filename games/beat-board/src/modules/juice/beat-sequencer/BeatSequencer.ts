// --- Types ---

export type BeatCallback = (beat: number, bar: number) => void;
export type BarCallback = (bar: number) => void;

export interface BeatSequencerConfig {
  /** Beats per minute. */
  bpm: number;
  /** Beats per bar/measure. Default: 4. */
  beatsPerBar?: number;
  /** Subdivisions per beat (1 = quarter notes, 2 = eighth notes, etc). Default: 1. */
  subdivision?: number;
}

export interface BeatSequencerState {
  /** Current beat within bar (0-based). */
  beat: number;
  /** Current bar number (0-based). */
  bar: number;
  /** Total ticks since start. */
  tick: number;
  /** 0..1 progress within current beat. */
  phase: number;
  /** Whether the sequencer is running. */
  active: boolean;
}

export interface BeatSequencer {
  /** Activate the sequencer, begin tracking beats from current position. */
  start(): void;
  /** Deactivate, freeze current state. */
  stop(): void;
  /** Advance elapsed time by dt seconds. Returns current state. */
  update(dt: number): BeatSequencerState;
  /** Register a beat callback. Returns unsubscribe function. */
  onBeat(callback: BeatCallback): () => void;
  /** Register a bar callback. Returns unsubscribe function. */
  onBar(callback: BarCallback): () => void;
  /** Whether the sequencer is currently active. */
  isActive(): boolean;
  /** Stop and reset all counters to 0. */
  reset(): void;
}

// --- Implementation ---

export function createBeatSequencer(config: BeatSequencerConfig): BeatSequencer {
  const bpm = config.bpm;
  const beatsPerBar = config.beatsPerBar ?? 4;
  const subdivision = config.subdivision ?? 1;

  const tickDuration = 60 / (bpm * subdivision); // seconds per tick
  const ticksPerBeat = subdivision;
  const ticksPerBar = subdivision * beatsPerBar;

  let active = false;
  let tick = 0;
  let accumulator = 0;

  const beatCallbacks = new Set<BeatCallback>();
  const barCallbacks = new Set<BarCallback>();

  function getBeat(): number {
    return Math.floor(tick / ticksPerBeat) % beatsPerBar;
  }

  function getBar(): number {
    return Math.floor(tick / ticksPerBar);
  }

  return {
    start(): void {
      active = true;
    },

    stop(): void {
      active = false;
    },

    update(dt: number): BeatSequencerState {
      if (active) {
        accumulator += dt;

        while (accumulator >= tickDuration) {
          accumulator -= tickDuration;

          const prevBeat = getBeat();
          const prevBar = getBar();

          tick++;

          const newBeat = getBeat();
          const newBar = getBar();

          // Fire beat callback when beat changes
          if (newBeat !== prevBeat) {
            for (const cb of beatCallbacks) {
              cb(newBeat, newBar);
            }
          }

          // Fire bar callback when bar changes
          if (newBar !== prevBar) {
            for (const cb of barCallbacks) {
              cb(newBar);
            }
          }
        }
      }

      const subTickInBeat = tick % ticksPerBeat;
      const phase = (subTickInBeat + accumulator / tickDuration) / ticksPerBeat;

      return {
        beat: getBeat(),
        bar: getBar(),
        tick,
        phase,
        active,
      };
    },

    onBeat(callback: BeatCallback): () => void {
      beatCallbacks.add(callback);
      return () => {
        beatCallbacks.delete(callback);
      };
    },

    onBar(callback: BarCallback): () => void {
      barCallbacks.add(callback);
      return () => {
        barCallbacks.delete(callback);
      };
    },

    isActive(): boolean {
      return active;
    },

    reset(): void {
      active = false;
      tick = 0;
      accumulator = 0;
    },
  };
}
