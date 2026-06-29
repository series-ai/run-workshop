/**
 * recording-capture — BeatBoard's session-based recording orchestrator.
 *
 * Captures a `MixSession` (timeline of pad-grid events) via
 * `MixRecorder`. No MediaRecorder. No mp4 blob. Replay drives the live
 * audio engine; export-to-video is a separate concern handled outside
 * the hot save path.
 *
 * The recorder sits between the UI's pad-grid action surface and the
 * `padGridStore` engine: while capturing, every pad action is forwarded
 * AND timestamped into the session. While idle, the recorder is a
 * pure pass-through.
 *
 * Replaces the previous mp4-blob orchestrator. The shape of the
 * `RecordingCapture` interface is preserved (`start`, `stop`, `cancel`,
 * `simulateError`) so consumers don't change.
 */
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useRecordingStore } from '../stores/recordingStore'
import { useNavigationStore } from '../stores/navigationStore'
import { usePadGridStore } from '../stores/padGridStore'
import { getPadGridEngine } from './pad-grid-engine'
import { useKitsStore, getKitById } from '../stores/kitsStore'
import {
  recordCustomEvent,
  trackBeatBoardFunnelStep,
} from './analytics'
import { lifecycle } from '../services/lifecycle'
import {
  createMixRecorder,
  setPadActionObserver,
  type MixRecorder,
} from './mixes'

// ── Constants ────────────────────────────────────────────────────────────

/** Hard cap on a single take. Stops the recorder if the player walks away. */
export const MAX_RECORDING_SECONDS = 5 * 60

/** Tick interval for the elapsed-seconds clock written to recordingStore. */
const ELAPSED_TICK_MS = 250

/**
 * appStorage key for the lifetime `first_record` funnel marker. Set
 * once after the first successful save; read on subsequent runs to
 * suppress duplicate funnel emissions.
 */
const FIRST_RECORD_KEY = 'beatboard.firstRecordCompletedAt'

// ── Types ────────────────────────────────────────────────────────────────

export type RecordingFailReason = 'cancelled' | 'app_backgrounded' | 'error'

export interface RecordingCaptureDeps {
  /** Active kit BPM (used by the recorder for beat-time conversion). */
  bpm: () => number
  /** Active kit id (recorded into the session). */
  kitId: () => string
  /** Test-stubbable timers. */
  setTimeout: (cb: () => void, ms: number) => number
  clearTimeout: (id: number) => void
  setInterval: (cb: () => void, ms: number) => number
  clearInterval: (id: number) => void
  now: () => number
  /** Subscribe to app-background events. Returns an unsubscribe handle. */
  onAppBackground: (cb: () => void) => () => void
}

