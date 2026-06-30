/**
 * engine-tick — periodic driver that advances the pad-grid engine's
 * `pendingRemovals` queue using the live audio-context clock.
 *
 * Why this exists:
 *   - One-shots (Groovepad's "tap = one-shot trigger") and explicit
 *     `deactivate(padId)` calls schedule a fade-out ramp, then push a
 *     `{ padId, removeAfter }` entry into the engine's
 *     `pendingRemovals` queue. The pad stays in `activePadIds` until
 *     `tick(audioContextTime)` confirms the ramp has settled and removes
 *     it. Without a periodic driver in production, nothing calls `tick`
 *     and one-shot pads never auto-remove from the visual state.
 *
 * Cadence:
 *   - 100ms is well below the perceptual threshold for the on-beat removal
 *     of a one-shot tail (the fade-out ends one bar after the bar
 *     boundary; at 84 BPM that's ≈ 2.86 s, so 100ms granularity is
 *     >25× finer than the event we're servicing). Cheap on the main
 *     thread — `tick` is a single Map iteration over at most a handful
 *     of pending entries.
 *
 * Lifecycle:
 *   - `installEngineTickDriver()` is idempotent; repeated calls are
 *     no-ops. The driver only reads `getAudioContext().currentTime`
 *     when the master is ready; otherwise the tick is skipped (cheap
 *     branch). `disposeEngineTickDriver()` is exported for tests.
 */

import { getAudioContext, isAudioMasterReady } from './audio-master'
import { getPadGridEngine } from '../systems/pad-grid-engine'

/** Driver interval. Documented in the file header. */
const TICK_INTERVAL_MS = 100

let intervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * Start the periodic tick driver. Idempotent — only one interval is ever
 * installed per session. Called once during app boot from `App.tsx`.
 */
export function installEngineTickDriver(): void {
  if (intervalHandle !== null) return
  intervalHandle = setInterval(() => {
    if (!isAudioMasterReady()) return
    let nowSeconds: number
    try {
      nowSeconds = getAudioContext().currentTime
    } catch {
      return
    }
    getPadGridEngine().tick(nowSeconds)
  }, TICK_INTERVAL_MS)
}

/**
 * Stop the periodic tick driver. Used by tests + lifecycle teardown.
 */
export function disposeEngineTickDriver(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

/** Test-only — read whether the driver is currently installed. */
export function __isEngineTickDriverInstalled(): boolean {
  return intervalHandle !== null
}
