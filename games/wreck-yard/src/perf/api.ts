import identity from '../sim/identity.generated.json';
import { resetPerfInput } from './localInput';
import type { GpuTimer } from './gpuTimer.js';
import {
  perfRecorder,
  type PerfRecorder,
  type PerfReport,
  type PerfStartOptions,
  type PerfCaptureContext,
  type PerfViewport,
} from './recorder.js';

export interface PerfApi {
  isActive(): boolean;
  status(): PerfRecorder['status'];
  start(options?: PerfStartOptions): void;
  stop(): PerfReport;
  export(): PerfReport;
  clear(): void;
  dispose(): void;
}

declare global {
  interface Window {
    __WRECK_YARD_PERF__?: PerfApi;
  }
}

export function installPerfApi(
  target: Window,
  recorder: PerfRecorder = perfRecorder,
  gpuTimer?: GpuTimer,
): () => void {
  const previous = target.__WRECK_YARD_PERF__;
  let context: PerfCaptureContext | undefined;
  const viewport = (): PerfViewport => ({
    width: target.innerWidth, height: target.innerHeight,
    pixelRatio: target.devicePixelRatio, scale: target.visualViewport?.scale ?? 1,
  });
  const report = (): PerfReport => {
    const result = recorder.export();
    if (!context) return result;
    context.viewportAtExport ??= viewport();
    return { ...result, context };
  };
  const api: PerfApi = Object.freeze({
    isActive: () => recorder.isActive,
    status: () => recorder.status,
    start: (options = {}) => {
      resetPerfInput();
      recorder.start({ ...options, gpuTimer });
      context = {
        capturedAt: new Date().toISOString(),
        deterministicVersion: identity.runtimeIdentity.deterministicVersion,
        engineIdentityHash: identity.runtimeIdentity.engineIdentityHash,
        userAgent: target.navigator?.userAgent ?? '',
        hardwareConcurrency: target.navigator?.hardwareConcurrency ?? null,
        viewportAtStart: viewport(),
      };
    },
    stop: () => {
      recorder.stop();
      return report();
    },
    export: report,
    clear: () => { resetPerfInput(); recorder.clear(); context = undefined; },
    dispose: () => { recorder.dispose(); context = undefined; },
  });

  Object.defineProperty(target, '__WRECK_YARD_PERF__', {
    configurable: true,
    enumerable: false,
    value: api,
    writable: true,
  });

  return () => {
    if (target.__WRECK_YARD_PERF__ !== api) return;
    if (previous === undefined) {
      delete target.__WRECK_YARD_PERF__;
      return;
    }
    Object.defineProperty(target, '__WRECK_YARD_PERF__', {
      configurable: true,
      enumerable: false,
      value: previous,
      writable: true,
    });
  };
}
