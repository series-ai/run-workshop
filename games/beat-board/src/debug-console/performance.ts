import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useSyncExternalStore } from 'react'

export const DEBUG_PERFORMANCE_OVERLAY_STORAGE_KEY =
  'series-game-core:debug-console:performance-overlay-enabled'
export const DEBUG_PERFORMANCE_HISTORY_LIMIT = 60
export const DEBUG_PERFORMANCE_FPS_BUCKET_MS = 1000
export const DEBUG_PERFORMANCE_MEMORY_SAMPLE_MS = 1000

export interface DebugPerformanceState {
  overlayEnabled: boolean
  currentFps: number | null
  fpsHistory: number[]
  memorySupported: boolean
  currentMemoryBytes: number | null
  memoryHistory: Array<number | null>
}

type Listener = () => void

const listeners = new Set<Listener>()

let state: DebugPerformanceState = {
  overlayEnabled: false,
  currentFps: null,
  fpsHistory: [],
  memorySupported: typeof readMemoryBytes() === 'number',
  currentMemoryBytes: readMemoryBytes(),
  memoryHistory: [],
}

let samplerFrameId: number | null = null
let samplerRunning = false
let bucketStartedAt: number | null = null
let bucketFrameCount = 0
let lastMemorySampleAt = -Infinity

function appendBounded<T>(items: T[], value: T): T[] {
  return [...items, value].slice(-DEBUG_PERFORMANCE_HISTORY_LIMIT)
}

function readMemoryBytes(): number | null {
  const maybeMemory = (performance as Performance & {
    memory?: { usedJSHeapSize?: number }
  }).memory

  return typeof maybeMemory?.usedJSHeapSize === 'number'
    ? maybeMemory.usedJSHeapSize
    : null
}

function setState(next: Partial<DebugPerformanceState>): void {
  state = {
    ...state,
    ...next,
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function getDebugPerformanceState(): DebugPerformanceState {
  return state
}

export async function loadDebugPerformancePreference(): Promise<void> {
  try {
    const raw = await RundotAPI.deviceCache.getItem(DEBUG_PERFORMANCE_OVERLAY_STORAGE_KEY)
    setState({ overlayEnabled: raw === 'true' })
  } catch {
    setState({ overlayEnabled: false })
  }

  if (state.overlayEnabled) {
    startDebugPerformanceSampler()
  } else {
    stopDebugPerformanceSampler()
  }

  notify()
}

export async function setDebugPerformanceOverlayEnabled(enabled: boolean): Promise<void> {
  setState({ overlayEnabled: enabled })

  if (enabled) {
    startDebugPerformanceSampler()
  } else {
    stopDebugPerformanceSampler()
  }

  notify()

  try {
    await RundotAPI.deviceCache.setItem(
      DEBUG_PERFORMANCE_OVERLAY_STORAGE_KEY,
      String(enabled),
    )
  } catch {
    // Fail closed on persistence; keep the in-memory session state.
  }
}

export function recordDebugAnimationFrame(timestampMs: number): void {
  if (bucketStartedAt === null) {
    bucketStartedAt = timestampMs
    bucketFrameCount = 1
    return
  }

  bucketFrameCount += 1

  const bucketDuration = timestampMs - bucketStartedAt
  if (bucketDuration < DEBUG_PERFORMANCE_FPS_BUCKET_MS) {
    return
  }

  const fps = Math.round((bucketFrameCount * 1000) / bucketDuration)
  setState({
    currentFps: fps,
    fpsHistory: appendBounded(state.fpsHistory, fps),
  })
  bucketStartedAt = timestampMs
  bucketFrameCount = 1

  refreshDebugMemorySample(timestampMs, false)
  notify()
}

export function refreshDebugMemorySample(
  timestampMs: number,
  shouldNotify = true,
): void {
  if (timestampMs - lastMemorySampleAt < DEBUG_PERFORMANCE_MEMORY_SAMPLE_MS) {
    return
  }

  lastMemorySampleAt = timestampMs
  const memoryBytes = readMemoryBytes()

  setState({
    memorySupported: memoryBytes !== null,
    currentMemoryBytes: memoryBytes,
    memoryHistory: appendBounded(state.memoryHistory, memoryBytes),
  })

  if (shouldNotify) {
    notify()
  }
}

export function resetDebugPerformanceState(): void {
  stopDebugPerformanceSampler()
  bucketStartedAt = null
  bucketFrameCount = 0
  lastMemorySampleAt = -Infinity
  state = {
    overlayEnabled: false,
    currentFps: null,
    fpsHistory: [],
    memorySupported: typeof readMemoryBytes() === 'number',
    currentMemoryBytes: readMemoryBytes(),
    memoryHistory: [],
  }
  notify()
}

export function clearDebugPerformanceHistory(): void {
  bucketStartedAt = null
  bucketFrameCount = 0
  lastMemorySampleAt = -Infinity
  setState({
    currentFps: null,
    fpsHistory: [],
    currentMemoryBytes: readMemoryBytes(),
    memoryHistory: [],
    memorySupported: typeof readMemoryBytes() === 'number',
  })
  notify()
}

export function startDebugPerformanceSampler(): void {
  if (samplerRunning || typeof window === 'undefined') {
    return
  }

  samplerRunning = true
  const tick = (timestampMs: number) => {
    if (!samplerRunning) {
      return
    }

    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      recordDebugAnimationFrame(timestampMs)
    }

    samplerFrameId = window.requestAnimationFrame(tick)
  }

  samplerFrameId = window.requestAnimationFrame(tick)
}

export function stopDebugPerformanceSampler(): void {
  samplerRunning = false
  if (samplerFrameId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(samplerFrameId)
  }
  samplerFrameId = null
}

export function subscribeToDebugPerformance(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDebugPerformanceState(): DebugPerformanceState {
  return useSyncExternalStore(
    subscribeToDebugPerformance,
    () => state,
    () => state,
  )
}
