import {
  assetHttpUrl,
  fetchRuntimeAssetBlob,
  fetchRuntimeAssetJson,
  fetchRuntimeAssetText,
} from './core/runtimeAssetClient';
import { isExternalAssetUrl } from './path';
import { touchAsset, touchPack } from './coordinator';

export interface PackAssetResolver {
  resolveAssetUrl: (assetPath: string) => Promise<string>;
  resolveHttpUrl: (assetPath: string) => string;
  fetchBlob: (assetPath: string) => Promise<Blob>;
  fetchText: (assetPath: string) => Promise<string>;
  fetchJson: <T>(assetPath: string) => Promise<T>;
}

export interface PackAssetResolverOptions {
  packId?: string;
  packRoot?: string;
}

function joinPackPath(packRoot: string | undefined, assetPath: string): string {
  if (!assetPath || isExternalAssetUrl(assetPath) || assetPath.startsWith('/cdn-assets/')) {
    return assetPath;
  }

  const normalizedRoot = packRoot?.replace(/^\/+|\/+$/g, '');
  const normalizedPath = assetPath.replace(/^\/+/, '');
  if (!normalizedRoot) {
    return normalizedPath;
  }

  return `${normalizedRoot}/${normalizedPath}`.replace(/\/{2,}/g, '/');
}

export function createPackAssetResolver(
  options: PackAssetResolverOptions = {},
): PackAssetResolver {
  const resolvePath = (assetPath: string) => joinPackPath(options.packRoot, assetPath);
  const reportTouch = (resolvedPath: string) => {
    if (options.packId) {
      touchPack(options.packId);
    } else {
      touchAsset(resolvedPath);
    }
  };

  return {
    async resolveAssetUrl(assetPath: string): Promise<string> {
      const resolvedPath = resolvePath(assetPath);
      reportTouch(resolvedPath);
      return assetHttpUrl(resolvedPath);
    },

    resolveHttpUrl(assetPath: string): string {
      const resolvedPath = resolvePath(assetPath);
      reportTouch(resolvedPath);
      return assetHttpUrl(resolvedPath);
    },

    fetchBlob(assetPath: string): Promise<Blob> {
      const resolvedPath = resolvePath(assetPath);
      reportTouch(resolvedPath);
      return fetchRuntimeAssetBlob(resolvedPath);
    },

    fetchText(assetPath: string): Promise<string> {
      const resolvedPath = resolvePath(assetPath);
      reportTouch(resolvedPath);
      return fetchRuntimeAssetText(resolvedPath);
    },

    fetchJson<T>(assetPath: string): Promise<T> {
      const resolvedPath = resolvePath(assetPath);
      reportTouch(resolvedPath);
      return fetchRuntimeAssetJson<T>(resolvedPath);
    },
  };
}
