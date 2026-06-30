import { beforeEach, describe, expect, it, vi } from 'vitest';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import {
  preloadCoordinator,
  resetPreloadCoordinatorForTests,
  setPreloadCatalogForTests,
  setPreloadLifecycleState,
  touchAsset,
} from './coordinator';
import { createPreloadPackAssetResolver } from './assets';
import { defineAssetCatalog, type AssetCatalogDefinition } from './types';

function createCatalog(): AssetCatalogDefinition {
  return defineAssetCatalog({
    packs: [
      {
        packId: 'ui-core',
        label: 'UI Core',
        ownership: ['images/**'],
        schedulerPriority: 'critical',
        stages: ['startup-critical'],
        prefetch: ['images/logo.png'],
      },
      {
        packId: 'forest-level',
        label: 'Forest Level',
        ownership: ['levels/forest/**'],
        schedulerPriority: 'background',
        prefetch: ['levels/forest/index.json'],
        prepare: [{ path: 'levels/forest/data.json', kind: 'json', retain: true, scope: 'forest-stage' }],
        eagerOnFirstTouch: true,
      },
      {
        packId: 'ambient-idle',
        label: 'Ambient Idle',
        ownership: ['ambient/**'],
        schedulerPriority: 'idle',
        prefetch: ['ambient/loop.mp3'],
        idlePrefetch: true,
      },
    ],
    stages: [
      {
        stageId: 'startup-critical',
        label: 'Load startup assets',
        blocking: true,
        presenterMode: 'native',
        packIds: ['ui-core'],
      },
    ],
    exclude: [],
  });
}

describe('preloadCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPreloadCoordinatorForTests();
    setPreloadCatalogForTests(createCatalog());
    setPreloadLifecycleState('ready');
  });

  it('executes named stages and records pack progress', async () => {
    await preloadCoordinator.runStage('startup-critical', {
      presenterMode: 'native',
    });

    const snapshot = preloadCoordinator.getSnapshot();
    expect(snapshot.activeStageId).toBe('startup-critical');
    expect(snapshot.packStatus['ui-core']?.prefetched).toBeGreaterThan(0);
    expect(snapshot.blocking).toBe(false);
    expect(snapshot.presenter.visible).toBe(false);
  });

  it('promotes an eager pack on first asset touch', async () => {
    vi.mocked(RundotAPI.cdn.fetchAsset).mockImplementation(async (path: string) => {
      if (path.endsWith('.json')) {
        return new Blob(['{"ok":true}']);
      }

      return new Blob(['mock']);
    });

    touchAsset('/cdn-assets/levels/forest/tree.png');
    await new Promise((resolve) => setTimeout(resolve, 25));

    const snapshot = preloadCoordinator.getSnapshot();
    expect(snapshot.packStatus['forest-level']?.touched).toBe(true);
    expect(snapshot.packStatus['forest-level']?.prefetched).toBeGreaterThan(0);
    expect(snapshot.packStatus['forest-level']?.prepared).toBeGreaterThan(0);
  });

  it('does not touch an eager pack until a resolver actually resolves an asset', () => {
    const resolver = createPreloadPackAssetResolver({
      packId: 'forest-level',
      packRoot: 'levels/forest',
    });

    expect(preloadCoordinator.getSnapshot().packStatus['forest-level']?.touched).toBe(false);

    resolver.resolveHttpUrl('tree.png');

    expect(preloadCoordinator.getSnapshot().packStatus['forest-level']?.touched).toBe(true);
  });

  it('queues idle work and drains it when the lifecycle is playing', async () => {
    preloadCoordinator.hintPack('ambient-idle');
    expect(preloadCoordinator.getSnapshot().queuedIdlePackIds).toContain('ambient-idle');

    setPreloadLifecycleState('playing');
    await new Promise((resolve) => setTimeout(resolve, 80));

    const snapshot = preloadCoordinator.getSnapshot();
    expect(snapshot.queuedIdlePackIds).not.toContain('ambient-idle');
    expect(snapshot.packStatus['ambient-idle']?.prefetched).toBeGreaterThan(0);
  });

  it('hides blocking presenter state when the lifecycle pauses mid-load', async () => {
    let releaseFetch: (() => void) | undefined;
    vi.mocked(RundotAPI.cdn.fetchAsset).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFetch = () => resolve(new Blob(['mock']));
        }),
    );

    const runPromise = preloadCoordinator.runStage('startup-critical', {
      presenterMode: 'blocking',
    });
    await Promise.resolve();

    expect(preloadCoordinator.getSnapshot().presenter.visible).toBe(true);

    setPreloadLifecycleState('paused');
    expect(preloadCoordinator.getSnapshot().presenter.visible).toBe(false);

    releaseFetch?.();
    await runPromise;
  });
});
