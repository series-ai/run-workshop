import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useSyncExternalStore } from 'react'
import {
  canAccessAtLeast,
  getCachedDebugConsoleAccess,
} from '../debug-console/access'

export const TUNING_OVERLAY_STORAGE_KEY = 'series-game-core:tuning-overlay-enabled'

export interface TuningOverlayState {
  preferenceLoaded: boolean
  userEnabled: boolean
  visible: boolean
}

type Listener = () => void

const listeners = new Set<Listener>()

let state: TuningOverlayState = {
  preferenceLoaded: false,
  userEnabled: false,
  visible: false,
}

// Guards against the race where a bridge caller invokes setTuningOverlayEnabled
// before loadTuningOverlayPreference resolves. A late deviceCache result must
// not clobber an explicit bridge call. Cleared once the preference load is
// done-or-errored.
let bridgeOverride = false

function notify(): void {
  listeners.forEach((listener) => listener())
}

function computeVisible(userEnabled: boolean): boolean {
  if (!userEnabled) {
    return false
  }
  const access = getCachedDebugConsoleAccess()
  return canAccessAtLeast(access.role, 'editor')
}

function setState(next: Partial<TuningOverlayState>): void {
  state = {
    ...state,
    ...next,
  }
}

export function getTuningOverlayState(): TuningOverlayState {
  return state
}

export async function loadTuningOverlayPreference(): Promise<void> {
  let userEnabled = false
  try {
    const raw = await RundotAPI.deviceCache.getItem(TUNING_OVERLAY_STORAGE_KEY)
    userEnabled = raw === 'true'
  } catch {
    userEnabled = false
  }

  if (bridgeOverride) {
    // A setTuningOverlayEnabled call already ran while we were waiting on
    // deviceCache. Mark the preference as loaded but do not overwrite the
    // explicit bridge value.
    setState({ preferenceLoaded: true })
    bridgeOverride = false
    notify()
    return
  }

  setState({
    preferenceLoaded: true,
    userEnabled,
    visible: computeVisible(userEnabled),
  })
  notify()
}

export async function setTuningOverlayEnabled(enabled: boolean): Promise<void> {
  if (!state.preferenceLoaded) {
    bridgeOverride = true
  }

  setState({
    userEnabled: enabled,
    visible: computeVisible(enabled),
  })
  notify()

  try {
    await RundotAPI.deviceCache.setItem(TUNING_OVERLAY_STORAGE_KEY, String(enabled))
  } catch {
    // fail closed on persistence; keep in-memory session state
  }
}

export function subscribeToTuningOverlayState(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTuningOverlayState(): TuningOverlayState {
  return useSyncExternalStore(
    subscribeToTuningOverlayState,
    () => state,
    () => state,
  )
}

export function resetTuningOverlayStateForTesting(): void {
  state = {
    preferenceLoaded: false,
    userEnabled: false,
    visible: false,
  }
  bridgeOverride = false
  notify()
}
