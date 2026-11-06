import { Timeline, type PerfTimeline } from './timeline';
import { GPU_PHASES, type GpuPhase, type GpuTimer, type GpuTimerExport } from './gpuTimer.js';

export const CPU_PHASES = [
  'frame.pump',
  'sim.total',
  'sim.gameBefore',
  'sim.nativeStep',
  'sim.gameAfter',
  'checkpoint.capture',
  'checkpoint.restore',
  'checkpoint.release',
  'checksum.encode',
  'lateJoin.encode',
  'render.project',
  'render.interpolate',
  'occlusion.build',
  'crates.upload',
  'portal.plan',
  'portal.cull',
  'portal.render',
  'render.main',
  'post.ao',
  'post.bloom',
  'post.composite',
  'checkpoint.spill',
  'sim.physicsStep',
  'sim.physicsLatest',
  'sim.players',
  'sim.fractures',
  'sim.impacts',
  'sim.crateBreak',
  'sim.cooling',
  'sim.worldRead',
  'fracture.carve',
  'fracture.split',
  'fracture.cook',
  'fracture.edit',
  'sim.lava',
  'sim.roadCourse',
] as const;

export const COUNTER_LABELS = [
  'frame.intervalMs',
  'sim.steps',
  'sim.bodyCount',
  'sim.activeBodies',
  'sim.sleepingBodies',
  'checkpoint.live',
  'checkpoint.peak',
  'checksum.bytes',
  'lateJoin.bytes',
  'occlusion.rebuilds',
  'crates.instanceWrites',
  'portal.views',
  'portal.culled',
  'render.interpolations',
  'webgl.calls',
  'webgl.triangles',
  'webgl.geometries',
  'webgl.textures',
  'webgl.programs',
  'webgl.ownedBufferBytes',
  'memory.wasmBytes',
  'webgl.postTargetBytesEstimate',
  'sim.contacts',
  'sim.broadphasePairs',
  'sim.contactPoints',
  'sim.awakeIslands',
  'sim.ccdSweeps',
  'sim.impacts',
  'torch.pendingCuts',
  'torch.cuts',
  'fracture.removedVoxels',
  'fracture.fragments',
  'input.primary',
  'input.moveX',
  'input.moveZ',
  'viewport.scale',
  'camera.fov',
  'camera.zoom',
  'memory.jsHeapUsedBytes',
  'sim.hotBodies',
  'render.voxelBodies',
  'lava.edits',
  'lava.removedVoxels',
] as const;

export const INPUT_STAGES = ['event', 'sample', 'apply', 'renderSubmission'] as const;

export type CpuPhase = (typeof CPU_PHASES)[number];
export type CounterLabel = (typeof COUNTER_LABELS)[number];
export type InputStage = (typeof INPUT_STAGES)[number];

const DEFAULT_CAPACITY = 32_768;
const MAX_CAPACITY = 65_536;
const DEFAULT_MAX_DURATION_MS = 30_000;
const MAX_DURATION_MS = 60_000;
const RECORD_STRIDE = 6;
const RECORD_PHASE = 1;
const RECORD_COUNTER = 2;
const RECORD_FRAME = 3;
const RECORD_INPUT = 4;
const INPUT_EVENT = 0;
const INVALID_TIMESTAMP = 0;
const MAX_SAFE_SEQUENCE = Number.MAX_SAFE_INTEGER;

export interface PerfRecorderOptions {
  capacity?: number;
  maxDurationMs?: number;
  gpuTimer?: GpuTimer;
}

export interface PerfStartOptions {
  capacity?: number;
  maxDurationMs?: number;
}