export interface RecordingCapture {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  simulateError: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function readFirstRecordMarker(): Promise<boolean> {
  try {
    const raw = await RundotAPI.appStorage.getItem(FIRST_RECORD_KEY)
    return raw !== null && raw !== ''
  } catch (err) {
    RundotAPI.error('recording-capture.readFirstRecordMarker failed', { err: String(err) })
    return false
  }
}

async function writeFirstRecordMarker(): Promise<void> {
  try {
    await RundotAPI.appStorage.setItem(FIRST_RECORD_KEY, String(Date.now()))
  } catch (err) {
    RundotAPI.error('recording-capture.writeFirstRecordMarker failed', { err: String(err) })
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

interface CaptureRunState {
  hardCapTimer: number | null
  elapsedTimer: number | null
  unsubscribeBackground: (() => void) | null
  startedAtMs: number
  attemptNumber: number
  packId: string
  terminated: boolean
}

let lifetimeAttemptNumber = 0
let firstRecordFiredThisSession = false

export function createRecordingCapture(deps: RecordingCaptureDeps): RecordingCapture {
  let active: CaptureRunState | null = null
  const recorder: MixRecorder = createMixRecorder({
    clock: { nowMs: deps.now, bpm: deps.bpm },
  })

  function clearTimers(): void {
    if (active && active.hardCapTimer !== null) {
      deps.clearTimeout(active.hardCapTimer)
      active.hardCapTimer = null
    }
    if (active && active.elapsedTimer !== null) {
      deps.clearInterval(active.elapsedTimer)
      active.elapsedTimer = null
    }
  }

  /**
   * Silence every active pad. Called from both `finalizeSuccess` and
   * `emitFailure` so the engine is in a known-clean state before the
   * review modal opens (or before the discarded take is dropped).
   *
   * Why this matters: the recorded events are `tapLoop(padId)` calls,
   * which the engine treats as toggles. If a pad is still active when
   * replay starts, the first `tapLoop(padId)` deactivates it instead
   * of activating it, and the replay desyncs from the captured state.
   * `engine.stopAllImmediately()` is required (not the per-pad
   * `deactivate`) — `deactivate` schedules a bar-aligned fade-out,
   * leaving the pad in `activePadIds` for ~1–3 s. If the player taps
   * Play during that window, replay's first tapLoop on the same pad
   * cancels its own fire.
   */
  function silenceLivePads(): void {
    getPadGridEngine().stopAllImmediately()
  }

  function teardown(): void {
    if (!active) return
    clearTimers()
    if (active.unsubscribeBackground) {
      active.unsubscribeBackground()
      active.unsubscribeBackground = null
    }
    active = null
  }

  function emitFailure(reason: RecordingFailReason, errorMessage?: string): void {
    if (!active || active.terminated) return
    const run = active
    run.terminated = true
    const durationSeconds = (deps.now() - run.startedAtMs) / 1000
    recordCustomEvent('run_failed', {
      mode: 'record',
      pack_id: run.packId,
      attempt_number: run.attemptNumber,
      fail_reason: reason,
      duration_seconds: durationSeconds,
    })
    // Drop the in-progress session. The recorder's `stop()` returns the
    // buffer either way; we just don't write it to recordingStore.
    recorder.stop()
    setPadActionObserver(null)
    silenceLivePads()
    useRecordingStore.setState({
      status: reason === 'error' ? 'error' : 'idle',
      elapsedSeconds: 0,
      pendingSession: undefined,
      error: errorMessage,
    })
    teardown()
  }

  function finalizeSuccess(): void {
    if (!active || active.terminated) return
    const run = active
    run.terminated = true

    useRecordingStore.setState({ status: 'completing' })

    const session = recorder.stop()
    if (!session) {
      // Defensive: recorder wasn't started. Treat as failure.
      emitFailure('error', 'recorder.stop() returned null')
      return
    }

    const durationSeconds = (deps.now() - run.startedAtMs) / 1000
    recordCustomEvent('run_completed', {
      mode: 'record',
      pack_id: run.packId,
      attempt_number: run.attemptNumber,
      duration_seconds: durationSeconds,
      layers_active: usePadGridStore.getState().activePadIds.length,
      event_count: session.events.length,
    })

    if (!firstRecordFiredThisSession) {
      firstRecordFiredThisSession = true
      void (async () => {
        const alreadyFired = await readFirstRecordMarker()
        if (!alreadyFired) {
          trackBeatBoardFunnelStep('first_record')
          await writeFirstRecordMarker()
        }
      })()
    }

    setPadActionObserver(null)
    silenceLivePads()
    useRecordingStore.setState({
      status: 'idle',
      elapsedSeconds: durationSeconds,
      pendingSession: session,
      error: undefined,
    })

    useNavigationStore.getState().openModal('recordingReview')
    teardown()
  }

  async function start(): Promise<void> {
    if (active && !active.terminated) return
    lifetimeAttemptNumber += 1
    const packId = deps.kitId()

    active = {
      hardCapTimer: null,
      elapsedTimer: null,
      unsubscribeBackground: null,
      startedAtMs: deps.now(),
      attemptNumber: lifetimeAttemptNumber,
      packId,
      terminated: false,
    }

    active.unsubscribeBackground = deps.onAppBackground(() => {
      emitFailure('app_backgrounded')
    })

    recordCustomEvent('run_started', {
      mode: 'record',
      pack_id: packId,
      attempt_number: lifetimeAttemptNumber,
    })
    recordCustomEvent('recording_started', {
      pack_id: packId,
      layers_active_at_start: usePadGridStore.getState().activePadIds.length,
    })

    // Register the recorder as the active pad-action observer BEFORE
    // recorder.start() so an immediate UI tap is captured. Stays
    // registered until finalizeSuccess / emitFailure clears it.
    setPadActionObserver(recorder)
    recorder.start(packId)
    useRecordingStore.setState({
      status: 'capturing',
      elapsedSeconds: 0,
      pendingSession: undefined,
      error: undefined,
    })

    active.elapsedTimer = deps.setInterval(() => {
      if (!active || active.terminated) return
      const elapsed = (deps.now() - active.startedAtMs) / 1000
      useRecordingStore.setState({ elapsedSeconds: elapsed })
    }, ELAPSED_TICK_MS)

    active.hardCapTimer = deps.setTimeout(() => {
      if (!active || active.terminated) return
      finalizeSuccess()
    }, MAX_RECORDING_SECONDS * 1000)
  }

  function stop(): void {
    if (!active || active.terminated) return
    finalizeSuccess()
  }

  function cancel(): void {
    if (!active || active.terminated) return
    emitFailure('cancelled')
  }

  function simulateError(): void {
    if (!active || active.terminated) {
      useRecordingStore.setState({
        status: 'error',
        error: 'Simulated capture error',
        pendingSession: undefined,
      })
      recordCustomEvent('run_failed', {
        mode: 'record',
        pack_id: deps.kitId(),
        attempt_number: lifetimeAttemptNumber,
        fail_reason: 'error',
      })
      return
    }
    emitFailure('error', 'Simulated capture error')
  }

  return { start, stop, cancel, simulateError }
}

// ── Project-side singleton & default deps ────────────────────────────────

function defaultDeps(): RecordingCaptureDeps {
  return {
    bpm: () => {
      const kitId = useKitsStore.getState().activeKitId
      const kit = getKitById(kitId)
      return kit?.bpm ?? 84
    },
    kitId: () => useKitsStore.getState().activeKitId,
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number,
    clearTimeout: (id) => {
      globalThis.clearTimeout(id as unknown as ReturnType<typeof globalThis.setTimeout>)
    },
    setInterval: (cb, ms) => globalThis.setInterval(cb, ms) as unknown as number,
    clearInterval: (id) => {
      globalThis.clearInterval(id as unknown as ReturnType<typeof globalThis.setInterval>)
    },
    now: () => Date.now(),
    onAppBackground: (cb) => {
      const cleanup = lifecycle.register({ onSleep: cb, onPause: cb })
      return cleanup
    },
  }
}

let singleton: RecordingCapture | null = null

export function getRecordingCapture(): RecordingCapture {
  if (!singleton) {
    singleton = createRecordingCapture(defaultDeps())
  }
  return singleton
}

export function __resetRecordingCapture(): void {
  singleton = null
  lifetimeAttemptNumber = 0
  firstRecordFiredThisSession = false
}
