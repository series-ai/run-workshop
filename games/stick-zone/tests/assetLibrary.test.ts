import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAssetLibraryCacheForTests,
  INKLINE_PACKS,
  resolveAssetUrl,
  ASSET_REFS,
} from '../src/assetLibrary.js';

const sdk = vi.hoisted(() => ({
  initializeAsync: vi.fn(),
  getPackBaseUrl: vi.fn(),
}));

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    initializeAsync: sdk.initializeAsync,
    get assetLibrary() {
      return { getPackBaseUrl: sdk.getPackBaseUrl };
    },
  },
}));

beforeEach(() => {
  clearAssetLibraryCacheForTests();
  sdk.initializeAsync.mockReset().mockResolvedValue(undefined);
  sdk.getPackBaseUrl.mockReset().mockResolvedValue('https://storage.googleapis.com/run-asset-library/packs/characters/');
});

describe('INKLINE_PACKS', () => {
  it('pins the four run-inkline packs with authoritative hashes', () => {
    expect(INKLINE_PACKS).toEqual({
      characters: { id: 'run-inkline/3D/characters', version: '4548550a5cf6' },
      scifi: { id: 'run-inkline/3D/space-scifi', version: 'b3e7a8122565' },
      city: { id: 'run-inkline/3D/city', version: '48f4942c1ceb' },
      weapons: { id: 'run-inkline/3D/weapons', version: '75cd4d2eef61' },
    });
  });

  it('contains expected pinned semantic asset references', () => {
    expect(ASSET_REFS.playerStickman).toEqual({ pack: 'characters', path: 'stick-agent.glb' });
    expect(ASSET_REFS.turretAutomated).toEqual({ pack: 'scifi', path: 'turret-automated.glb' });
    expect(ASSET_REFS.cargoContainer).toEqual({ pack: 'city', path: 'cargo-container.glb' });
    expect(ASSET_REFS.rifle).toEqual({ pack: 'weapons', path: 'rifle.glb' });
  });
});

describe('resolveAssetUrl', () => {
  it('initializes the SDK and resolves base URL via RundotGameAPI.assetLibrary', async () => {
    const order: string[] = [];
    sdk.initializeAsync.mockImplementation(async () => {
      order.push('initialize');
    });
    sdk.getPackBaseUrl.mockImplementation(async () => {
      order.push('resolve');
      return 'https://storage.googleapis.com/run-asset-library/packs/run-inkline/3D/characters@4548550a5cf6';
    });

    await expect(resolveAssetUrl({ pack: 'characters', path: 'stick-agent.glb' }))
      .resolves.toBe('https://storage.googleapis.com/run-asset-library/packs/run-inkline/3D/characters@4548550a5cf6/stick-agent.glb');
    expect(order).toEqual(['initialize', 'resolve']);
    expect(sdk.getPackBaseUrl).toHaveBeenCalledWith(
      'run-inkline/3D/characters',
      '4548550a5cf6',
    );
  });

  it('reuses cached base URL promise across multiple assets in same pack', async () => {
    await Promise.all([
      resolveAssetUrl({ pack: 'characters', path: 'stick-agent.glb' }),
      resolveAssetUrl({ pack: 'characters', path: 'stick-runner.glb' }),
    ]);
    expect(sdk.initializeAsync).toHaveBeenCalledTimes(1);
    expect(sdk.getPackBaseUrl).toHaveBeenCalledTimes(1);
  });

  it('evicts rejected base URL so future calls can retry', async () => {
    sdk.getPackBaseUrl
      .mockRejectedValueOnce(new Error('CDN unreachable'))
      .mockResolvedValueOnce('https://storage.googleapis.com/run-asset-library/packs/characters');

    await expect(resolveAssetUrl({ pack: 'characters', path: 'stick-agent.glb' }))
      .rejects.toThrow('CDN unreachable');
    await expect(resolveAssetUrl({ pack: 'characters', path: 'stick-agent.glb' }))
      .resolves.toBe('https://storage.googleapis.com/run-asset-library/packs/characters/stick-agent.glb');
    expect(sdk.getPackBaseUrl).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty base URL returned by asset library', async () => {
    sdk.getPackBaseUrl.mockResolvedValue('');
    await expect(resolveAssetUrl({ pack: 'characters', path: 'stick-agent.glb' }))
      .rejects.toThrow('Asset library returned an empty pack URL');
  });
});
