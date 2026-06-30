import { useSyncExternalStore } from 'react';
import { lifecycle } from '@/services/lifecycle';
import { assetCatalog as defaultAssetCatalog } from '@/content-assets/assetCatalog';
import {
  DEFAULT_PRELOAD_BUDGETS,
  normalizePrepareRequest,
  type AssetCatalogDefinition,
  type PreloadPackConfig,
  type PreloadPackStatus,
  type PreloadPresenterMode,
  type PreloadPresenterState,
  type PreloadPrepareRequest,
  type PreloadSnapshot,
} from './types';
import { matchesAnyGlob } from './matchers';
import {
  prefetchRuntimeAssets,
  prepareRuntimeAsset,
  releasePreparedRuntimeAsset,
} from './core/runtimeAssetClient';

type Listener = () => void;

function createPackStatusMap(catalog: AssetCatalogDefinition): Record<string, PreloadPackStatus> {
  return Object.fromEntries(
    catalog.packs.map((pack) => {
      const total = new Set([
        ...(pack.prefetch ?? []),
        ...(pack.prepare ?? []).map((entry) => normalizePrepareRequest(entry).path),
      ]).size;

      return [
        pack.packId,
        {
          packId: pack.packId,
          status: 'none',
          prefetched: 0,
          prepared: 0,
          total,
          touched: false,
        } satisfies PreloadPackStatus,
      ];
    }),
  );
}

function createInitialSnapshot(catalog: AssetCatalogDefinition): PreloadSnapshot {
  return {
    activeStageId: null,
    activePackIds: [],
    blocking: false,
    lifecycleState: 'initializing',
    queuedIdlePackIds: [],
    presenter: {
      visible: false,
      mode: null,
      stageId: null,
      message: null,
      loaded: 0,
      failed: 0,
      total: 0,
      currentPath: null,
    },
    packStatus: createPackStatusMap(catalog),
  };
}

function withUpdatedPackStatus(
  snapshot: PreloadSnapshot,
  packId: string,
  next: Partial<PreloadPackStatus>,
): Record<string, PreloadPackStatus> {
  const current = snapshot.packStatus[packId];
  if (!current) {
    return snapshot.packStatus;
  }

  const updated: PreloadPackStatus = {
    ...current,
    ...next,
  };

  if (updated.prepared > 0) {
    updated.status = 'prepared';
  } else if (updated.prefetched > 0) {
    updated.status = 'prefetched';
  }

  return {
    ...snapshot.packStatus,
    [packId]: updated,
  };
}

export interface RunStageOptions {
  presenterMode?: PreloadPresenterMode;
  onProgress?: (state: PreloadPresenterState) => void;
}

class PreloadCoordinator {
  private catalog: AssetCatalogDefinition = defaultAssetCatalog;
  private snapshot: PreloadSnapshot = createInitialSnapshot(this.catalog);
  private readonly listeners = new Set<Listener>();
  private lifecycleAttached = false;
  private idleTimer: number | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PreloadSnapshot => this.snapshot;

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  private setSnapshot(next: PreloadSnapshot): void {
    this.snapshot = next;
    this.notify();
  }

  private updatePresenter(
    partial: Partial<PreloadPresenterState>,
    onProgress?: (state: PreloadPresenterState) => void,
  ): void {
    const presenter = {
      ...this.snapshot.presenter,
      ...partial,
    };

    this.setSnapshot({
      ...this.snapshot,
      presenter,
    });
    onProgress?.(presenter);
  }

  setCatalog(catalog: AssetCatalogDefinition): void {
    this.catalog = catalog;
    this.setSnapshot(createInitialSnapshot(catalog));
  }

