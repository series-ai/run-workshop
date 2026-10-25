export const GPU_PHASES = [
  'portal.render',
  'render.main',
  'post.ao',
  'post.bloom',
  'post.composite',
] as const;

export type GpuPhase = (typeof GPU_PHASES)[number];
export type GpuRecordStatus = 'valid' | 'unavailable' | 'disjoint';
export type GpuTimerStatus = 'available' | 'unavailable' | 'stopped' | 'context-lost';

export interface GpuTimeRecord {
  status: GpuRecordStatus;
  phase: GpuPhase;
  frameId: number;
  startedAtMs: number;
  completedFrameId?: number;
  durationMs?: number;
}

export interface GpuTimerExport {
  status: GpuTimerStatus;
  reason?: 'webgl2-required' | 'extension-unavailable' | 'context-lost' | 'not-enabled';
  queryPoolSize: number;
  lostQueryCount: number;
  overwrittenRecords: number;
  records: GpuTimeRecord[];
}

interface DisjointTimerQueryWebGL2 {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const MAX_QUERY_POOL_SIZE = 64;
const DEFAULT_QUERY_POOL_SIZE = 16;
const QUERY_IDLE = 0;
const QUERY_ACTIVE = 1;
const QUERY_PENDING = 2;
const GPU_RECORD_VALID = 0;
const GPU_RECORD_UNAVAILABLE = 1;
const GPU_RECORD_DISJOINT = 2;
const GPU_RECORD_STRIDE = 4;
const INVALID_SLOT = -1;

export interface GpuTimerOptions {
  queryPoolSize?: number;
}

export class GpuTimer {
  private readonly gl: WebGL2RenderingContext | null;
  private readonly queryPoolSize: number;
  private extension: DisjointTimerQueryWebGL2 | null = null;
  private queries: Array<WebGLQuery | null> = [];
  private queryStates = new Uint8Array(0);
  private queryPhases = new Uint8Array(0);
  private queryFrames = new Float64Array(0);
  private queryStartTimes = new Float64Array(0);
  private activeSlot = INVALID_SLOT;
  private records = new Float64Array(0);
  private recordStatuses = new Uint8Array(0);
  private recordPhases = new Uint8Array(0);
  private recordWrite = 0;
  private recordCount = 0;
  private totalRecords = 0;
  private lostQueries = 0;
  private status: GpuTimerStatus = 'stopped';
  private reason: GpuTimerExport['reason'];
  private started = false;
  private contextListenerAttached = false;

