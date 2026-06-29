import { defaultDynamicMusicConfig, dynamicMusicTierRank } from './config'
import type {
  DynamicMusicAudioAdapter,
  DynamicMusicDebugSnapshot,
  DynamicMusicElement,
  DynamicMusicElementRole,
  DynamicMusicErrorCode,
  DynamicMusicPhaseLockedPoolAdapterOptions,
  DynamicMusicManifest,
  DynamicMusicQualityTier,
  DynamicMusicQuantize,
  DynamicMusicRuntime,
  DynamicMusicState,
  DynamicMusicWebAudioAdapterOptions,
  DynamicMusicVectors,
} from './types'

export * from './types'

export class DynamicMusicError extends Error {
  constructor(
    public readonly code: DynamicMusicErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'DynamicMusicError'
  }
}

export function validateDynamicMusicManifest(input: unknown): DynamicMusicManifest {
  if (!input || typeof input !== 'object') {
    throw invalidManifest('manifest must be an object')
  }
  const manifest = input as Partial<DynamicMusicManifest>
  if (manifest.version !== 1) throw invalidManifest('manifest version must be 1')
  if (!Number.isFinite(manifest.bpm) || (manifest.bpm ?? 0) <= 0) {
    throw invalidManifest('bpm must be a positive number')
  }
  if (!Array.isArray(manifest.timeSig) || manifest.timeSig.length !== 2) {
    throw invalidManifest('timeSig must be [beats, noteValue]')
  }
  if (!Array.isArray(manifest.elements) || manifest.elements.length === 0) {
    throw invalidManifest('elements must be a non-empty array')
  }
  if (!Array.isArray(manifest.states) || manifest.states.length === 0) {
    throw invalidManifest('states must be a non-empty array')
  }
  if (typeof manifest.defaultState !== 'string') {
    throw invalidManifest('defaultState is required')
  }

  const elementIds = new Set<string>()
  for (const element of manifest.elements) {
    validateElement(element, elementIds)
  }

  const stateIds = new Set<string>()
  for (const state of manifest.states) {
    if (!state || typeof state.id !== 'string' || !state.id) {
      throw invalidManifest('state id is required')
    }
    if (stateIds.has(state.id)) throw invalidManifest(`duplicate state id: ${state.id}`)
    stateIds.add(state.id)
    if (!Array.isArray(state.elementIds)) {
      throw invalidManifest(`state ${state.id} elementIds must be an array`)
    }
    for (const elementId of state.elementIds) {
      if (!elementIds.has(elementId)) {
        throw invalidManifest(`state ${state.id} references unknown element ${elementId}`)
      }
    }
    for (const preloadId of state.preloadIds ?? []) {
      if (!elementIds.has(preloadId)) {
        throw invalidManifest(`state ${state.id} preloads unknown element ${preloadId}`)
      }
    }
  }

  if (!stateIds.has(manifest.defaultState)) {
    throw invalidManifest(`defaultState references unknown state ${manifest.defaultState}`)
  }

  for (const state of manifest.states) {
    for (const successorId of state.successorIds ?? []) {
      if (!stateIds.has(successorId)) {
        throw invalidManifest(`state ${state.id} references unknown successor ${successorId}`)
      }
    }
  }

  for (const transition of manifest.transitions ?? []) {
    if (!stateIds.has(transition.from) || !stateIds.has(transition.to)) {
      throw invalidManifest(`transition references unknown state ${transition.from}->${transition.to}`)
    }
    if (transition.bridgeElementId && !elementIds.has(transition.bridgeElementId)) {
      throw invalidManifest(`transition references unknown bridge ${transition.bridgeElementId}`)
    }
  }

  return manifest as DynamicMusicManifest
}

