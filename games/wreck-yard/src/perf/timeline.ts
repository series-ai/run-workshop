import type { CounterLabel, CpuPhase } from './recorder';

export interface PerfTimelineBin {
  startOffsetMs: number;
  endOffsetMs: number;
  firstRenderFrame: number | null;
  lastRenderFrame: number | null;
  firstSimFrame: number | null;
  lastSimFrame: number | null;
  phases: Partial<Record<CpuPhase, { count: number; totalMs: number; meanMs: number; maxMs: number }>>;
  counters: Partial<Record<CounterLabel, { count: number; min: number; max: number; mean: number; last: number }>>;
}

export interface PerfTimeline {
  binDurationMs: 1000;
  bins: PerfTimelineBin[];
}

/** Stores complete capture intervals independently of the raw record ring. */
export class Timeline {
  private readonly phases: Float64Array;
  private readonly counters: Float64Array;
  private readonly frames: Float64Array;
  private readonly seen: Uint8Array;
  constructor(private readonly maxDurationMs: number, private readonly phaseLabels: readonly CpuPhase[], private readonly counterLabels: readonly CounterLabel[]) {
    const bins = Math.ceil(maxDurationMs / 1000);
    this.phases = new Float64Array(bins * phaseLabels.length * 3);
    this.counters = new Float64Array(bins * counterLabels.length * 5);
    this.frames = new Float64Array(bins * 4);
    this.seen = new Uint8Array(bins);
  }

  write(type: number, label: number, offsetMs: number, durationMs: number, value: number, renderFrame: number, simFrame: number): void {
    const bin = Math.floor(offsetMs / 1000);
    if (bin < 0 || bin >= this.seen.length) return;
    const frameOffset = bin * 4;
    if (!this.seen[bin]) {
      this.frames[frameOffset] = renderFrame;
      this.frames[frameOffset + 2] = simFrame;
      this.seen[bin] = 1;
    }
    this.frames[frameOffset + 1] = renderFrame;
    this.frames[frameOffset + 3] = simFrame;
    if (type === 1) {
      const index = (bin * this.phaseLabels.length + label) * 3;
      this.phases[index] += 1;
      this.phases[index + 1] += durationMs;
      this.phases[index + 2] = Math.max(this.phases[index + 2], durationMs);
    } else if (type === 2) {
      const index = (bin * this.counterLabels.length + label) * 5;
      const count = this.counters[index];
      this.counters[index] = count + 1;
      this.counters[index + 1] = count ? Math.min(this.counters[index + 1], value) : value;
      this.counters[index + 2] = count ? Math.max(this.counters[index + 2], value) : value;
      this.counters[index + 3] += value;
      this.counters[index + 4] = value;
    }
  }

  export(elapsedMs: number): PerfTimeline {
    const bins: PerfTimelineBin[] = [];
    const end = Math.min(elapsedMs, this.maxDurationMs);
    for (let bin = 0; bin < Math.ceil(end / 1000); bin += 1) {
      const frame = bin * 4;
      const entry: PerfTimelineBin = {
        startOffsetMs: bin * 1000, endOffsetMs: Math.min(end, (bin + 1) * 1000),
        firstRenderFrame: this.seen[bin] ? this.frames[frame] : null,
        lastRenderFrame: this.seen[bin] ? this.frames[frame + 1] : null,
        firstSimFrame: this.seen[bin] ? this.frames[frame + 2] : null,
        lastSimFrame: this.seen[bin] ? this.frames[frame + 3] : null,
        phases: {}, counters: {},
      };
      for (let label = 0; label < this.phaseLabels.length; label += 1) {
        const index = (bin * this.phaseLabels.length + label) * 3;
        const count = this.phases[index];
        if (count) entry.phases[this.phaseLabels[label]] = {
          count, totalMs: this.phases[index + 1], meanMs: this.phases[index + 1] / count, maxMs: this.phases[index + 2],
        };
      }
      for (let label = 0; label < this.counterLabels.length; label += 1) {
        const index = (bin * this.counterLabels.length + label) * 5;
        const count = this.counters[index];
        if (count) entry.counters[this.counterLabels[label]] = {
          count, min: this.counters[index + 1], max: this.counters[index + 2], mean: this.counters[index + 3] / count, last: this.counters[index + 4],
        };
      }
      bins.push(entry);
    }
    return { binDurationMs: 1000, bins };
  }
}
