import { useEffect, useMemo, useState } from 'react';
import {
  assetHttpUrl as resolveRuntimeAssetHttpUrl,
  clearRuntimeAssetCaches,
  fetchRuntimeAssetBlob,
  fetchRuntimeAssetCsv,
  fetchRuntimeAssetJson,
  fetchRuntimeAssetText,
  fetchRuntimeAssetUrl,
  getRuntimeAssetCacheStats,
  isRuntimeAssetCached,
  prefetchRuntimeAssets,
  prepareRuntimeAsset,
  releasePreparedRuntimeAsset,
  type RuntimeAssetPrepareRequest,
  type RuntimeAssetPreparedHandle,
} from './core/runtimeAssetClient';
import { createPackAssetResolver, type PackAssetResolver, type PackAssetResolverOptions } from './packAssetResolver';
import { touchAsset, touchPack } from './coordinator';
import type { PreloadProgress } from './types';

export interface AssetRequestOptions {
  touch?: boolean;
}

function requestOptionsForTouch(
  touch: AssetRequestOptions['touch'],
): AssetRequestOptions | undefined {
  return touch === undefined ? undefined : { touch };
}

function shouldTouch(options?: AssetRequestOptions): boolean {
  return options?.touch !== false;
}

function reportAssetTouch(path: string, options?: AssetRequestOptions): void {
  if (shouldTouch(options)) {
    touchAsset(path);
  }
}

export function assetHttpUrl(path: string, options?: AssetRequestOptions): string {
  reportAssetTouch(path, options);
  return resolveRuntimeAssetHttpUrl(path);
}

export async function assetUrl(path: string, options?: AssetRequestOptions): Promise<string> {
  reportAssetTouch(path, options);
  return fetchRuntimeAssetUrl(path);
}

export async function assetBlob(path: string, options?: AssetRequestOptions): Promise<Blob> {
  reportAssetTouch(path, options);
  return fetchRuntimeAssetBlob(path);
}

export async function assetText(path: string, options?: AssetRequestOptions): Promise<string> {
  reportAssetTouch(path, options);
  return fetchRuntimeAssetText(path);
}

export async function assetJson<T>(path: string, options?: AssetRequestOptions): Promise<T> {
  reportAssetTouch(path, options);
  return fetchRuntimeAssetJson<T>(path);
}

export async function assetCsv(path: string, options?: AssetRequestOptions): Promise<string[][]> {
  reportAssetTouch(path, options);
  return fetchRuntimeAssetCsv(path);
}

export async function prefetchAssets(
  paths: string[],
  options?: AssetRequestOptions & {
    signal?: AbortSignal;
    onProgress?: (info: PreloadProgress) => void;
  },
) {
  if (shouldTouch(options)) {
    paths.forEach((path) => touchAsset(path));
  }

  return prefetchRuntimeAssets(paths, {
    signal: options?.signal,
    onProgress: options?.onProgress,
  });
}

export async function prepareAsset(
  request: RuntimeAssetPrepareRequest & AssetRequestOptions,
): Promise<RuntimeAssetPreparedHandle> {
  reportAssetTouch(request.path, request);
  return prepareRuntimeAsset(request);
}

export function releaseAsset(handleOrScope: string | RuntimeAssetPreparedHandle): void {
  releasePreparedRuntimeAsset(handleOrScope);
}

export function useAssetUrl(path?: string | null, options?: AssetRequestOptions): string | null {
  const normalized = useMemo(() => path ?? '', [path]);
  const touch = options?.touch;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!normalized) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    void assetUrl(normalized, requestOptionsForTouch(touch))
      .then((resolved) => {
        if (!cancelled) {
          setUrl(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalized, touch]);

  return url;
}

export function useAssetUrls(
  paths: Array<string | null | undefined>,
  options?: AssetRequestOptions,
): Array<string | null> {
  const normalized = useMemo(
    () => paths.map((path) => path ?? ''),
    [paths],
  );
  const touch = options?.touch;
  const [urls, setUrls] = useState<Array<string | null>>(() => normalized.map(() => null));

  useEffect(() => {
    let cancelled = false;
    const requestOptions = requestOptionsForTouch(touch);

    void Promise.all(normalized.map((path) => (path ? assetUrl(path, requestOptions) : Promise.resolve(null))))
      .then((resolved) => {
        if (!cancelled) {
          setUrls(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrls(normalized.map(() => null));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalized, touch]);

  return urls;
}

export function createPreloadPackAssetResolver(
  options?: PackAssetResolverOptions,
): PackAssetResolver {
  return createPackAssetResolver(options);
}

export {
  clearRuntimeAssetCaches,
  createPackAssetResolver,
  getRuntimeAssetCacheStats,
  isRuntimeAssetCached,
  touchAsset,
  touchPack,
};
