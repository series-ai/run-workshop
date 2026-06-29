import RundotAPI from '@series-inc/rundot-game-sdk/api';
import {
  DEFAULT_PRELOAD_BUDGETS,
  inferPrepareAssetKind,
  type PrepareAssetKind,
  type PreparedAssetHandle,
  type PreloadPrepareRequest,
  type PreloadProgress,
} from '../types';
import {
  isExternalAssetUrl,
  normalizeAssetPath,
  toHttpAssetPath,
  toSdkAssetPath,
} from '../path';

const blobUrlCache = new Map<string, string>();
const pendingUrlFetches = new Map<string, Promise<string>>();
const pendingBlobFetches = new Map<string, Promise<Blob>>();
const retainedPreparedAssets = new Map<string, PreparedAssetHandle>();

function retainedKeyFor(handle: PreparedAssetHandle): string {
  return `${handle.scope ?? 'manual'}:${handle.kind}:${handle.path}`;
}

async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) {
    return [];
  }

  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      const task = tasks[taskIndex];
      if (!task) {
        return;
      }
      results[taskIndex] = await task();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  return results;
}

export async function fetchRuntimeAssetUrl(path: string): Promise<string> {
  if (!path) {
    return '';
  }

  if (isExternalAssetUrl(path)) {
    return path;
  }

  const normalized = toSdkAssetPath(path);
  if (!normalized) {
    return '';
  }

  const cached = blobUrlCache.get(normalized);
  if (cached) {
    return cached;
  }

  const pending = pendingUrlFetches.get(normalized);
  if (pending) {
    return pending;
  }

  const promise = (async (): Promise<string> => {
    try {
      const blob = await RundotAPI.cdn.fetchAsset(normalized);
      const objectUrl = URL.createObjectURL(blob);
      blobUrlCache.set(normalized, objectUrl);
      return objectUrl;
    } finally {
      pendingUrlFetches.delete(normalized);
    }
  })();

  pendingUrlFetches.set(normalized, promise);
  return promise;
}

export async function fetchRuntimeAssetBlob(path: string): Promise<Blob> {
  if (!path) {
    throw new Error('fetchRuntimeAssetBlob: empty path');
  }

  if (isExternalAssetUrl(path)) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch external asset: ${response.status}`);
    }
    return response.blob();
  }

  const normalized = toSdkAssetPath(path);
  const pending = pendingBlobFetches.get(normalized);
  if (pending) {
    return pending;
  }

  const promise = (async (): Promise<Blob> => {
    try {
      return await RundotAPI.cdn.fetchAsset(normalized);
    } finally {
      pendingBlobFetches.delete(normalized);
    }
  })();

  pendingBlobFetches.set(normalized, promise);
  return promise;
}

export async function fetchRuntimeAssetText(path: string): Promise<string> {
  const blob = await fetchRuntimeAssetBlob(path);
  return blob.text();
}

export async function fetchRuntimeAssetJson<T>(path: string): Promise<T> {
  return JSON.parse(await fetchRuntimeAssetText(path)) as T;
}

export async function fetchRuntimeAssetCsv(path: string): Promise<string[][]> {
  const text = await fetchRuntimeAssetText(path);
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

export async function prefetchRuntimeAssets(
  paths: string[],
  options?: {
    signal?: AbortSignal;
    concurrency?: number;
    onProgress?: (info: PreloadProgress) => void;
  },
): Promise<PreloadProgress> {
  const progress: PreloadProgress = {
    loaded: 0,
    failed: 0,
    total: paths.length,
    currentPath: null,
  };

  if (paths.length === 0) {
    return progress;
  }

  const concurrency = options?.concurrency ?? DEFAULT_PRELOAD_BUDGETS.fetchConcurrency;
  const tasks = paths.map((path) => async () => {
    if (options?.signal?.aborted) {
      return;
    }

    try {
      await fetchRuntimeAssetUrl(path);
      if (!options?.signal?.aborted) {
        progress.loaded += 1;
      }
    } catch {
      if (!options?.signal?.aborted) {
        progress.failed += 1;
      }
    }

    progress.currentPath = path;
    options?.onProgress?.({ ...progress });
  });

  await runWithConcurrencyLimit(tasks, concurrency);
  progress.currentPath = null;
  return progress;
}

async function prepareImageAsset(path: string): Promise<PreparedAssetHandle<unknown>> {
  const url = await fetchRuntimeAssetUrl(path);

  if (typeof Image === 'undefined') {
    return {
      kind: 'image',
      path,
      value: { url },
      release: () => undefined,
    };
  }

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to decode image: ${path}`));
    image.src = url;
  });

  return {
    kind: 'image',
    path,
    value: image,
    release: () => {
      image.src = '';
    },
  };
}