function validateElement(element: DynamicMusicElement, seen: Set<string>): void {
  if (!element || typeof element.id !== 'string' || !element.id) {
    throw invalidManifest('element id is required')
  }
  if (seen.has(element.id)) throw invalidManifest(`duplicate element id: ${element.id}`)
  seen.add(element.id)
  if (!element.url && !element.assetRef) {
    throw invalidManifest(`element ${element.id} requires url or assetRef`)
  }
  if (!Number.isFinite(element.bars) || element.bars <= 0) {
    throw invalidManifest(`element ${element.id} bars must be positive`)
  }
  if (!Number.isFinite(element.bpm) || element.bpm <= 0) {
    throw invalidManifest(`element ${element.id} bpm must be positive`)
  }
  if (typeof element.keyGroup !== 'string' || !element.keyGroup) {
    throw invalidManifest(`element ${element.id} keyGroup is required`)
  }
}

function invalidManifest(message: string): DynamicMusicError {
  return new DynamicMusicError('INVALID_MANIFEST', message)
}

export function smoothVectors(
  previous: DynamicMusicVectors,
  next: DynamicMusicVectors,
  factor = defaultDynamicMusicConfig.smoothingFactor,
): DynamicMusicVectors {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  const out: DynamicMusicVectors = {}
  const clampedFactor = clamp01(factor)
  for (const key of keys) {
    const prev = clamp01(previous[key] ?? 0)
    const target = clamp01(next[key] ?? 0)
    out[key] = prev + (target - prev) * clampedFactor
  }
  return out
}

export function isTransitionLegal(
  manifest: DynamicMusicManifest,
  from: string,
  to: string,
): { legal: true; quantize: DynamicMusicQuantize } | { legal: false; reason: string } {
  const fromState = findState(manifest, from)
  const toState = findState(manifest, to)
  if (!fromState || !toState) return { legal: false, reason: 'unknown-state' }
  const explicit = manifest.transitions?.find((t) => t.from === from && t.to === to)
  if (explicit) {
    return { legal: true, quantize: explicit.quantize ?? toState.quantize ?? 'bar' }
  }
  if (fromState.successorIds?.includes(to)) {
    return { legal: true, quantize: toState.quantize ?? fromState.quantize ?? 'bar' }
  }
  return { legal: false, reason: 'not-successor' }
}

export function selectElementsForTier(
  manifest: DynamicMusicManifest,
  stateId: string,
  tier: DynamicMusicQualityTier,
): DynamicMusicElement[] {
  const state = requireState(manifest, stateId)
  const byId = new Map(manifest.elements.map((element) => [element.id, element]))
  const max = manifest.quality?.maxActiveElements?.[tier] ?? Number.POSITIVE_INFINITY
  const selected: DynamicMusicElement[] = []
  for (const elementId of state.elementIds) {
    const element = byId.get(elementId)
    if (!element) continue
    const minTier = element.minTier ?? 'fallback'
    if (dynamicMusicTierRank[tier] >= dynamicMusicTierRank[minTier]) {
      selected.push(element)
    }
    if (selected.length >= max) break
  }
  return selected
}

export function getPreloadElementIds(manifest: DynamicMusicManifest, stateId: string): string[] {
  const state = requireState(manifest, stateId)
  const ids: string[] = []
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id)
  }
  for (const id of state.preloadIds ?? []) add(id)
  for (const successorId of state.successorIds ?? []) {
    const successor = findState(manifest, successorId)
    for (const id of successor?.elementIds ?? []) add(id)
  }
  return ids
}

export function getStemRoleTarget(role: DynamicMusicElementRole, vectors: DynamicMusicVectors): number {
  const energy = clamp01(vectors['energy'] ?? 0)
  const tension = clamp01(vectors['tension'] ?? 0)
  const motion = clamp01(vectors['motion'] ?? 0)
  const brightness = clamp01(vectors['brightness'] ?? 0)
  const wonder = clamp01(vectors['wonder'] ?? 0)
  switch (role) {
    case 'core':
      return 0.72
    case 'pulse':
      return clamp01(Math.max(motion, energy * 0.8, tension * 0.55))
    case 'bass':
      return clamp01(Math.max(energy * 0.7, tension * 0.45))
    case 'texture':
      return clamp01(Math.max(tension, wonder * 0.65, (1 - brightness) * 0.5))
    case 'accent':
      return clamp01(Math.max(energy, tension, motion))
    case 'air':
      return clamp01(Math.max(wonder, brightness * 0.7))
    case 'transition':
      return clamp01(Math.max(tension, motion))
  }
}

