/**
 * recording-capture — sessions-based start/stop + observer wiring.
 *
 * The orchestrator registers the recorder as the active pad-action
 * observer on start(), and clears it on stop()/cancel(). While
 * registered, every `padGridStore` mutation routes through the
 * recorder via `notifyPadAction`.
 *
 * Tests use a fake clock + timer queue. The padGridStore module
 * singleton is the actual production store — we observe its actions
 * end-to-end to confirm the wiring.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createRecordingCapture,
  MAX_RECORDING_SECONDS,
  type RecordingCaptureDeps,
} from '../recording-capture'
import { useRecordingStore, resetRecordingStore } from '../../stores/recordingStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { useKitsStore } from '../../stores/kitsStore'
import {
  notifyPadAction,
  setPadActionObserver,
  getPadActionObserver,
} from '../mixes'

interface TestHarness {
  deps: RecordingCaptureDeps
  background: () => void
  advanceTimeMs: (ms: number) => void
  timersCount: () => number
}

function makeHarness(): TestHarness {
  let nowMs = 0
  const bpm = 84

  type Scheduled = { id: number; cb: () => void; fireAt: number; kind: 'timeout' | 'interval'; intervalMs: number }
  let nextId = 1
  const scheduled = new Map<number, Scheduled>()

  let backgroundCb: (() => void) | null = null

  const deps: RecordingCaptureDeps = {
    bpm: () => bpm,
    kitId: () => 'kit_test',
    setTimeout: (cb, ms) => {
      const id = nextId++
      scheduled.set(id, { id, cb, fireAt: nowMs + ms, kind: 'timeout', intervalMs: 0 })
      return id
    },
    clearTimeout: (id) => {
      scheduled.delete(id)
    },
    setInterval: (cb, ms) => {
      const id = nextId++
      scheduled.set(id, { id, cb, fireAt: nowMs + ms, kind: 'interval', intervalMs: ms })
      return id
    },
    clearInterval: (id) => {
      scheduled.delete(id)
    },
    now: () => nowMs,
    onAppBackground: (cb) => {
      backgroundCb = cb
      return () => {
        if (backgroundCb === cb) backgroundCb = null
      }
    },
  }

  function advanceTimeMs(ms: number): void {
    const target = nowMs + ms
    while (true) {
      let next: Scheduled | null = null
      for (const s of scheduled.values()) {
        if (s.fireAt <= target && (!next || s.fireAt < next.fireAt)) next = s
      }
      if (!next) break
      nowMs = next.fireAt
      if (next.kind === 'timeout') scheduled.delete(next.id)
      else next.fireAt = nowMs + next.intervalMs
      next.cb()
    }
    nowMs = target
  }

  return {
    deps,
    background: () => backgroundCb?.(),
    advanceTimeMs,
    timersCount: () => scheduled.size,
  }
}

beforeEach(() => {
  resetRecordingStore()
  useNavigationStore.setState({ modalStack: [] })
  useKitsStore.setState({ activeKitId: 'kit_alpha' })
  setPadActionObserver(null)
})

afterEach(() => {
  resetRecordingStore()
  setPadActionObserver(null)
})

describe('recording-capture — start', () => {
  it('flips status to capturing and resets elapsedSeconds to 0', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    expect(useRecordingStore.getState().status).toBe('capturing')
    expect(useRecordingStore.getState().elapsedSeconds).toBe(0)
  })

  it('starting a second time while active is a no-op', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    await capture.start()
    expect(useRecordingStore.getState().status).toBe('capturing')
  })

  it('registers a pad-action observer for the duration of the take', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    expect(getPadActionObserver()).toBeNull()
    await capture.start()
    expect(getPadActionObserver()).not.toBeNull()
    capture.stop()
    expect(getPadActionObserver()).toBeNull()
  })
})

describe('recording-capture — observer captures pad actions', () => {
  it('notifyPadAction calls during capture are recorded into the session', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    notifyPadAction('onTapLoop', 'drums-1')
    h.advanceTimeMs(1000)
    notifyPadAction('onTapOneShot', 'fx-1')
    capture.stop()
    const session = useRecordingStore.getState().pendingSession!
    expect(session.events).toHaveLength(2)
    expect(session.events[0]!.type).toBe('pad_activate')
    expect(session.events[1]!.type).toBe('one_shot')
  })

  it('notifyPadAction calls AFTER stop are not captured', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    notifyPadAction('onTapLoop', 'drums-1')
    capture.stop()
    notifyPadAction('onTapLoop', 'bass-1') // post-stop — should be ignored
    const session = useRecordingStore.getState().pendingSession!
    expect(session.events).toHaveLength(1)
  })
})

describe('recording-capture — elapsed clock', () => {
  it('elapsedSeconds ticks up while capturing', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    h.advanceTimeMs(1_000)
    expect(useRecordingStore.getState().elapsedSeconds).toBeGreaterThanOrEqual(1)
    h.advanceTimeMs(2_000)
    expect(useRecordingStore.getState().elapsedSeconds).toBeGreaterThanOrEqual(3)
  })

  it('elapsedSeconds stops ticking once stopped', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    h.advanceTimeMs(2_000)
    capture.stop()
    const after = useRecordingStore.getState().elapsedSeconds
    h.advanceTimeMs(5_000)
    expect(useRecordingStore.getState().elapsedSeconds).toBe(after)
  })
})

describe('recording-capture — stop finalises a session', () => {
  it('stop() writes pendingSession with the kit id', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    h.advanceTimeMs(500)
    capture.stop()
    const state = useRecordingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.pendingSession).toBeDefined()
    expect(state.pendingSession!.kitId).toBe('kit_test')
  })

  it('stop() opens the RecordingReview modal', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    capture.stop()
    expect(useNavigationStore.getState().modalStack).toContain('recordingReview')
  })

  it('stop() before start is a no-op', () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    capture.stop()
    expect(useRecordingStore.getState().status).toBe('idle')
  })

  it('stop() silences every live pad (so replay starts from a clean engine)', async () => {
    const h = makeHarness()
    const padStore = await import('../../stores/padGridStore')
    padStore.usePadGridStore.setState({
      activePadIds: ['drums-1', 'bass-2'],
      latchedPadIds: ['drums-1', 'bass-2'],
    })

    const capture = createRecordingCapture(h.deps)
    await capture.start()
    capture.stop()

    // engine.stopAllImmediately() must clear the store synchronously so a
    // replay tapLoop on 'drums-1' fires (activate) instead of toggling off
    // a pad that was still mid-fade-out.
    expect(padStore.usePadGridStore.getState().activePadIds).toEqual([])
    expect(padStore.usePadGridStore.getState().latchedPadIds).toEqual([])
  })
})

describe('recording-capture — cancel discards', () => {
  it('cancel() drops the buffer and clears pendingSession', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    notifyPadAction('onTapLoop', 'drums-1')
    capture.cancel()
    const state = useRecordingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.pendingSession).toBeUndefined()
    expect(state.elapsedSeconds).toBe(0)
  })

  it('cancel() does NOT open RecordingReview', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    capture.cancel()
    expect(useNavigationStore.getState().modalStack).not.toContain('recordingReview')
  })

  it('cancel() clears the pad-action observer', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    expect(getPadActionObserver()).not.toBeNull()
    capture.cancel()
    expect(getPadActionObserver()).toBeNull()
  })
})

describe('recording-capture — hard cap', () => {
  it('auto-stops after MAX_RECORDING_SECONDS', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    h.advanceTimeMs((MAX_RECORDING_SECONDS + 1) * 1_000)
    const state = useRecordingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.pendingSession).toBeDefined()
  })
})

describe('recording-capture — failure paths', () => {
  it('app-background while capturing aborts and clears pendingSession', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    h.background()
    const state = useRecordingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.pendingSession).toBeUndefined()
    expect(getPadActionObserver()).toBeNull()
  })

  it('teardown clears every pending timer after stop', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    expect(h.timersCount()).toBeGreaterThan(0)
    capture.stop()
    expect(h.timersCount()).toBe(0)
  })

  it('teardown clears every pending timer after cancel', async () => {
    const h = makeHarness()
    const capture = createRecordingCapture(h.deps)
    await capture.start()
    capture.cancel()
    expect(h.timersCount()).toBe(0)
  })
})
