import { beforeEach, describe, expect, it, vi } from 'vitest';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import {
  _resetRuntimeAssetClientForTests,
  assetHttpUrl,
  clearRuntimeAssetCaches,
  fetchRuntimeAssetBlob,
  fetchRuntimeAssetCsv,
  fetchRuntimeAssetJson,
  fetchRuntimeAssetUrl,
  getRuntimeAssetCacheStats,
  isRuntimeAssetCached,
  prepareRuntimeAsset,
  prefetchRuntimeAssets,
  releasePreparedRuntimeAsset,
} from './runtimeAssetClient';

describe('runtimeAssetClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRuntimeAssetClientForTests();
  });

  it('normalizes /cdn-assets paths for SDK fetches and caches blob URLs', async () => {
    const first = await fetchRuntimeAssetUrl('/cdn-assets/images/logo.png');
    const second = await fetchRuntimeAssetUrl('images/logo.png');

    expect(first).toBe(second);
    expect(vi.mocked(RundotAPI.cdn.fetchAsset)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(RundotAPI.cdn.fetchAsset)).toHaveBeenCalledWith('images/logo.png');
    expect(isRuntimeAssetCached('images/logo.png')).toBe(true);
  });

  it('supports text, json, csv, and blob reads', async () => {
    vi.mocked(RundotAPI.cdn.fetchAsset)
      .mockResolvedValueOnce(new Blob(['{"coins":42}']))
      .mockResolvedValueOnce(new Blob(['name,cost\napple,3']))
      .mockResolvedValueOnce(new Blob(['binary']));

    await expect(fetchRuntimeAssetJson<{ coins: number }>('data/shop.json')).resolves.toEqual({ coins: 42 });
    await expect(fetchRuntimeAssetCsv('data/shop.csv')).resolves.toEqual([
      ['name', 'cost'],
      ['apple', '3'],
    ]);
    await expect(fetchRuntimeAssetBlob('models/tree.glb')).resolves.toBeInstanceOf(Blob);
  });

  it('reports prefetch progress and returns stable http urls', async () => {
    const progress: Array<{ loaded: number; total: number }> = [];

    const result = await prefetchRuntimeAssets(['images/a.png', 'images/b.png'], {
      onProgress: (info) => progress.push({ loaded: info.loaded, total: info.total }),
    });

    expect(result.loaded).toBe(2);
    expect(progress).toEqual([
      { loaded: 1, total: 2 },
      { loaded: 2, total: 2 },
    ]);
    expect(assetHttpUrl('images/a.png')).toBe('/cdn-assets/images/a.png');
    expect(assetHttpUrl('/cdn-assets/images/a.png')).toBe('/cdn-assets/images/a.png');
  });

  it('retains prepared assets by scope and releases them explicitly', async () => {
    vi.mocked(RundotAPI.cdn.fetchAsset).mockResolvedValue(new Blob(['{"ready":true}']));

    const handle = await prepareRuntimeAsset({
      path: 'data/level.json',
      kind: 'json',
      scope: 'stage:forest',
      retain: true,
    });

    expect(handle.value).toEqual({ ready: true });
    releasePreparedRuntimeAsset('stage:forest');
    clearRuntimeAssetCaches();

    expect(getRuntimeAssetCacheStats().size).toBe(0);
  });
});
