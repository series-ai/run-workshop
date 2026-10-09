import { useEffect, useState } from 'react';
import {
  resolveAssetUrl,
  type AssetReference,
  type AssetKey,
  ASSET_REFS,
  INKLINE_PACKS,
} from './assetLibrary.js';

export function getLocalAssetUrl(reference: AssetReference): string {
  const pack = INKLINE_PACKS[reference.pack];
  return `/${pack.id}/${reference.path}`;
}

const localAvailabilityCache = new Map<string, boolean>();

function checkLocalAssetExists(localUrl: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (localAvailabilityCache.has(localUrl)) {
    return Promise.resolve(localAvailabilityCache.get(localUrl)!);
  }
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', localUrl, true);
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        localAvailabilityCache.set(localUrl, ok);
        resolve(ok);
      };
      xhr.onerror = () => {
        localAvailabilityCache.set(localUrl, false);
        resolve(false);
      };
      xhr.ontimeout = () => {
        localAvailabilityCache.set(localUrl, false);
        resolve(false);
      };
      xhr.timeout = 800;
      xhr.send();
    } catch {
      localAvailabilityCache.set(localUrl, false);
      resolve(false);
    }
  });
}

/**
 * Resolves an AssetReference or AssetKey to a local or CDN URL for rendering.
 * Implements local-first asset resolution checking if local path exists, falling back to CDN URLs.
 */
export function useAssetUrl(reference: AssetReference | AssetKey | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refObj: AssetReference | null =
    typeof reference === 'string' ? ASSET_REFS[reference as AssetKey] ?? null : reference;

  const key = refObj ? `${refObj.pack}:${refObj.path}` : '';

  useEffect(() => {
    if (!refObj || !key) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(null);

    const localUrl = getLocalAssetUrl(refObj);

    checkLocalAssetExists(localUrl).then((exists) => {
      if (cancelled) return;
      if (exists) {
        setUrl(localUrl);
      } else {
        // Fall back to CDN
        resolveAssetUrl(refObj)
          .then((resolved) => {
            if (!cancelled) setUrl(resolved);
          })
          .catch((cause) => {
            if (!cancelled) {
              // If CDN resolution fails, use localUrl as ultimate fallback in offline/dev
              setUrl(localUrl);
            }
          });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (error) throw error;
  return url;
}