export interface QuantileSummary {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export type PerfRecord =
  | {
      kind: 'phase';
      label: CpuPhase;
      timestampMs: number;
      durationMs: number;
      renderFrame: number;
      simFrame: number;
    }
  | {
      kind: 'counter';
      label: CounterLabel;
      timestampMs: number;
      value: number;
      renderFrame: number;
      simFrame: number;
    }
  | {
      kind: 'frame';
      timestampMs: number;
      renderFrame: number;
      simFrame: number;
    }
  | {
      kind: 'input';
      stage: InputStage;
      timestampMs: number;
      sequence: number;
      renderFrame: number;
      simFrame: number;
    };

export interface InputLatencyRecord {
  sequence: number;
  status: 'complete' | 'incomplete' | 'out-of-order';
  eventAtMs?: number;
  sampleAtMs?: number;
  applyAtMs?: number;
  renderSubmissionAtMs?: number;
  eventToSampleMs?: number;
  eventToApplyMs?: number;
  eventToRenderSubmissionMs?: number;
}

export interface JsHeapSnapshot {
  status: 'available' | 'unavailable';
  reason?: 'unsupported';
  usedBytes?: number;
  totalBytes?: number;
  limitBytes?: number;
}

export interface WasmMemorySnapshot {
  status: 'available' | 'unavailable';
  reason?: 'not-reported';
  bytes?: number;
}

export interface WebGLResourceSnapshot {
  status: 'available' | 'unavailable';
  calls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
  programs?: number;
  ownedBufferBytes?: number;
}

export interface PerfViewport {
  width: number;
  height: number;
  pixelRatio: number;
  scale: number;
}

export interface PerfCaptureContext {
  capturedAt: string;
  deterministicVersion: string;
  engineIdentityHash: string;
  userAgent: string;
  hardwareConcurrency: number | null;
  viewportAtStart: PerfViewport;
  viewportAtExport?: PerfViewport;
}

export interface PerfReport {
  schemaVersion: 1;
  context?: PerfCaptureContext;
  units: { time: 'ms'; memory: 'bytes' };
  startedAtMs: number;
  stoppedAtMs: number;
  elapsedMs: number;
  maxDurationMs: number;
  capacity: number;
  recordCount: number;
  totalRecords: number;
  overwrittenRecords: number;
  records: PerfRecord[];
  timeline: PerfTimeline;
  phaseSummary: Partial<Record<CpuPhase, QuantileSummary>>;
  gpuPhaseSummary: Partial<Record<GpuPhase, QuantileSummary>>;
  counterSummary: Partial<Record<CounterLabel, QuantileSummary>>;
  inputLatencies: InputLatencyRecord[];
  inputLatencySummary: {
    eventToSampleMs?: QuantileSummary;
    eventToApplyMs?: QuantileSummary;
    eventToRenderSubmissionMs?: QuantileSummary;
  };
  jsHeap: { start: JsHeapSnapshot; stop: JsHeapSnapshot };
  wasmMemory: WasmMemorySnapshot;
  webglResources: WebGLResourceSnapshot;
  gpu: GpuTimerExport;
}

interface InputTimeline {
  eventAtMs?: number;
  sampleAtMs?: number;
  applyAtMs?: number;
  renderSubmissionAtMs?: number;
}

const CPU_PHASE_IDS: Record<CpuPhase, number> = Object.fromEntries(
  CPU_PHASES.map((phase, idx) => [phase, idx])
) as Record<CpuPhase, number>;

const COUNTER_IDS: Record<CounterLabel, number> = Object.fromEntries(
  COUNTER_LABELS.map((label, idx) => [label, idx])
) as Record<CounterLabel, number>;

const INPUT_STAGE_IDS: Record<InputStage, number> = {
  event: 0,
  sample: 1,
  apply: 2,
  renderSubmission: 3,
};

const WEBGL_COUNTER_IDS = {
  calls: COUNTER_IDS['webgl.calls'],
  triangles: COUNTER_IDS['webgl.triangles'],
  geometries: COUNTER_IDS['webgl.geometries'],
  textures: COUNTER_IDS['webgl.textures'],
  programs: COUNTER_IDS['webgl.programs'],
  ownedBufferBytes: COUNTER_IDS['webgl.ownedBufferBytes'],
} as const;

export class PerfRecorder {
  private active = false;
  private timeline: Timeline | undefined;
  private capacity = 0;
  private maxDurationMs = DEFAULT_MAX_DURATION_MS;
  private startedAtMs = 0;
  private stoppedAtMs = 0;
  private currentRenderFrame = 0;
  private currentSimFrame = 0;
  private nextSequence = 0;
  private latestInputSequence = 0;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private gpuTimer: GpuTimer | undefined;
  private recordTypes = new Uint8Array(0);
  private labelIds = new Uint8Array(0);
  private data = new Float64Array(0);
  private writeIndex = 0;
  private recordCount = 0;
  private totalRecords = 0;
  private latestCounters = new Float64Array(COUNTER_LABELS.length);
  private seenCounters = new Uint8Array(COUNTER_LABELS.length);
  private jsHeapAtStart: JsHeapSnapshot = { status: 'unavailable', reason: 'unsupported' };
  private jsHeapAtStop: JsHeapSnapshot = { status: 'unavailable', reason: 'unsupported' };