export function createDynamicMusicRuntime(options: {
  audio?: DynamicMusicAudioAdapter
  smoothingFactor?: number
} = {}): DynamicMusicRuntime {
  const audio = options.audio ?? createUnavailableAudioAdapter()
  const smoothingFactor = options.smoothingFactor ?? defaultDynamicMusicConfig.smoothingFactor
  let manifest: DynamicMusicManifest | null = null
  let initialized = false
  let unlocked = false
  let currentStateId: string | null = null
  let requestedStateId: string | null = null
  let qualityTier: DynamicMusicQualityTier = defaultDynamicMusicConfig.defaultTier
  let rawVectors: DynamicMusicVectors = {}
  let smoothedVectors: DynamicMusicVectors = {}
  let activeElementIds: string[] = []
  let loadedElementIds: string[] = []
  let lastError: { code: string; message: string } | null = null

  async function activateState(stateId: string): Promise<void> {
    const activeManifest = requireManifest(manifest)
    const elements = selectElementsForTier(activeManifest, stateId, qualityTier)
    try {
      for (const element of elements) {
        await audio.loadElement(element)
      }
    } catch (err) {
      const wrapped = new DynamicMusicError(
        'AUDIO_LOAD_FAILED',
        err instanceof Error ? err.message : String(err),
        err,
      )
      lastError = { code: wrapped.code, message: wrapped.message }
      throw wrapped
    }
    const atTime = audio.now() + defaultDynamicMusicConfig.scheduleHeadSeconds
    for (const element of elements) {
      audio.scheduleElement(element, atTime)
      audio.rampElementGain(
        element.id,
        getStemRoleTarget(element.role, smoothedVectors),
        atTime,
        defaultDynamicMusicConfig.rampSeconds,
      )
    }
    currentStateId = stateId
    activeElementIds = elements.map((element) => element.id)
    loadedElementIds = [...activeElementIds]
  }

  return {
    async init(nextManifest: DynamicMusicManifest): Promise<void> {
      manifest = validateDynamicMusicManifest(nextManifest)
      qualityTier = manifest.quality?.defaultTier ?? defaultDynamicMusicConfig.defaultTier
      await audio.init(manifest)
      initialized = true
      requestedStateId = manifest.defaultState
      await activateState(manifest.defaultState)
    },
    async unlock(): Promise<void> {
      try {
        await audio.unlock()
        unlocked = true
      } catch (err) {
        const wrapped = new DynamicMusicError('AUDIO_LOCKED', String(err), err)
        lastError = { code: wrapped.code, message: wrapped.message }
        throw wrapped
      }
    },
    async enterState(stateId: string): Promise<void> {
      const activeManifest = requireManifest(manifest)
      if (!findState(activeManifest, stateId)) {
        const err = new DynamicMusicError('UNKNOWN_STATE', `Unknown music state: ${stateId}`)
        lastError = { code: err.code, message: err.message }
        throw err
      }
      if (currentStateId && currentStateId !== stateId) {
        const legality = isTransitionLegal(activeManifest, currentStateId, stateId)
        if (!legality.legal) {
          const err = new DynamicMusicError('ILLEGAL_TRANSITION', `Illegal transition: ${currentStateId}->${stateId}`)
          lastError = { code: err.code, message: err.message }
          throw err
        }
      }
      requestedStateId = stateId
      await activateState(stateId)
    },
    setVectors(vectors: DynamicMusicVectors): void {
      rawVectors = Object.fromEntries(Object.entries(vectors).map(([key, value]) => [key, clamp01(value)]))
      smoothedVectors = smoothVectors(smoothedVectors, rawVectors, smoothingFactor)
    },
    pushEvent(_name: string, _payload?: unknown): void {
      // Event-to-transition maps are intentionally authored by consumers in v1.
    },
    setQualityTier(tier: DynamicMusicQualityTier): void {
      qualityTier = tier
      if (manifest && currentStateId) {
        activeElementIds = selectElementsForTier(manifest, currentStateId, tier).map((element) => element.id)
        loadedElementIds = [...activeElementIds]
      }
    },
    getDebugSnapshot(): DynamicMusicDebugSnapshot {
      const nextLegalStateIds = manifest && currentStateId
        ? (findState(manifest, currentStateId)?.successorIds ?? [])
        : []
      const preloadElementIds = manifest && currentStateId
        ? getPreloadElementIds(manifest, currentStateId)
        : []
      return {
        initialized,
        unlocked,
        currentStateId,
        requestedStateId,
        qualityTier,
        rawVectors,
        smoothedVectors,
        activeElementIds,
        loadedElementIds,
        preloadElementIds,
        nextLegalStateIds,
        lastError,
      }
    },
    async dispose(): Promise<void> {
      await audio.dispose()
      initialized = false
      unlocked = false
      currentStateId = null
      requestedStateId = null
      activeElementIds = []
      loadedElementIds = []
    },
  }
}

