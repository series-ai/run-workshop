import { resetPerfInput } from './localInput';
import type { GpuTimer } from './gpuTimer.js';
import {
  perfRecorder,
  type PerfRecorder,
  type PerfReport,
  type PerfStartOptions,
} from './recorder.js';

export interface PerfApi {
  isActive(): boolean;
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
  const api: PerfApi = Object.freeze({
    isActive: () => recorder.isActive,
    start: (options = {}) => { resetPerfInput(); recorder.start({ ...options, gpuTimer }); },
    stop: () => {
      recorder.stop();
      return recorder.export();
    },
    export: () => recorder.export(),
    clear: () => { resetPerfInput(); recorder.clear(); },
    dispose: () => recorder.dispose(),
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
