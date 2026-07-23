/**
 * Memory monitor — wraps URL.createObjectURL / URL.revokeObjectURL to keep a
 * running tally of live blob bytes, and reads performance.memory when the
 * browser exposes it (Chromium-based). Provides a React hook that re-renders
 * subscribers on each poll tick.
 *
 * Wrapping happens once at module load. It's idempotent: if module reloads in
 * dev (HMR), we detect our marker and skip rewrapping.
 */
import { useEffect, useState } from 'react';

interface BlobMemSnapshot {
  count: number;
  bytes: number;
}

interface JsHeapSnapshot {
  used: number;
  total: number;
  limit: number;
}

export interface MemorySnapshot {
  blob: BlobMemSnapshot;
  jsHeap: JsHeapSnapshot | null;
}

const blobBytes = new Map<string, number>();
let totalBlobBytes = 0;

const WRAPPED_MARKER = '__layoutManagerMemoryMonitorWrapped';

interface WrappableURL {
  [WRAPPED_MARKER]?: boolean;
}

if (typeof URL !== 'undefined' && !(URL as unknown as WrappableURL)[WRAPPED_MARKER]) {
  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);

  URL.createObjectURL = function (obj: Blob | MediaSource): string {
    const url = origCreate(obj);
    if (obj instanceof Blob) {
      blobBytes.set(url, obj.size);
      totalBlobBytes += obj.size;
    }
    return url;
  };

  URL.revokeObjectURL = function (url: string): void {
    const size = blobBytes.get(url);
    if (size !== undefined) {
      blobBytes.delete(url);
      totalBlobBytes -= size;
    }
    origRevoke(url);
  };

  (URL as unknown as WrappableURL)[WRAPPED_MARKER] = true;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function readJsHeap(): JsHeapSnapshot | null {
  const mem = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!mem) return null;
  return { used: mem.usedJSHeapSize, total: mem.totalJSHeapSize, limit: mem.jsHeapSizeLimit };
}

export function getMemorySnapshot(): MemorySnapshot {
  return {
    blob: { count: blobBytes.size, bytes: totalBlobBytes },
    jsHeap: readJsHeap(),
  };
}

/** Subscribe to a 1Hz polling tick. Returns the latest MemorySnapshot. */
export function useMemorySnapshot(intervalMs = 1000): MemorySnapshot {
  const [snap, setSnap] = useState<MemorySnapshot>(() => getMemorySnapshot());
  useEffect(() => {
    const tick = () => setSnap(getMemorySnapshot());
    const id = window.setInterval(tick, intervalMs);
    tick();
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return snap;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