export function createWebAudioDynamicMusicAdapter(
  options: DynamicMusicWebAudioAdapterOptions = {},
): DynamicMusicAudioAdapter {
  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  const buffers = new Map<string, AudioBuffer>()
  const gains = new Map<string, GainNode>()
  const sources = new Map<string, AudioBufferSourceNode>()
  const fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer

  function ensureContext(): AudioContext {
    if (!ctx) {
      const factory = options.contextFactory ?? defaultAudioContextFactory
      ctx = factory()
      masterGain = ctx.createGain()
      masterGain.gain.value = options.masterGain ?? 1
      masterGain.connect(ctx.destination)
    }
    return ctx
  }

  function ensureGain(elementId: string): GainNode {
    const activeContext = ensureContext()
    const existing = gains.get(elementId)
    if (existing) return existing
    const gain = activeContext.createGain()
    gain.gain.value = 0
    gain.connect(masterGain!)
    gains.set(elementId, gain)
    return gain
  }

  return {
    async init(): Promise<void> {
      ensureContext()
    },
    async unlock(): Promise<void> {
      const activeContext = ensureContext()
      if (activeContext.state === 'suspended') {
        await activeContext.resume()
      }
    },
    async loadElement(element: DynamicMusicElement): Promise<void> {
      if (buffers.has(element.id)) return
      const url = element.url ?? element.assetRef
      if (!url) {
        throw new DynamicMusicError('AUDIO_LOAD_FAILED', `Element ${element.id} has no url or assetRef`)
      }
      const activeContext = ensureContext()
      try {
        const arrayBuffer = await fetchArrayBuffer(url)
        const decoded = await activeContext.decodeAudioData(arrayBuffer.slice(0))
        buffers.set(element.id, decoded)
        ensureGain(element.id)
      } catch (err) {
        throw new DynamicMusicError(
          'AUDIO_LOAD_FAILED',
          `Failed to load music element ${element.id}: ${err instanceof Error ? err.message : String(err)}`,
          err,
        )
      }
    },
    scheduleElement(element: DynamicMusicElement, atTime: number): void {
      const activeContext = ensureContext()
      const buffer = buffers.get(element.id)
      if (!buffer) {
        throw new DynamicMusicError('AUDIO_LOAD_FAILED', `Element ${element.id} has not been loaded`)
      }
      const previousSource = sources.get(element.id)
      if (previousSource) {
        try {
          previousSource.stop(Math.max(activeContext.currentTime, atTime))
        } catch {
          // Source may already be stopped; replacing it is idempotent.
        }
      }
      const source = activeContext.createBufferSource()
      source.buffer = buffer
      source.loop = element.kind === 'loop'
      source.connect(ensureGain(element.id))
      source.start(atTime)
      sources.set(element.id, source)
    },
    rampElementGain(elementId: string, gainValue: number, atTime: number, durationSeconds: number): void {
      const gain = ensureGain(elementId).gain
      gain.cancelScheduledValues(atTime)
      gain.setValueAtTime(gain.value, atTime)
      gain.linearRampToValueAtTime(clamp01(gainValue), atTime + Math.max(0, durationSeconds))
    },
    stopElement(elementId: string, atTime: number): void {
      const source = sources.get(elementId)
      if (!source) return
      source.stop(atTime)
      sources.delete(elementId)
    },
    async dispose(): Promise<void> {
      for (const source of sources.values()) {
        try {
          source.stop()
        } catch {
          // Already stopped sources can be ignored during disposal.
        }
      }
      sources.clear()
      gains.clear()
      buffers.clear()
      if (ctx) {
        await ctx.close()
      }
      ctx = null
      masterGain = null
    },
    now(): number {
      return ensureContext().currentTime
    },
  }
}