  get isActive(): boolean {
    return this.active;
  }

  get status(): { active: boolean; elapsedMs: number; maxDurationMs: number; totalRecords: number } {
    return {
      active: this.active,
      elapsedMs: this.capacity ? Math.max(0, (this.active ? performance.now() : this.stoppedAtMs) - this.startedAtMs) : 0,
      maxDurationMs: this.maxDurationMs,
      totalRecords: this.totalRecords,
    };
  }

  get lastInputSequence(): number {
    return this.latestInputSequence;
  }

  start(options: PerfRecorderOptions = {}): void {
    const capacity = options.capacity ?? DEFAULT_CAPACITY;
    const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      throw new RangeError(`capacity must be an integer from 1 to ${MAX_CAPACITY}`);
    }
    if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0 || maxDurationMs > MAX_DURATION_MS) {
      throw new RangeError(`maxDurationMs must be greater than 0 and at most ${MAX_DURATION_MS}`);
    }

    this.stop();
    this.capacity = capacity;
    this.timeline = new Timeline(maxDurationMs, CPU_PHASES, COUNTER_LABELS);
    this.maxDurationMs = maxDurationMs;
    this.recordTypes = new Uint8Array(capacity);
    this.labelIds = new Uint8Array(capacity);
    this.data = new Float64Array(capacity * RECORD_STRIDE);
    this.writeIndex = 0;
    this.recordCount = 0;
    this.totalRecords = 0;
    this.latestCounters.fill(0);
    this.seenCounters.fill(0);
    this.currentRenderFrame = 0;
    this.currentSimFrame = 0;
    this.nextSequence = 0;
    this.latestInputSequence = 0;
    this.gpuTimer = options.gpuTimer;
    this.gpuTimer?.start(capacity);
    this.jsHeapAtStart = readJsHeapSnapshot();
    this.jsHeapAtStop = this.jsHeapAtStart;
    this.startedAtMs = performance.now();
    this.stoppedAtMs = this.startedAtMs;
    this.active = true;
    this.timeout = setTimeout(() => this.stop(), maxDurationMs);
  }

  stop(): void {
    if (this.active) this.stopAt(performance.now());
  }

  clear(): void {
    this.stop();
    this.recordTypes = new Uint8Array(0);
    this.labelIds = new Uint8Array(0);
    this.data = new Float64Array(0);
    this.capacity = 0;
    this.timeline = undefined;
    this.writeIndex = 0;
    this.recordCount = 0;
    this.totalRecords = 0;
    this.latestCounters.fill(0);
    this.seenCounters.fill(0);
    this.startedAtMs = 0;
    this.stoppedAtMs = 0;
    this.currentRenderFrame = 0;
    this.currentSimFrame = 0;
    this.nextSequence = 0;
    this.latestInputSequence = 0;
    this.jsHeapAtStart = { status: 'unavailable', reason: 'unsupported' };
    this.jsHeapAtStop = this.jsHeapAtStart;
    this.gpuTimer?.clear();
    this.gpuTimer = undefined;
  }

  dispose(): void {
    this.clear();
  }

  beginPhase(label: CpuPhase): number {
    const timestampMs = this.timestampIfActive();
    return timestampMs === INVALID_TIMESTAMP || CPU_PHASE_IDS[label] === undefined ? INVALID_TIMESTAMP : timestampMs;
  }

  endPhase(label: CpuPhase, start: number): void {
    if (!this.active || start <= 0 || !Number.isFinite(start) || start < this.startedAtMs) return;
    const timestampMs = performance.now();
    const labelId = CPU_PHASE_IDS[label];
    if (timestampMs === INVALID_TIMESTAMP || labelId === undefined) return;
    const durationMs = timestampMs - start;
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.write(RECORD_PHASE, labelId, start, durationMs, 0, this.currentRenderFrame, this.currentSimFrame, 0);
    if (timestampMs - this.startedAtMs >= this.maxDurationMs) this.stopAt(timestampMs);
  }

  count(label: CounterLabel, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const timestampMs = this.timestampIfActive();
    if (timestampMs === INVALID_TIMESTAMP) return;
    const labelId = COUNTER_IDS[label];
    this.latestCounters[labelId] = value;
    this.seenCounters[labelId] = 1;
    this.write(RECORD_COUNTER, labelId, timestampMs, 0, value, this.currentRenderFrame, this.currentSimFrame, 0);
  }

  frame(renderFrame: number, simFrame: number): void {
    const timestampMs = this.timestampIfActive();
    if (timestampMs === INVALID_TIMESTAMP || !Number.isFinite(renderFrame) || !Number.isFinite(simFrame)) return;
    this.currentRenderFrame = renderFrame;
    this.currentSimFrame = simFrame;
    this.write(RECORD_FRAME, 0, timestampMs, 0, 0, renderFrame, simFrame, 0);
  }

  input(stage: InputStage, sequence: number, simFrame: number): void {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || !Number.isFinite(simFrame)) return;
    const timestampMs = this.timestampIfActive();
    if (timestampMs === INVALID_TIMESTAMP) return;
    if (stage === 'event') {
      this.latestInputSequence = sequence;
      if (sequence > this.nextSequence) this.nextSequence = sequence;
    }
    this.write(RECORD_INPUT, INPUT_STAGE_IDS[stage], timestampMs, 0, 0, this.currentRenderFrame, simFrame, sequence);
  }

  inputEvent(simFrame: number): number {
    if (!Number.isFinite(simFrame)) return 0;
    const timestampMs = this.timestampIfActive();
    if (timestampMs === INVALID_TIMESTAMP) return 0;
    this.nextSequence = this.nextSequence >= MAX_SAFE_SEQUENCE ? 1 : this.nextSequence + 1;
    this.latestInputSequence = this.nextSequence;
    this.write(RECORD_INPUT, INPUT_EVENT, timestampMs, 0, 0, this.currentRenderFrame, simFrame, this.nextSequence);
    return this.nextSequence;
  }

  export(): PerfReport {
    this.stop();
    const records = this.readRecords();
    const phaseSamples: number[][] = Array.from({ length: CPU_PHASES.length }, () => []);
    const counterSamples: number[][] = Array.from({ length: COUNTER_LABELS.length }, () => []);
    for (const record of records) {
      if (record.kind === 'phase') phaseSamples[CPU_PHASE_IDS[record.label]].push(record.durationMs);
      else if (record.kind === 'counter') counterSamples[COUNTER_IDS[record.label]].push(record.value);
    }

    const phaseSummary: Partial<Record<CpuPhase, QuantileSummary>> = {};
    const counterSummary: Partial<Record<CounterLabel, QuantileSummary>> = {};
    for (let index = 0; index < CPU_PHASES.length; index += 1) {
      const summary = summarize(phaseSamples[index]);
      if (summary !== undefined) phaseSummary[CPU_PHASES[index]] = summary;
    }
    for (let index = 0; index < COUNTER_LABELS.length; index += 1) {
      const summary = summarize(counterSamples[index]);
      if (summary !== undefined) counterSummary[COUNTER_LABELS[index]] = summary;
    }

    const input = summarizeInputLatencies(records);
    const gpu = this.gpuTimer?.export() ?? unavailableGpuExport();
    const gpuSamples: number[][] = Array.from({ length: GPU_PHASES.length }, () => []);
    for (const record of gpu.records) {
      if (record.status !== 'valid' || record.durationMs === undefined) continue;
      gpuSamples[GPU_PHASES.indexOf(record.phase)].push(record.durationMs);
    }
    const gpuPhaseSummary: Partial<Record<GpuPhase, QuantileSummary>> = {};
    for (let index = 0; index < GPU_PHASES.length; index += 1) {
      const summary = summarize(gpuSamples[index]);
      if (summary !== undefined) gpuPhaseSummary[GPU_PHASES[index]] = summary;
    }
    const stoppedAtMs = this.stoppedAtMs;
    const elapsedMs = this.capacity > 0 ? Math.max(0, stoppedAtMs - this.startedAtMs) : 0;
    const wasmBytesId = COUNTER_IDS['memory.wasmBytes'];
    const wasmMemory: WasmMemorySnapshot = this.seenCounters[wasmBytesId] === 1
      ? { status: 'available', bytes: this.latestCounters[wasmBytesId] }
      : { status: 'unavailable', reason: 'not-reported' };

    return {
      schemaVersion: 1,
      units: { time: 'ms', memory: 'bytes' },
      startedAtMs: this.startedAtMs,
      stoppedAtMs,
      elapsedMs,
      maxDurationMs: this.maxDurationMs,
      capacity: this.capacity,
      recordCount: this.recordCount,
      totalRecords: this.totalRecords,
      overwrittenRecords: Math.max(0, this.totalRecords - this.recordCount),
      records,
      timeline: this.timeline?.export(elapsedMs) ?? { binDurationMs: 1000, bins: [] },
      phaseSummary,
      gpuPhaseSummary,
      counterSummary,
      inputLatencies: input.records,
      inputLatencySummary: input.summary,
      jsHeap: { start: this.jsHeapAtStart, stop: this.jsHeapAtStop },
      wasmMemory,
      webglResources: readWebGLResourceSnapshot(this.latestCounters, this.seenCounters),
      gpu,
    };
  }

  private timestampIfActive(): number {
    if (!this.active) return INVALID_TIMESTAMP;
    const now = performance.now();
    if (now - this.startedAtMs >= this.maxDurationMs) {
      this.stopAt(now);
      return INVALID_TIMESTAMP;
    }
    return now;
  }

  private stopAt(now: number): void {
    if (!this.active) return;
    this.stoppedAtMs = now;
    this.jsHeapAtStop = readJsHeapSnapshot();
    this.active = false;
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.gpuTimer?.stop();
  }

  private write(
    type: number,
    labelId: number,
    timestampMs: number,
    durationMs: number,
    value: number,
    renderFrame: number,
    simFrame: number,
    sequence: number,
  ): void {
    this.timeline?.write(type, labelId, timestampMs - this.startedAtMs, durationMs, value, renderFrame, simFrame);
    const index = this.writeIndex;
    const offset = index * RECORD_STRIDE;
    this.recordTypes[index] = type;
    this.labelIds[index] = labelId;
    this.data[offset] = timestampMs;
    this.data[offset + 1] = durationMs;
    this.data[offset + 2] = value;
    this.data[offset + 3] = renderFrame;
    this.data[offset + 4] = simFrame;
    this.data[offset + 5] = sequence;
    this.writeIndex = (index + 1) % this.capacity;
    this.recordCount = Math.min(this.recordCount + 1, this.capacity);
    this.totalRecords += 1;
  }

  private readRecords(): PerfRecord[] {
    const records: PerfRecord[] = [];
    if (this.capacity === 0) return records;
    const start = this.recordCount === this.capacity ? this.writeIndex : 0;
    for (let offset = 0; offset < this.recordCount; offset += 1) {
      const index = (start + offset) % this.capacity;
      const dataOffset = index * RECORD_STRIDE;
      const timestampMs = this.data[dataOffset];
      const renderFrame = this.data[dataOffset + 3];
      const simFrame = this.data[dataOffset + 4];
      switch (this.recordTypes[index]) {
        case RECORD_PHASE:
          records.push({
            kind: 'phase',
            label: CPU_PHASES[this.labelIds[index]],
            timestampMs,
            durationMs: this.data[dataOffset + 1],
            renderFrame,
            simFrame,
          });
          break;
        case RECORD_COUNTER:
          records.push({
            kind: 'counter',
            label: COUNTER_LABELS[this.labelIds[index]],
            timestampMs,
            value: this.data[dataOffset + 2],
            renderFrame,
            simFrame,
          });
          break;
        case RECORD_FRAME:
          records.push({ kind: 'frame', timestampMs, renderFrame, simFrame });
          break;
        case RECORD_INPUT:
          records.push({
            kind: 'input',
            stage: INPUT_STAGES[this.labelIds[index]],
            timestampMs,
            sequence: this.data[dataOffset + 5],
            renderFrame,
            simFrame,
          });
          break;
      }
    }
    return records;
  }
}

