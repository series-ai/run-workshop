import type { LifecycleState } from '../services/AppLifecycle';

export type PreloadDepth = 'prefetch' | 'prepare';
export type PreloadSchedulerPriority = 'critical' | 'blocking' | 'background' | 'idle';
export type PreloadPresenterMode = 'native' | 'blocking' | 'background';
export type PrepareAssetKind = 'blob' | 'text' | 'json' | 'csv' | 'image' | 'audio' | 'gltf';

export interface PreloadPrepareRequest {
  path: string;
  kind?: PrepareAssetKind;
  scope?: string;
  retain?: boolean;
  fallback?: string | null;
}

export interface PreloadPackConfig {
  packId: string;
  label: string;
  ownership: string[];
  basePath?: string;
  indexes?: Record<string, string>;
  generatedOwnershipHints?: string[];
  defaultPrefetch?: string[];
  defaultPrepare?: Array<string | PreloadPrepareRequest>;
  schedulerPriority: PreloadSchedulerPriority;
  stages?: string[];
  prefetch?: string[];
  prepare?: Array<string | PreloadPrepareRequest>;
  eagerOnFirstTouch?: boolean;
  idlePrefetch?: boolean;
  idlePrepare?: boolean;
  lookAheadFrom?: string[];
  retainUntil?: 'manual' | 'stage-exit' | 'session';
}

export interface PreloadStageConfig {
  stageId: string;
  label: string;
  blocking?: boolean;
  presenterMode?: PreloadPresenterMode;
  packIds?: string[];
  prefetch?: string[];
  prepare?: Array<string | PreloadPrepareRequest>;
}

export interface PreloadExclusionRule {
  include: string[];
  reason: string;
}

export interface AssetCatalogDefinition {
  packs: PreloadPackConfig[];
  stages?: PreloadStageConfig[];
  exclude?: PreloadExclusionRule[];
}

export interface PreparedAssetHandle<T = unknown> {
  kind: PrepareAssetKind;
  path: string;
  value: T;
  scope?: string;
  release: () => void;
}

export interface PreloadProgress {
  loaded: number;
  failed: number;
  total: number;
  currentPath: string | null;
}

export interface PreloadPackStatus {
  packId: string;
  status: 'none' | 'prefetched' | 'prepared';
  prefetched: number;
  prepared: number;
  total: number;
  touched: boolean;
}

export interface PreloadPresenterState extends PreloadProgress {
  visible: boolean;
  mode: PreloadPresenterMode | null;
  stageId: string | null;
  message: string | null;
}

export interface PreloadSnapshot {
  activeStageId: string | null;
  activePackIds: string[];
  blocking: boolean;
  lifecycleState: LifecycleState;
  queuedIdlePackIds: string[];
  presenter: PreloadPresenterState;
  packStatus: Record<string, PreloadPackStatus>;
}

export const DEFAULT_PRELOAD_STAGES: PreloadStageConfig[] = [
  {
    stageId: 'sdk-init',
    label: 'Initialize SDK',
    blocking: true,
    presenterMode: 'native',
  },
  {
    stageId: 'startup-critical',
    label: 'Load startup assets',
    blocking: true,
    presenterMode: 'native',
  },
  {
    stageId: 'first-screen-ready',
    label: 'Prepare first screen',
    blocking: true,
    presenterMode: 'native',
  },
];

export const DEFAULT_PRELOAD_BUDGETS = {
  fetchConcurrency: 4,
  reservedActiveSlots: 2,
  heavyPrepareConcurrency: 1,
  lightPrepareConcurrency: 2,
  maxRetainedHeavyPacks: 1,
} as const;

export function inferPrepareAssetKind(path: string): PrepareAssetKind {
  const extension = path.split('?')[0]?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    case 'mp3':
    case 'ogg':
    case 'wav':
      return 'audio';
    case 'glb':
    case 'gltf':
      return 'gltf';
    case 'txt':
      return 'text';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'svg':
      return 'image';
    default:
      return 'blob';
  }
}

export function normalizePrepareRequest(
  request: string | PreloadPrepareRequest,
): PreloadPrepareRequest {
  if (typeof request === 'string') {
    return {
      path: request,
      kind: inferPrepareAssetKind(request),
    };
  }

  return {
    ...request,
    kind: request.kind ?? inferPrepareAssetKind(request.path),
  };
}

export function defineAssetCatalog(definition: AssetCatalogDefinition): AssetCatalogDefinition {
  const stageById = new Map<string, PreloadStageConfig>();

  for (const stage of [...DEFAULT_PRELOAD_STAGES, ...(definition.stages ?? [])]) {
    stageById.set(stage.stageId, {
      ...stage,
      packIds: [...(stage.packIds ?? [])],
      prefetch: [...(stage.prefetch ?? [])],
      prepare: [...(stage.prepare ?? [])],
    });
  }

  return {
    packs: definition.packs.map((pack) => ({
      ...pack,
      ownership: [...pack.ownership],
      stages: [...(pack.stages ?? [])],
      prefetch: [...(pack.prefetch ?? [])],
      prepare: [...(pack.prepare ?? [])],
      lookAheadFrom: [...(pack.lookAheadFrom ?? [])],
      retainUntil: pack.retainUntil ?? 'manual',
    })),
    stages: Array.from(stageById.values()),
    exclude: [...(definition.exclude ?? [])],
  };
}