  reset(): void {
    if (this.idleTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.idleTimer);
    }
    this.idleTimer = null;
    this.catalog = defaultAssetCatalog;
    this.lifecycleAttached = false;
    this.setSnapshot(createInitialSnapshot(this.catalog));
  }

  attachLifecycle(): void {
    if (this.lifecycleAttached) {
      return;
    }

    this.lifecycleAttached = true;
    lifecycle.register({
      onAwake: () => this.setLifecycleState('playing'),
      onSleep: () => this.setLifecycleState('hidden'),
      onPause: () => this.setLifecycleState('paused'),
      onResume: () => this.setLifecycleState('playing'),
    });
    this.setLifecycleState(lifecycle.getState());
  }

  setLifecycleState(state: PreloadSnapshot['lifecycleState']): void {
    if (state === this.snapshot.lifecycleState) {
      return;
    }

    const shouldHidePresenter = state === 'paused' || state === 'hidden';
    this.setSnapshot({
      ...this.snapshot,
      lifecycleState: state,
      blocking: shouldHidePresenter ? false : this.snapshot.blocking,
      presenter: shouldHidePresenter
        ? {
            ...this.snapshot.presenter,
            visible: false,
            mode: null,
          }
        : this.snapshot.presenter,
    });

    if (state === 'playing' || state === 'ready') {
      this.scheduleIdleDrain();
    } else {
      this.cancelIdleDrain();
    }
  }

  private cancelIdleDrain(): void {
    if (this.idleTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdleDrain(): void {
    if (
      this.idleTimer !== null
      || this.snapshot.blocking
      || this.snapshot.queuedIdlePackIds.length === 0
      || (this.snapshot.lifecycleState !== 'playing' && this.snapshot.lifecycleState !== 'ready')
      || typeof window === 'undefined'
    ) {
      return;
    }

    this.idleTimer = window.setTimeout(async () => {
      this.idleTimer = null;
      const [nextPackId, ...remaining] = this.snapshot.queuedIdlePackIds;
      if (!nextPackId) {
        return;
      }

      this.setSnapshot({
        ...this.snapshot,
        queuedIdlePackIds: remaining,
      });
      await this.runPack(nextPackId, {
        presenterMode: 'background',
      });
      this.scheduleIdleDrain();
    }, 50);
  }

  private findPackByPath(path: string): PreloadPackConfig | undefined {
    return this.catalog.packs.find((pack) => matchesAnyGlob(path, pack.ownership));
  }

  private getStagePackIds(stageId: string): string[] {
    const stage = this.catalog.stages?.find((entry) => entry.stageId === stageId);
    const declared = stage?.packIds ?? [];
    const inferred = this.catalog.packs
      .filter((pack) => pack.stages?.includes(stageId))
      .map((pack) => pack.packId);

    return Array.from(new Set([...declared, ...inferred]));
  }

  private getPack(packId: string): PreloadPackConfig | undefined {
    return this.catalog.packs.find((pack) => pack.packId === packId);
  }

  private markPackTouched(packId: string): void {
    const current = this.snapshot.packStatus[packId];
    if (!current || current.touched) {
      return;
    }

    this.setSnapshot({
      ...this.snapshot,
      packStatus: withUpdatedPackStatus(this.snapshot, packId, { touched: true }),
    });
  }

  touchAsset(path: string): void {
    const pack = this.findPackByPath(path);
    if (!pack) {
      return;
    }

    this.touchPack(pack.packId);
  }

  touchPack(packId: string): void {
    const pack = this.getPack(packId);
    if (!pack) {
      return;
    }

    const wasTouched = this.snapshot.packStatus[packId]?.touched;
    this.markPackTouched(packId);
    if (wasTouched || !pack.eagerOnFirstTouch) {
      return;
    }

    this.cancelIdleDrain();
    void this.runPack(packId, {
      presenterMode: pack.schedulerPriority === 'critical' || pack.schedulerPriority === 'blocking'
        ? 'blocking'
        : 'background',
    });
  }

  hintPack(packId: string): void {
    const pack = this.getPack(packId);
    if (!pack) {
      return;
    }

    if (pack.schedulerPriority === 'idle') {
      const queuedIdlePackIds = Array.from(new Set([...this.snapshot.queuedIdlePackIds, packId]));
      this.setSnapshot({
        ...this.snapshot,
        queuedIdlePackIds,
      });
      this.scheduleIdleDrain();
      return;
    }

    void this.runPack(packId, { presenterMode: 'background' });
  }

  hintStage(stageId: string): void {
    for (const packId of this.getStagePackIds(stageId)) {
      this.hintPack(packId);
    }
  }

  private async runPrepareRequests(
    requests: PreloadPrepareRequest[],
    progressState: PreloadPresenterState,
    onProgress?: (state: PreloadPresenterState) => void,
  ): Promise<void> {
    const heavyKinds = new Set(['audio', 'gltf']);
    const heavyRequests = requests.filter((request) => heavyKinds.has(request.kind ?? 'blob'));
    const lightRequests = requests.filter((request) => !heavyKinds.has(request.kind ?? 'blob'));

    const executeRequests = async (
      items: PreloadPrepareRequest[],
      concurrency: number,
    ): Promise<void> => {
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < items.length) {
          const itemIndex = nextIndex;
          nextIndex += 1;
          const item = items[itemIndex];
          if (!item) {
            return;
          }

          try {
            await prepareRuntimeAsset(item);
            progressState.loaded += 1;
          } catch {
            progressState.failed += 1;
          }

          progressState.currentPath = item.path;
          this.updatePresenter({ ...progressState }, onProgress);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
      );
    };

    await executeRequests(heavyRequests, DEFAULT_PRELOAD_BUDGETS.heavyPrepareConcurrency);
    await executeRequests(lightRequests, DEFAULT_PRELOAD_BUDGETS.lightPrepareConcurrency);
  }

  private updatePackProgress(packIds: string[], mode: 'prefetch' | 'prepare'): void {
    let snapshot = this.snapshot;
    for (const packId of packIds) {
      const current = snapshot.packStatus[packId];
      if (!current) {
        continue;
      }

      const nextValue = mode === 'prefetch'
        ? { prefetched: current.prefetched + 1 }
        : { prepared: current.prepared + 1 };
      snapshot = {
        ...snapshot,
        packStatus: withUpdatedPackStatus(snapshot, packId, nextValue),
      };
    }

    this.setSnapshot(snapshot);
  }

  private packIdsForPath(path: string, restrictToPackIds: string[]): string[] {
    return restrictToPackIds.filter((packId) => {
      const pack = this.getPack(packId);
      return Boolean(pack && matchesAnyGlob(path, pack.ownership));
    });
  }

  async runStage(stageId: string, options: RunStageOptions = {}): Promise<void> {
    const stage = this.catalog.stages?.find((entry) => entry.stageId === stageId);
    if (!stage) {
      return;
    }

    const packIds = this.getStagePackIds(stageId);
    const packs = packIds
      .map((packId) => this.getPack(packId))
      .filter((pack): pack is PreloadPackConfig => Boolean(pack));

    const prefetchPaths = Array.from(
      new Set([
        ...(stage.prefetch ?? []),
        ...packs.flatMap((pack) => pack.prefetch ?? []),
      ]),
    );
    const prepareRequests = [
      ...(stage.prepare ?? []),
      ...packs.flatMap((pack) => pack.prepare ?? []),
    ].map((entry) => normalizePrepareRequest(entry));
    const total = prefetchPaths.length + prepareRequests.length;
    const presenterMode = options.presenterMode ?? stage.presenterMode ?? (stage.blocking ? 'blocking' : 'background');

    this.setSnapshot({
      ...this.snapshot,
      activeStageId: stageId,
      activePackIds: packIds,
      blocking: Boolean(stage.blocking && presenterMode !== 'background'),
    });
    this.updatePresenter(
      {
        visible: presenterMode !== 'background',
        mode: presenterMode,
        stageId,
        message: stage.label,
        loaded: 0,
        failed: 0,
        total,
        currentPath: null,
      },
      options.onProgress,
    );

    if (prefetchPaths.length > 0) {
      await prefetchRuntimeAssets(prefetchPaths, {
        onProgress: (progress) => {
          const packIdsForCurrentPath = progress.currentPath
            ? this.packIdsForPath(progress.currentPath, packIds)
            : [];
          if (progress.currentPath) {
            this.updatePackProgress(packIdsForCurrentPath, 'prefetch');
          }
          this.updatePresenter(
            {
              ...this.snapshot.presenter,
              loaded: progress.loaded,
              failed: progress.failed,
              total,
              currentPath: progress.currentPath,
            },
            options.onProgress,
          );
        },
      });
    }

    if (prepareRequests.length > 0) {
      const progressState: PreloadPresenterState = {
        ...this.snapshot.presenter,
        loaded: prefetchPaths.length,
        failed: 0,
        total,
      };

      await this.runPrepareRequests(
        prepareRequests,
        progressState,
        (state) => {
          if (state.currentPath) {
            this.updatePackProgress(
              this.packIdsForPath(state.currentPath, packIds),
              'prepare',
            );
          }
          options.onProgress?.(state);
        },
      );
    }

    this.updatePresenter(
      {
        ...this.snapshot.presenter,
        loaded: total,
        currentPath: null,
        visible: presenterMode === 'background',
        mode: presenterMode === 'background' ? presenterMode : null,
      },
      options.onProgress,
    );

    this.setSnapshot({
      ...this.snapshot,
      blocking: false,
      presenter: this.snapshot.presenter,
    });
    this.scheduleIdleDrain();
  }

  async runPack(
    packId: string,
    options: Pick<RunStageOptions, 'presenterMode'> = {},
  ): Promise<void> {
    const pack = this.getPack(packId);
    if (!pack) {
      return;
    }

    const stageId = `pack:${packId}`;
    const stageCatalog: AssetCatalogDefinition = {
      ...this.catalog,
      stages: [
        ...(this.catalog.stages ?? []),
        {
          stageId,
          label: pack.label,
          presenterMode: options.presenterMode ?? 'background',
          blocking: options.presenterMode === 'blocking',
          packIds: [packId],
        },
      ],
    };

    const previousCatalog = this.catalog;
    this.catalog = stageCatalog;
    try {
      await this.runStage(stageId, {
        presenterMode: options.presenterMode,
      });
    } finally {
      this.catalog = previousCatalog;
    }
  }

  releaseAsset(handleOrScope: string | { scope?: string; release: () => void }): void {
    releasePreparedRuntimeAsset(handleOrScope as never);
  }
}

export const preloadCoordinator = new PreloadCoordinator();

export function usePreloadState(): PreloadSnapshot {
  return useSyncExternalStore(
    preloadCoordinator.subscribe,
    preloadCoordinator.getSnapshot,
    preloadCoordinator.getSnapshot,
  );
}

export function attachPreloadLifecycle(): void {
  preloadCoordinator.attachLifecycle();
}

export function setPreloadLifecycleState(
  state: PreloadSnapshot['lifecycleState'],
): void {
  lifecycle.setState(state);
  preloadCoordinator.setLifecycleState(state);
}

export function setPreloadCatalogForTests(catalog: AssetCatalogDefinition): void {
  preloadCoordinator.setCatalog(catalog);
}

export function resetPreloadCoordinatorForTests(): void {
  preloadCoordinator.reset();
}

export function touchAsset(path: string): void {
  preloadCoordinator.touchAsset(path);
}

export function touchPack(packId: string): void {
  preloadCoordinator.touchPack(packId);
}