async function prepareAudioAsset(path: string): Promise<PreparedAssetHandle<unknown>> {
  const url = await fetchRuntimeAssetUrl(path);

  if (typeof Audio === 'undefined') {
    return {
      kind: 'audio',
      path,
      value: { url },
      release: () => undefined,
    };
  }

  const audio = new Audio(url);
  audio.preload = 'auto';

  return {
    kind: 'audio',
    path,
    value: audio,
    release: () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}

export async function prepareRuntimeAsset(
  request: PreloadPrepareRequest,
): Promise<PreparedAssetHandle> {
  const kind = request.kind ?? inferPrepareAssetKind(request.path);
  let handle: PreparedAssetHandle;

  switch (kind) {
    case 'text':
      handle = {
        kind,
        path: request.path,
        scope: request.scope,
        value: await fetchRuntimeAssetText(request.path),
        release: () => undefined,
      };
      break;
    case 'json':
      handle = {
        kind,
        path: request.path,
        scope: request.scope,
        value: await fetchRuntimeAssetJson(request.path),
        release: () => undefined,
      };
      break;
    case 'csv':
      handle = {
        kind,
        path: request.path,
        scope: request.scope,
        value: await fetchRuntimeAssetCsv(request.path),
        release: () => undefined,
      };
      break;
    case 'image':
      handle = await prepareImageAsset(request.path);
      handle = { ...handle, scope: request.scope };
      break;
    case 'audio':
      handle = await prepareAudioAsset(request.path);
      handle = { ...handle, scope: request.scope };
      break;
    case 'gltf':
      handle = {
        kind,
        path: request.path,
        scope: request.scope,
        value: toHttpAssetPath(request.path),
        release: () => undefined,
      };
      break;
    case 'blob':
    default:
      handle = {
        kind: kind === 'blob' ? kind : 'blob',
        path: request.path,
        scope: request.scope,
        value: await fetchRuntimeAssetBlob(request.path),
        release: () => undefined,
      };
      break;
  }

  if (request.retain || request.scope) {
    retainedPreparedAssets.set(retainedKeyFor(handle), handle);
  }

  return handle;
}

export function releasePreparedRuntimeAsset(handleOrScope: PreparedAssetHandle | string): void {
  if (typeof handleOrScope === 'string') {
    for (const [key, handle] of retainedPreparedAssets.entries()) {
      if (handle.scope === handleOrScope) {
        handle.release();
        retainedPreparedAssets.delete(key);
      }
    }
    return;
  }

  handleOrScope.release();
  retainedPreparedAssets.delete(retainedKeyFor(handleOrScope));
}

export function isRuntimeAssetCached(path: string): boolean {
  const normalized = toSdkAssetPath(path);
  return Boolean(normalized && blobUrlCache.has(normalized));
}

export function getRuntimeAssetCacheStats(): { size: number; paths: string[] } {
  return {
    size: blobUrlCache.size,
    paths: Array.from(blobUrlCache.keys()),
  };
}

export function clearRuntimeAssetCaches(): void {
  for (const objectUrl of blobUrlCache.values()) {
    URL.revokeObjectURL(objectUrl);
  }

  for (const handle of retainedPreparedAssets.values()) {
    handle.release();
  }

  blobUrlCache.clear();
  pendingUrlFetches.clear();
  pendingBlobFetches.clear();
  retainedPreparedAssets.clear();
}

export function assetHttpUrl(path: string): string {
  return toHttpAssetPath(path);
}

export function _resetRuntimeAssetClientForTests(): void {
  blobUrlCache.clear();
  pendingUrlFetches.clear();
  pendingBlobFetches.clear();
  retainedPreparedAssets.clear();
}

export function normalizeRuntimeAssetPath(path: string): string {
  return normalizeAssetPath(path);
}

export type RuntimeAssetPrepareRequest = PreloadPrepareRequest;
export type RuntimeAssetPreparedHandle<T = unknown> = PreparedAssetHandle<T>;
export type RuntimeAssetPrepareKind = PrepareAssetKind;