export const perfRecorder = new PerfRecorder();

export function perfActive(): boolean {
  return perfRecorder.isActive;
}

export function beginPhase(label: CpuPhase): number {
  return perfRecorder.beginPhase(label);
}

export function endPhase(label: CpuPhase, start: number): void {
  perfRecorder.endPhase(label, start);
}

export function perfCount(label: CounterLabel, value: number): void {
  perfRecorder.count(label, value);
}

export function perfFrame(renderFrame: number, simFrame: number): void {
  perfRecorder.frame(renderFrame, simFrame);
}

export function perfInput(stage: InputStage, sequence: number, simFrame: number): void {
  perfRecorder.input(stage, sequence, simFrame);
}

export function perfInputEvent(simFrame: number): number {
  return perfRecorder.inputEvent(simFrame);
}

function summarize(values: number[]): QuantileSummary | undefined {
  if (values.length === 0) return undefined;
  values.sort((left, right) => left - right);
  let total = 0;
  for (const value of values) total += value;
  return {
    count: values.length,
    min: values[0],
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    max: values[values.length - 1],
    mean: total / values.length,
  };
}

function quantile(sortedValues: number[], probability: number): number {
  const index = (sortedValues.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const amount = index - lower;
  return sortedValues[lower] * (1 - amount) + sortedValues[upper] * amount;
}

function summarizeInputLatencies(records: PerfRecord[]): {
  records: InputLatencyRecord[];
  summary: PerfReport['inputLatencySummary'];
} {
  const timelines = new Map<number, InputTimeline>();
  for (const record of records) {
    if (record.kind !== 'input') continue;
    let timeline = timelines.get(record.sequence);
    if (timeline === undefined) {
      timeline = {};
      timelines.set(record.sequence, timeline);
    }
    if (record.stage === 'event' && timeline.eventAtMs === undefined) timeline.eventAtMs = record.timestampMs;
    else if (record.stage === 'sample' && timeline.sampleAtMs === undefined) timeline.sampleAtMs = record.timestampMs;
    else if (record.stage === 'apply' && timeline.applyAtMs === undefined) timeline.applyAtMs = record.timestampMs;
    else if (record.stage === 'renderSubmission' && timeline.renderSubmissionAtMs === undefined) {
      timeline.renderSubmissionAtMs = record.timestampMs;
    }
  }

  const inputRecords: InputLatencyRecord[] = [];
  const eventToSample: number[] = [];
  const eventToApply: number[] = [];
  const eventToRenderSubmission: number[] = [];
  for (const [sequence, timeline] of timelines) {
    const complete = timeline.eventAtMs !== undefined
      && timeline.sampleAtMs !== undefined
      && timeline.applyAtMs !== undefined
      && timeline.renderSubmissionAtMs !== undefined;
    const ordered = complete
      && timeline.eventAtMs! <= timeline.sampleAtMs!
      && timeline.sampleAtMs! <= timeline.applyAtMs!
      && timeline.applyAtMs! <= timeline.renderSubmissionAtMs!;
    const inputRecord: InputLatencyRecord = {
      sequence,
      status: !complete ? 'incomplete' : ordered ? 'complete' : 'out-of-order',
    };
    if (timeline.eventAtMs !== undefined) inputRecord.eventAtMs = timeline.eventAtMs;
    if (timeline.sampleAtMs !== undefined) inputRecord.sampleAtMs = timeline.sampleAtMs;
    if (timeline.applyAtMs !== undefined) inputRecord.applyAtMs = timeline.applyAtMs;
    if (timeline.renderSubmissionAtMs !== undefined) inputRecord.renderSubmissionAtMs = timeline.renderSubmissionAtMs;
    if (ordered && timeline.eventAtMs !== undefined && timeline.sampleAtMs !== undefined) {
      inputRecord.eventToSampleMs = timeline.sampleAtMs - timeline.eventAtMs;
      eventToSample.push(inputRecord.eventToSampleMs);
    }
    if (ordered && timeline.eventAtMs !== undefined && timeline.applyAtMs !== undefined) {
      inputRecord.eventToApplyMs = timeline.applyAtMs - timeline.eventAtMs;
      eventToApply.push(inputRecord.eventToApplyMs);
    }
    if (ordered && timeline.eventAtMs !== undefined && timeline.renderSubmissionAtMs !== undefined) {
      inputRecord.eventToRenderSubmissionMs = timeline.renderSubmissionAtMs - timeline.eventAtMs;
      eventToRenderSubmission.push(inputRecord.eventToRenderSubmissionMs);
    }
    inputRecords.push(inputRecord);
  }

  return {
    records: inputRecords,
    summary: {
      eventToSampleMs: summarize(eventToSample),
      eventToApplyMs: summarize(eventToApply),
      eventToRenderSubmissionMs: summarize(eventToRenderSubmission),
    },
  };
}

function readJsHeapSnapshot(): JsHeapSnapshot {
  const memory = (performance as Performance & {
    memory?: {
      usedJSHeapSize?: number;
      totalJSHeapSize?: number;
      jsHeapSizeLimit?: number;
    };
  }).memory;
  if (memory === undefined) return { status: 'unavailable', reason: 'unsupported' };
  const snapshot: JsHeapSnapshot = { status: 'available' };
  if (Number.isFinite(memory.usedJSHeapSize)) snapshot.usedBytes = memory.usedJSHeapSize;
  if (Number.isFinite(memory.totalJSHeapSize)) snapshot.totalBytes = memory.totalJSHeapSize;
  if (Number.isFinite(memory.jsHeapSizeLimit)) snapshot.limitBytes = memory.jsHeapSizeLimit;
  if (snapshot.usedBytes === undefined && snapshot.totalBytes === undefined && snapshot.limitBytes === undefined) {
    return { status: 'unavailable', reason: 'unsupported' };
  }
  return snapshot;
}

function readWebGLResourceSnapshot(values: Float64Array, seen: Uint8Array): WebGLResourceSnapshot {
  const snapshot: WebGLResourceSnapshot = { status: 'unavailable' };
  let available = false;
  for (const [key, labelId] of Object.entries(WEBGL_COUNTER_IDS)) {
    if (seen[labelId] !== 1) continue;
    snapshot[key as keyof typeof WEBGL_COUNTER_IDS] = values[labelId];
    available = true;
  }
  if (available) snapshot.status = 'available';
  return snapshot;
}

function unavailableGpuExport(): GpuTimerExport {
  return {
    status: 'unavailable',
    reason: 'not-enabled',
    queryPoolSize: 0,
    lostQueryCount: 0,
    overwrittenRecords: 0,
    records: [],
  };
}