export function createPhaseLockedLoopPoolAdapter(
  options: DynamicMusicPhaseLockedPoolAdapterOptions = {},
): DynamicMusicAudioAdapter {
  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let phaseAnchorTime: number | null = null
  const buffers = new Map<string, AudioBuffer>()
  const gains = new Map<string, GainNode>()
  const loopSources = new Map<string, AudioBufferSourceNode>()
  const stingerSources = new Map<string, AudioBufferSourceNode>()
  const fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer
  const startLookaheadSeconds = options.startLookaheadSeconds ?? 0.1

  function ensureContext(): AudioContext {
    if (!ctx) {
      const factory = options.contextFactory ?? defaultAudioContextFactory
      ctx = factory()
      masterGain = ctx.createGain()
      masterGain.gain.value = options.masterGain ?? 1
      masterGain.connect(ctx.destination)
    }
    return ctx
  }

  function ensureGain(elementId: string): GainNode {
    const activeContext = ensureContext()
    const existing = gains.get(elementId)
    if (existing) return existing
    const gain = activeContext.createGain()
    gain.gain.value = 0
    gain.connect(masterGain!)
    gains.set(elementId, gain)
    return gain
  }

  function ensurePhaseAnchor(): number {
    const activeContext = ensureContext()
    if (phaseAnchorTime === null) {
      phaseAnchorTime = activeContext.currentTime + startLookaheadSeconds
    }
    return phaseAnchorTime
  }

  function createConnectedSource(element: DynamicMusicElement): AudioBufferSourceNode {
    const activeContext = ensureContext()
    const buffer = buffers.get(element.id)
    if (!buffer) {
      throw new DynamicMusicError('AUDIO_LOAD_FAILED', `Element ${element.id} has not been loaded`)
    }
    const source = activeContext.createBufferSource()
    source.buffer = buffer
    source.loop = element.kind === 'loop'
    source.connect(ensureGain(element.id))
    return source
  }

  function rampGain(elementId: string, gainValue: number, atTime: number, durationSeconds: number): void {
    const gain = ensureGain(elementId).gain
    gain.cancelScheduledValues(atTime)
    gain.setValueAtTime(gain.value, atTime)
    gain.linearRampToValueAtTime(clamp01(gainValue), atTime + Math.max(0, durationSeconds))
  }

  return {
    async init(): Promise<void> {
      ensureContext()
    },
    async unlock(): Promise<void> {
      const activeContext = ensureContext()
      if (activeContext.state === 'suspended') {
        await activeContext.resume()
      }
    },
    async loadElement(element: DynamicMusicElement): Promise<void> {
      if (buffers.has(element.id)) return
      const url = element.url ?? element.assetRef
      if (!url) {
        throw new DynamicMusicError('AUDIO_LOAD_FAILED', `Element ${element.id} has no url or assetRef`)
      }
      const activeContext = ensureContext()
      try {
        const arrayBuffer = await fetchArrayBuffer(url)
        const decoded = await activeContext.decodeAudioData(arrayBuffer.slice(0))
        buffers.set(element.id, decoded)
        ensureGain(element.id)
        if (element.kind === 'loop') {
          const source = createConnectedSource(element)
          source.start(ensurePhaseAnchor())
          loopSources.set(element.id, source)
        }
      } catch (err) {
        throw new DynamicMusicError(
          'AUDIO_LOAD_FAILED',
          `Failed to load music element ${element.id}: ${err instanceof Error ? err.message : String(err)}`,
          err,
        )
      }
    },
    scheduleElement(element: DynamicMusicElement, atTime: number): void {
      if (element.kind === 'loop') {
        if (!loopSources.has(element.id)) {
          const source = createConnectedSource(element)
          source.start(ensurePhaseAnchor())
          loopSources.set(element.id, source)
        }
        rampGain(element.id, 1, atTime, 0)
        return
      }

      const previous = stingerSources.get(element.id)
      if (previous) {
        try {
          previous.stop(atTime)
        } catch {
          // Already stopped stingers are harmless.
        }
      }
      const source = createConnectedSource(element)
      source.loop = false
      source.start(atTime)
      stingerSources.set(element.id, source)
    },
    rampElementGain(elementId: string, gainValue: number, atTime: number, durationSeconds: number): void {
      rampGain(elementId, gainValue, atTime, durationSeconds)
    },
    stopElement(elementId: string, atTime: number): void {
      const gain = gains.get(elementId)
      if (gain) {
        gain.gain.cancelScheduledValues(atTime)
        gain.gain.setValueAtTime(gain.gain.value, atTime)
        gain.gain.linearRampToValueAtTime(0, atTime)
      }
      const stinger = stingerSources.get(elementId)
      if (stinger) {
        stinger.stop(atTime)
        stingerSources.delete(elementId)
      }
    },
    async dispose(): Promise<void> {
      for (const source of [...loopSources.values(), ...stingerSources.values()]) {
        try {
          source.stop()
        } catch {
          // Already stopped sources can be ignored during disposal.
        }
      }
      loopSources.clear()
      stingerSources.clear()
      gains.clear()
      buffers.clear()
      phaseAnchorTime = null
      if (ctx) {
        await ctx.close()
      }
      ctx = null
      masterGain = null
    },
    now(): number {
      return ensureContext().currentTime
    },
  }
}