  private readonly onContextLost = (): void => {
    this.markContextLost();
  };

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext | null, options: GpuTimerOptions = {}) {
    const poolSize = options.queryPoolSize ?? DEFAULT_QUERY_POOL_SIZE;
    if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > MAX_QUERY_POOL_SIZE) {
      throw new RangeError(`queryPoolSize must be an integer from 1 to ${MAX_QUERY_POOL_SIZE}`);
    }
    this.gl = isWebGL2(gl) ? gl : null;
    this.queryPoolSize = poolSize;
  }

  get available(): boolean {
    return this.status === 'available' && this.started;
  }

  start(recordCapacity = 32_768): void {
    this.stop();
    if (!Number.isInteger(recordCapacity) || recordCapacity < 1 || recordCapacity > 65_536) {
      throw new RangeError('recordCapacity must be an integer from 1 to 65536');
    }

    this.resetRecords(recordCapacity);
    this.lostQueries = 0;
    this.activeSlot = INVALID_SLOT;
    this.reason = undefined;

    const gl = this.gl;
    if (gl === null) {
      this.status = 'unavailable';
      this.reason = 'webgl2-required';
      return;
    }
    if (gl.isContextLost()) {
      this.status = 'context-lost';
      this.reason = 'context-lost';
      return;
    }

    try {
      this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as DisjointTimerQueryWebGL2 | null;
    } catch {
      this.extension = null;
    }
    if (this.extension === null) {
      this.status = 'unavailable';
      this.reason = 'extension-unavailable';
      return;
    }

    this.queryStates = new Uint8Array(this.queryPoolSize);
    this.queryPhases = new Uint8Array(this.queryPoolSize);
    this.queryFrames = new Float64Array(this.queryPoolSize);
    this.queryStartTimes = new Float64Array(this.queryPoolSize);
    this.queries = new Array<WebGLQuery | null>(this.queryPoolSize).fill(null);
    for (let index = 0; index < this.queryPoolSize; index += 1) {
      try {
        this.queries[index] = gl.createQuery();
      } catch {
        this.queries[index] = null;
      }
    }
    if (this.queries.every((query) => query === null)) {
      this.releaseQueries();
      this.status = 'unavailable';
      this.reason = 'extension-unavailable';
      return;
    }

    gl.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.contextListenerAttached = true;
    this.status = 'available';
    this.started = true;
  }

  begin(phase: GpuPhase, frameId: number): number {
    if (!this.started) return INVALID_SLOT;
    const gl = this.gl;
    const extension = this.extension;
    if (gl === null || extension === null || gl.isContextLost()) {
      this.markContextLost();
      this.addRecord(GPU_RECORD_UNAVAILABLE, phase, frameId, performance.now(), Number.NaN);
      this.lostQueries += 1;
      return INVALID_SLOT;
    }

    const startedAtMs = performance.now();
    if (this.activeSlot !== INVALID_SLOT) {
      this.addRecord(GPU_RECORD_UNAVAILABLE, phase, frameId, startedAtMs, Number.NaN);
      this.lostQueries += 1;
      return INVALID_SLOT;
    }

    const slot = this.findIdleSlot();
    if (slot === INVALID_SLOT) {
      this.addRecord(GPU_RECORD_UNAVAILABLE, phase, frameId, startedAtMs, Number.NaN);
      this.lostQueries += 1;
      return INVALID_SLOT;
    }

    const query = this.queries[slot];
    if (query === null || query === undefined) {
      this.addRecord(GPU_RECORD_UNAVAILABLE, phase, frameId, startedAtMs, Number.NaN);
      this.lostQueries += 1;
      return INVALID_SLOT;
    }

    try {
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    } catch {
      this.addRecord(GPU_RECORD_UNAVAILABLE, phase, frameId, startedAtMs, Number.NaN);
      this.lostQueries += 1;
      return INVALID_SLOT;
    }

    this.queryStates[slot] = QUERY_ACTIVE;
    this.queryPhases[slot] = this.phaseId(phase);
    this.queryFrames[slot] = frameId;
    this.queryStartTimes[slot] = startedAtMs;
    this.activeSlot = slot;
    return slot;
  }

  end(token: number): void {
    if (token === INVALID_SLOT || !this.started || token !== this.activeSlot) return;
    const gl = this.gl;
    const extension = this.extension;
    if (gl === null || extension === null || gl.isContextLost()) {
      this.markContextLost();
      return;
    }

    try {
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      this.queryStates[token] = QUERY_PENDING;
      this.activeSlot = INVALID_SLOT;
    } catch {
      this.addSlotRecord(token, GPU_RECORD_UNAVAILABLE, Number.NaN);
      this.lostQueries += 1;
      this.queryStates[token] = QUERY_IDLE;
      this.activeSlot = INVALID_SLOT;
    }
  }

  poll(frameId: number): void {
    if (!this.started || this.activeSlot !== INVALID_SLOT) return;
    const gl = this.gl;
    const extension = this.extension;
    if (gl === null || extension === null || gl.isContextLost()) {
      this.markContextLost();
      return;
    }

    let hasPending = false;
    for (let index = 0; index < this.queryPoolSize; index += 1) {
      if (this.queryStates[index] === QUERY_PENDING) {
        hasPending = true;
        break;
      }
    }
    if (!hasPending) return;

    if (gl.getParameter(extension.GPU_DISJOINT_EXT) === true) {
      for (let index = 0; index < this.queryPoolSize; index += 1) {
        if (this.queryStates[index] !== QUERY_PENDING) continue;
        this.addSlotRecord(index, GPU_RECORD_DISJOINT, Number.NaN, frameId);
        this.queryStates[index] = QUERY_IDLE;
        this.lostQueries += 1;
      }
      return;
    }

    for (let index = 0; index < this.queryPoolSize; index += 1) {
      if (this.queryStates[index] !== QUERY_PENDING) continue;
      const query = this.queries[index];
      if (query === null || query === undefined) {
        this.addSlotRecord(index, GPU_RECORD_UNAVAILABLE, Number.NaN, frameId);
        this.queryStates[index] = QUERY_IDLE;
        this.lostQueries += 1;
        continue;
      }

      try {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) === true;
        if (!available) continue;
        const nanoseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
        if (!Number.isFinite(nanoseconds) || nanoseconds < 0) {
          this.addSlotRecord(index, GPU_RECORD_UNAVAILABLE, Number.NaN, frameId);
          this.lostQueries += 1;
        } else {
          this.addSlotRecord(index, GPU_RECORD_VALID, nanoseconds / 1_000_000, frameId);
        }
        this.queryStates[index] = QUERY_IDLE;
      } catch {
        this.addSlotRecord(index, GPU_RECORD_UNAVAILABLE, Number.NaN, frameId);
        this.queryStates[index] = QUERY_IDLE;
        this.lostQueries += 1;
      }
    }
  }

  stop(): void {
    if (this.started) {
      const gl = this.gl;
      if (gl === null || gl.isContextLost()) {
        this.markContextLost();
        return;
      }
      if (this.activeSlot !== INVALID_SLOT && this.extension !== null) {
        const activeSlot = this.activeSlot;
        try {
          gl.endQuery(this.extension.TIME_ELAPSED_EXT);
          this.queryStates[activeSlot] = QUERY_PENDING;
        } catch {
          this.addSlotRecord(activeSlot, GPU_RECORD_UNAVAILABLE, Number.NaN);
          this.queryStates[activeSlot] = QUERY_IDLE;
          this.lostQueries += 1;
        }
      }
      this.activeSlot = INVALID_SLOT;
      this.pollPendingBeforeRelease();
      this.started = false;
      this.markPendingUnavailable();
      this.removeContextListener();
      this.releaseQueries();
      if (this.status !== 'context-lost') this.status = 'stopped';
    }
  }

  clear(): void {
    const capacity = this.recordStatuses.length;
    this.stop();
    this.resetRecords(capacity);
    this.lostQueries = 0;
  }

  export(): GpuTimerExport {
    const records: GpuTimeRecord[] = [];
    const capacity = this.recordStatuses.length;
    const start = this.recordCount === capacity ? this.recordWrite : 0;
    for (let offset = 0; offset < this.recordCount; offset += 1) {
      const index = (start + offset) % capacity;
      const statusId = this.recordStatuses[index];
      const record: GpuTimeRecord = {
        status: statusId === GPU_RECORD_VALID ? 'valid' : statusId === GPU_RECORD_DISJOINT ? 'disjoint' : 'unavailable',
        phase: GPU_PHASES[this.recordPhases[index]],
        frameId: this.records[index * GPU_RECORD_STRIDE],
        startedAtMs: this.records[index * GPU_RECORD_STRIDE + 1],
      };
      const completedFrameId = this.records[index * GPU_RECORD_STRIDE + 3];
      if (Number.isFinite(completedFrameId)) record.completedFrameId = completedFrameId;
      if (statusId === GPU_RECORD_VALID) record.durationMs = this.records[index * GPU_RECORD_STRIDE + 2];
      records.push(record);
    }

    return {
      status: this.status,
      reason: this.reason,
      queryPoolSize: this.queryPoolSize,
      lostQueryCount: this.lostQueries,
      overwrittenRecords: Math.max(0, this.totalRecords - this.recordCount),
      records,
    };
  }

  private resetRecords(capacity: number): void {
    this.records = capacity > 0 ? new Float64Array(capacity * GPU_RECORD_STRIDE) : new Float64Array(0);
    this.recordStatuses = new Uint8Array(capacity);
    this.recordPhases = new Uint8Array(capacity);
    this.recordWrite = 0;
    this.recordCount = 0;
    this.totalRecords = 0;
  }

  private findIdleSlot(): number {
    for (let index = 0; index < this.queryPoolSize; index += 1) {
      if (this.queryStates[index] === QUERY_IDLE && this.queries[index] !== null) return index;
    }
    return INVALID_SLOT;
  }

  private phaseId(phase: GpuPhase): number {
    return GPU_PHASES.indexOf(phase);
  }

  private addSlotRecord(slot: number, status: number, durationMs: number, completedFrameId = Number.NaN): void {
    this.addRecord(
      status,
      GPU_PHASES[this.queryPhases[slot]],
      this.queryFrames[slot],
      this.queryStartTimes[slot],
      durationMs,
      completedFrameId,
    );
  }

  private addRecord(
    status: number,
    phase: GpuPhase,
    frameId: number,
    startedAtMs: number,
    durationMs: number,
    completedFrameId = Number.NaN,
  ): void {
    const index = this.recordWrite;
    const offset = index * GPU_RECORD_STRIDE;
    this.records[offset] = frameId;
    this.records[offset + 1] = startedAtMs;
    this.records[offset + 2] = durationMs;
    this.records[offset + 3] = completedFrameId;
    this.recordStatuses[index] = status;
    this.recordPhases[index] = this.phaseId(phase);
    this.recordWrite = (index + 1) % this.recordStatuses.length;
    this.recordCount = Math.min(this.recordCount + 1, this.recordStatuses.length);
    this.totalRecords += 1;
  }

  private pollPendingBeforeRelease(): void {
    if (this.started) this.poll(Number.NaN);
  }

  private markPendingUnavailable(): void {
    for (let index = 0; index < this.queryPoolSize; index += 1) {
      if (this.queryStates[index] === QUERY_ACTIVE) {
        this.addSlotRecord(index, GPU_RECORD_UNAVAILABLE, Number.NaN);
        this.queryStates[index] = QUERY_IDLE;
        this.lostQueries += 1;
      } else if (this.queryStates[index] === QUERY_PENDING) {
        this.addSlotRecord(index, GPU_RECORD_UNAVAILABLE, Number.NaN);
        this.queryStates[index] = QUERY_IDLE;
        this.lostQueries += 1;
      }
    }
  }

  private markContextLost(): void {
    if (this.status === 'context-lost') return;
    this.status = 'context-lost';
    this.reason = 'context-lost';
    this.started = false;
    this.markPendingUnavailable();
    this.removeContextListener();
    this.releaseQueries();
  }

  private removeContextListener(): void {
    if (!this.contextListenerAttached || this.gl === null) return;
    this.gl.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.contextListenerAttached = false;
  }

  private releaseQueries(): void {
    const gl = this.gl;
    if (gl !== null) {
      for (const query of this.queries) {
        if (query === null) continue;
        try {
          gl.deleteQuery(query);
        } catch {
          // A lost context releases its query objects.
        }
      }
    }
    this.queries = [];
    this.queryStates = new Uint8Array(0);
    this.queryPhases = new Uint8Array(0);
    this.queryFrames = new Float64Array(0);
    this.queryStartTimes = new Float64Array(0);
    this.extension = null;
  }
}

function isWebGL2(gl: WebGLRenderingContext | WebGL2RenderingContext | null): gl is WebGL2RenderingContext {
  return gl !== null && typeof (gl as WebGL2RenderingContext).createQuery === 'function';
}
