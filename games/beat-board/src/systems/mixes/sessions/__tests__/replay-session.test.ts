/**
 * createReplaySession unit tests. Drive the scheduler against a fake
 * timer queue so we can step time deterministically and assert the
 * engine sees every recorded event at the right beat.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReplaySession,
  type ReplayClock,
  type ReplayProgress,
} from '../replay-session'
import type { PadActionEngine } from '../record-session'
import type { MixEvent, MixSession } from '../types'
import { MIX_SESSION_VERSION } from '../types'

interface FakeTimer {
  id: number
  cb: () => void
  fireAt: number
}

interface FakeClock extends ReplayClock {
  advance: (ms: number) => void
  pendingCount: () => number
}

function makeFakeClock(): FakeClock {
  let now = 0
  let nextId = 1
  const queue = new Map<number, FakeTimer>()
  return {
    nowMs: () => now,
    setTimeout: (cb, ms) => {
      const id = nextId++
      queue.set(id, { id, cb, fireAt: now + ms })
      return id
    },
    clearTimeout: (id) => {
      queue.delete(id)
    },
    advance(ms) {
      const target = now + ms
      // Fire every timer whose fireAt is <= target, in fireAt order. The
      // do-while ensures advance(0) still drains timers scheduled for
      // the current moment.
      while (true) {
        let next: FakeTimer | null = null
        for (const t of queue.values()) {
          if (t.fireAt <= target && (!next || t.fireAt < next.fireAt)) next = t
        }
        if (!next) break
        now = next.fireAt
        queue.delete(next.id)
        next.cb()
      }
      now = target
    },
    pendingCount: () => queue.size,
  }
}

function makeFakeEngine(): PadActionEngine & {
  calls: Array<{ method: string; args: unknown[] }>
} {
  const calls: Array<{ method: string; args: unknown[] }> = []
  return {
    calls,
    tapLoop: (padId) => calls.push({ method: 'tapLoop', args: [padId] }),
    tapOneShot: (padId) => calls.push({ method: 'tapOneShot', args: [padId] }),
    deactivate: (padId) => calls.push({ method: 'deactivate', args: [padId] }),
    setCurrentBank: (bank) => calls.push({ method: 'setCurrentBank', args: [bank] }),
    toggleFxBypass: (bank, blockId) =>
      calls.push({ method: 'toggleFxBypass', args: [bank, blockId] }),
  }
}

function buildSession(events: MixEvent[], overrides: Partial<MixSession> = {}): MixSession {
  return {
    id: 'mix_test',
    title: 'Test',
    kitId: 'kit_a',
    bpm: 120, // 1 beat = 500ms — round numbers
    durationBeats: 8,
    createdAtMs: 0,
    events,
    version: MIX_SESSION_VERSION,
    ...overrides,
  }
}

let clock: FakeClock
let engine: ReturnType<typeof makeFakeEngine>

beforeEach(() => {
  clock = makeFakeClock()
  engine = makeFakeEngine()
})

describe('createReplaySession — initial state', () => {
  it('starts idle at beat 0', () => {
    const r = createReplaySession({ session: buildSession([]), engine, clock })
    expect(r.getProgress()).toEqual({ state: 'idle', positionBeats: 0, durationBeats: 8 })
  })

  it('subscribe() fires immediately with the current progress', () => {
    const r = createReplaySession({ session: buildSession([]), engine, clock })
    const seen: ReplayProgress[] = []
    r.subscribe((p) => seen.push(p))
    expect(seen).toHaveLength(1)
    expect(seen[0]!.state).toBe('idle')
  })
})

describe('createReplaySession — playback fires events at the right beat', () => {
  it('fires one event at beat 0 immediately on play()', () => {
    const session = buildSession([{ t: 0, type: 'pad_activate', padId: 'drums-1' }])
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(0)
    expect(engine.calls).toEqual([{ method: 'tapLoop', args: ['drums-1'] }])
  })

  it('fires events sequentially at the right ms offsets (120 BPM = 500 ms/beat)', () => {
    const session = buildSession([
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 1, type: 'pad_activate', padId: 'bass-1' },
      { t: 2, type: 'one_shot', padId: 'fx-1' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.play()

    clock.advance(0)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop'])

    clock.advance(500)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop', 'tapLoop'])

    clock.advance(500)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop', 'tapLoop', 'tapOneShot'])
  })

  it('handles every event type', () => {
    const session = buildSession([
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 0, type: 'pad_deactivate', padId: 'drums-1' },
      { t: 0, type: 'one_shot', padId: 'fx-1' },
      { t: 0, type: 'bank_switch', bank: 'B' },
      { t: 0, type: 'fx_bypass_toggle', bank: 'A', blockId: 'block-0' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(0)
    expect(engine.calls.map((c) => c.method)).toEqual([
      'tapLoop',
      'deactivate',
      'tapOneShot',
      'setCurrentBank',
      'toggleFxBypass',
    ])
  })
})

describe('createReplaySession — pause / resume', () => {
  it('pause() halts further events; resume() picks up where we left off', () => {
    const session = buildSession([
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 1, type: 'pad_activate', padId: 'bass-1' },
      { t: 2, type: 'one_shot', padId: 'fx-1' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(0)
    expect(engine.calls).toHaveLength(1)

    clock.advance(250) // halfway to the bass-1 event
    r.pause()
    expect(r.getProgress().state).toBe('paused')
    expect(r.getProgress().positionBeats).toBeCloseTo(0.5, 1)

    clock.advance(10_000) // would have fired everything if not paused
    expect(engine.calls).toHaveLength(1)

    r.play()
    clock.advance(250)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop', 'tapLoop'])

    clock.advance(500)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop', 'tapLoop', 'tapOneShot'])
  })

  it('stop() resets position to 0 and goes idle', () => {
    const session = buildSession([{ t: 0, type: 'pad_activate', padId: 'drums-1' }])
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(250)
    r.stop()
    expect(r.getProgress()).toEqual({
      state: 'idle',
      positionBeats: 0,
      durationBeats: 8,
    })
  })
})

describe('createReplaySession — seek', () => {
  it('seek skips events that have already passed', () => {
    const session = buildSession([
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 4, type: 'pad_activate', padId: 'bass-1' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.seek(2)
    r.play()
    clock.advance(0)
    expect(engine.calls).toEqual([])
    clock.advance(1000) // 2 more beats → reaches beat 4
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop'])
  })

  it('seek clamps to [0, durationBeats]', () => {
    const r = createReplaySession({ session: buildSession([]), engine, clock })
    r.seek(-5)
    expect(r.getProgress().positionBeats).toBe(0)
    r.seek(9999)
    expect(r.getProgress().positionBeats).toBe(8)
  })

  it('seek while paused does not fire events; play() resumes from new position', () => {
    const session = buildSession([
      { t: 4, type: 'pad_activate', padId: 'bass-1' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.seek(4)
    expect(engine.calls).toEqual([])
    r.play()
    clock.advance(0)
    expect(engine.calls.map((c) => c.method)).toEqual(['tapLoop'])
  })
})

describe('createReplaySession — completion', () => {
  it('flips to "completed" after the last event + tail', () => {
    const session = buildSession(
      [{ t: 0, type: 'pad_activate', padId: 'drums-1' }],
      { durationBeats: 4 },
    )
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(2_000) // 4 beats × 500ms
    expect(r.getProgress().state).toBe('completed')
  })

  it('subscribers are notified of completion', () => {
    const session = buildSession([], { durationBeats: 1 })
    const r = createReplaySession({ session, engine, clock })
    const states: string[] = []
    r.subscribe((p) => states.push(p.state))
    r.play()
    clock.advance(500)
    expect(states.includes('completed')).toBe(true)
  })

  it('play() after completion replays from beat 0', () => {
    const session = buildSession(
      [{ t: 0, type: 'pad_activate', padId: 'drums-1' }],
      { durationBeats: 1 },
    )
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(500)
    expect(r.getProgress().state).toBe('completed')
    r.play()
    clock.advance(0)
    expect(engine.calls.length).toBeGreaterThanOrEqual(2) // fired again
  })
})

describe('createReplaySession — empty session', () => {
  it('plays a zero-event session and completes after durationBeats', () => {
    const session = buildSession([], { durationBeats: 2 })
    const r = createReplaySession({ session, engine, clock })
    r.play()
    clock.advance(1_000)
    expect(r.getProgress().state).toBe('completed')
    expect(engine.calls).toEqual([])
  })
})

describe('createReplaySession — dispose', () => {
  it('clears every pending timer', () => {
    const session = buildSession([
      { t: 0, type: 'pad_activate', padId: 'drums-1' },
      { t: 4, type: 'pad_activate', padId: 'bass-1' },
    ])
    const r = createReplaySession({ session, engine, clock })
    r.play()
    expect(clock.pendingCount()).toBeGreaterThan(0)
    r.dispose()
    expect(clock.pendingCount()).toBe(0)
  })

  it('drops listeners after dispose', () => {
    const r = createReplaySession({ session: buildSession([]), engine, clock })
    const listener = vi.fn()
    r.subscribe(listener)
    r.dispose()
    listener.mockClear()
    // Subsequent play() / pause() do nothing because dispose cleared
    // listeners; even if they fire, the listener won't be called.
    r.play()
    expect(listener).not.toHaveBeenCalled()
  })
})