async function defaultFetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.arrayBuffer()
}

function defaultAudioContextFactory(): AudioContext {
  const ctor = globalThis.AudioContext
    ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!ctor) throw new DynamicMusicError('AUDIO_UNAVAILABLE', 'AudioContext is not available')
  return new ctor()
}

function createUnavailableAudioAdapter(): DynamicMusicAudioAdapter {
  const unavailable = () => {
    throw new DynamicMusicError('AUDIO_UNAVAILABLE', 'No DynamicMusicAudioAdapter was provided')
  }
  return {
    async init() {
      unavailable()
    },
    async unlock() {
      unavailable()
    },
    async loadElement() {
      unavailable()
    },
    scheduleElement() {
      unavailable()
    },
    rampElementGain() {
      unavailable()
    },
    stopElement() {
      unavailable()
    },
    async dispose() {},
    now: () => 0,
  }
}

function requireManifest(manifest: DynamicMusicManifest | null): DynamicMusicManifest {
  if (!manifest) throw new DynamicMusicError('INVALID_MANIFEST', 'Runtime has not been initialized')
  return manifest
}

function findState(manifest: DynamicMusicManifest, stateId: string): DynamicMusicState | undefined {
  return manifest.states.find((state) => state.id === stateId)
}

function requireState(manifest: DynamicMusicManifest, stateId: string): DynamicMusicState {
  const state = findState(manifest, stateId)
  if (!state) throw new DynamicMusicError('UNKNOWN_STATE', `Unknown music state: ${stateId}`)
  return state
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
