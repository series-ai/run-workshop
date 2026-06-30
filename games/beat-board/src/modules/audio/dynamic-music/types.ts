export type DynamicMusicQualityTier = 'full' | 'reduced' | 'fallback'
export type DynamicMusicQuantize = 'immediate' | 'beat' | 'bar' | 'phrase'
export type DynamicMusicElementKind = 'loop' | 'stinger' | 'transition'
export type DynamicMusicElementRole =
  | 'core'
  | 'pulse'
  | 'bass'
  | 'texture'
  | 'accent'
  | 'air'
  | 'transition'

export type DynamicMusicVectors = Record<string, number>

export interface DynamicMusicElement {
  id: string
  role: DynamicMusicElementRole
  kind: DynamicMusicElementKind
  url?: string
  assetRef?: string
  bars: number
  bpm: number
  keyGroup: string
  tags?: string[]
  minTier?: DynamicMusicQualityTier
  source?: {
    generatedBy?: string
    promptId?: string
    license?: string
  }
}

export interface DynamicMusicState {
  id: string
  quantize?: DynamicMusicQuantize
  elementIds: string[]
  successorIds?: string[]
  preloadIds?: string[]
}

export interface DynamicMusicTransition {
  from: string
  to: string
  quantize?: DynamicMusicQuantize
  bridgeElementId?: string
}

export interface DynamicMusicManifest {
  version: 1
  bpm: number
  timeSig: [number, number]
  defaultState: string
  elements: DynamicMusicElement[]
  states: DynamicMusicState[]
  transitions?: DynamicMusicTransition[]
  quality?: {
    defaultTier?: DynamicMusicQualityTier
    maxActiveElements?: Partial<Record<DynamicMusicQualityTier, number>>
  }
}

export interface DynamicMusicDebugSnapshot {
  initialized: boolean
  unlocked: boolean
  currentStateId: string | null
  requestedStateId: string | null
  qualityTier: DynamicMusicQualityTier
  rawVectors: DynamicMusicVectors
  smoothedVectors: DynamicMusicVectors
  activeElementIds: string[]
  loadedElementIds: string[]
  preloadElementIds: string[]
  nextLegalStateIds: string[]
  lastError: { code: string; message: string } | null
}

export interface DynamicMusicAudioAdapter {
  init(manifest: DynamicMusicManifest): Promise<void>
  unlock(): Promise<void>
  loadElement(element: DynamicMusicElement): Promise<void>
  scheduleElement(element: DynamicMusicElement, atTime: number): void
  rampElementGain(elementId: string, gain: number, atTime: number, durationSeconds: number): void
  stopElement(elementId: string, atTime: number): void
  dispose(): Promise<void>
  now(): number
}

export interface DynamicMusicWebAudioAdapterOptions {
  contextFactory?: () => AudioContext
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>
  masterGain?: number
}

export interface DynamicMusicPhaseLockedPoolAdapterOptions extends DynamicMusicWebAudioAdapterOptions {
  startLookaheadSeconds?: number
}

export interface DynamicMusicRuntime {
  init(manifest: DynamicMusicManifest): Promise<void>
  unlock(): Promise<void>
  enterState(stateId: string): Promise<void>
  setVectors(vectors: DynamicMusicVectors): void
  pushEvent(name: string, payload?: unknown): void
  setQualityTier(tier: DynamicMusicQualityTier): void
  getDebugSnapshot(): DynamicMusicDebugSnapshot
  dispose(): Promise<void>
}

export type DynamicMusicErrorCode =
  | 'INVALID_MANIFEST'
  | 'UNKNOWN_STATE'
  | 'ILLEGAL_TRANSITION'
  | 'AUDIO_LOCKED'
  | 'AUDIO_LOAD_FAILED'
  | 'AUDIO_UNAVAILABLE'
