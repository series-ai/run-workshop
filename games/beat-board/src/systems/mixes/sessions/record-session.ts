/**
 * record-session — captures a `MixSession` from pad-grid actions.
 *
 * Observer pattern: every `padGridStore` mutating action (`tapLoop`,
 * `tapOneShot`, `deactivate`, `setCurrentBank`, `toggleFxBypass`)
 * notifies a registered observer BEFORE invoking the engine. While
 * recording is active, the recorder is the registered observer and
 * appends a timestamped event to the session buffer.
 *
 * Why observer (not wrap-the-engine): the UI calls `padGridStore`
 * directly. Wrapping the engine and asking every UI surface to call
 * through the wrapper instead would mean migrating every tap site,
 * conflating "play this pad" with "record this pad," and missing any
 * future caller that imports the store directly. The observer lives
 * where the action originates — one hook covers every caller.
 *
 * Pure module. The active observer reference is module-scoped; tests
 * inject their own clock and call observer methods directly.
 */

import type { MixEvent, MixSession, PadBankLabel } from './types'
import { MIX_SESSION_VERSION, secondsToBeats } from './types'

/** Inputs the recorder pulls each time it timestamps an event. */
export interface RecorderClock {
  /** Wall-clock now in ms. */
  nowMs: () => number
  /** Active kit BPM (used to convert ms → beats). */
  bpm: () => number
}

/**
 * The observer interface every `padGridStore` mutating action calls.
 * Implementations capture the event (recorder) or are no-op (idle).
 */
export interface PadActionObserver {
  onTapLoop: (padId: string) => void
  onTapOneShot: (padId: string) => void
  onDeactivate: (padId: string) => void
  onSetCurrentBank: (bank: PadBankLabel) => void
  onToggleFxBypass: (bank: PadBankLabel, blockId: string) => void
}

export interface RecorderOptions {
  clock: RecorderClock
}

export interface MixRecorder extends PadActionObserver {
  start: (kitId: string) => void
  stop: () => Omit<MixSession, 'id' | 'title'> | null
  isRecording: () => boolean
  eventCount: () => number
}

interface ActiveRun {
  kitId: string
  startedAtMs: number
  startBpm: number
  events: MixEvent[]
}

export function createMixRecorder(options: RecorderOptions): MixRecorder {
  const { clock } = options
  let active: ActiveRun | null = null

  function timestampBeats(): number {
    if (!active) return 0
    const elapsedMs = clock.nowMs() - active.startedAtMs
    const elapsedSec = Math.max(0, elapsedMs) / 1000
    return secondsToBeats(elapsedSec, active.startBpm)
  }

  function append(event: MixEvent): void {
    if (!active) return
    active.events.push(event)
  }

  return {
    start(kitId: string): void {
      active = {
        kitId,
        startedAtMs: clock.nowMs(),
        startBpm: clock.bpm() || 84,
        events: [],
      }
    },

    stop(): Omit<MixSession, 'id' | 'title'> | null {
      if (!active) return null
      const endBeats = timestampBeats()
      const run = active
      active = null
      return {
        kitId: run.kitId,
        bpm: run.startBpm,
        durationBeats: endBeats,
        createdAtMs: run.startedAtMs,
        events: run.events,
        version: MIX_SESSION_VERSION,
      }
    },

    isRecording: () => active !== null,
    eventCount: () => active?.events.length ?? 0,

    onTapLoop(padId: string): void {
      append({ t: timestampBeats(), type: 'pad_activate', padId })
    },
    onTapOneShot(padId: string): void {
      append({ t: timestampBeats(), type: 'one_shot', padId })
    },
    onDeactivate(padId: string): void {
      append({ t: timestampBeats(), type: 'pad_deactivate', padId })
    },
    onSetCurrentBank(bank: PadBankLabel): void {
      append({ t: timestampBeats(), type: 'bank_switch', bank })
    },
    onToggleFxBypass(bank: PadBankLabel, blockId: string): void {
      append({ t: timestampBeats(), type: 'fx_bypass_toggle', bank, blockId })
    },
  }
}

// ── Active observer registration ────────────────────────────────────────

let activeObserver: PadActionObserver | null = null

/**
 * Register an observer that `padGridStore` actions will notify before
 * invoking the engine. Pass `null` to clear.
 *
 * Only one observer is active at a time. recording-capture sets this
 * on `start()` and clears it on `stop()` / `cancel()`.
 */
export function setPadActionObserver(observer: PadActionObserver | null): void {
  activeObserver = observer
}

export function getPadActionObserver(): PadActionObserver | null {
  return activeObserver
}

/**
 * Used by `padGridStore` actions to notify the active observer (if any)
 * before forwarding to the engine. No-op when no observer is registered.
 */
export function notifyPadAction<K extends keyof PadActionObserver>(
  method: K,
  ...args: Parameters<PadActionObserver[K]>
): void {
  if (!activeObserver) return
  // Indirect dispatch keeps the call site terse without a switch.
  ;(activeObserver[method] as (...a: typeof args) => void)(...args)
}
