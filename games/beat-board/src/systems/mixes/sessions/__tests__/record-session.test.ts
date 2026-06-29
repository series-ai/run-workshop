/**
 * MixRecorder unit tests. Drive the recorder against a fake clock and
 * call its observer methods directly. The recorder no longer wraps
 * an engine — it just observes and timestamps. The actual engine is
 * driven by `padGridStore` independently.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createMixRecorder,
  setPadActionObserver,
  notifyPadAction,
  getPadActionObserver,
  type PadActionObserver,
} from '../record-session'

interface FakeClock {
  nowMs: () => number
  bpm: () => number
  advance: (ms: number) => void
  setBpm: (bpm: number) => void
}

function makeFakeClock(initialBpm = 84): FakeClock {
  let now = 0
  let bpm = initialBpm
  return {
    nowMs: () => now,
    bpm: () => bpm,
    advance: (ms) => {
      now += ms
    },
    setBpm: (b) => {
      bpm = b
    },
  }
}

let clock: FakeClock

beforeEach(() => {
  clock = makeFakeClock(84)
  setPadActionObserver(null)
})

afterEach(() => {
  setPadActionObserver(null)
})

describe('createMixRecorder — start/stop lifecycle', () => {
  it('isRecording flips on start and off on stop', () => {
    const r = createMixRecorder({ clock })
    expect(r.isRecording()).toBe(false)
    r.start('kit_alpha')
    expect(r.isRecording()).toBe(true)
    r.stop()
    expect(r.isRecording()).toBe(false)
  })

  it('stop() before start() returns null', () => {
    const r = createMixRecorder({ clock })
    expect(r.stop()).toBeNull()
  })

  it('captures kitId, bpm at start, and createdAtMs', () => {
    const r = createMixRecorder({ clock })
    clock.advance(1_700_000_000_000)
    r.start('kit_alpha')
    const out = r.stop()!
    expect(out.kitId).toBe('kit_alpha')
    expect(out.bpm).toBe(84)
    expect(out.createdAtMs).toBe(1_700_000_000_000)
    expect(out.version).toBe(1)
  })

  it('start() resets the buffer', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    r.onTapLoop('drums-1')
    expect(r.eventCount()).toBe(1)
    r.start('kit_b')
    expect(r.eventCount()).toBe(0)
  })
})

describe('createMixRecorder — event capture', () => {
  it('captures pad_activate at t=0 immediately after start', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    r.onTapLoop('drums-1')
    const out = r.stop()!
    expect(out.events).toHaveLength(1)
    expect(out.events[0]).toMatchObject({ type: 'pad_activate', padId: 'drums-1' })
    expect(out.events[0]!.t).toBeCloseTo(0)
  })

  it('captures bar-relative beat offsets at 84 BPM', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    clock.advance(714) // 1 beat at 84 BPM
    r.onTapLoop('bass-1')
    clock.advance(714 * 2)
    r.onTapOneShot('fx-1')
    const out = r.stop()!
    expect(out.events).toHaveLength(2)
    expect(out.events[0]!.t).toBeCloseTo(1, 2)
    expect(out.events[1]!.t).toBeCloseTo(3, 2)
  })

  it('captures every event type with the right payload', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    r.onTapLoop('drums-1')
    r.onTapOneShot('fx-2')
    r.onDeactivate('drums-1')
    r.onSetCurrentBank('B')
    r.onToggleFxBypass('A', 'block-0')
    const out = r.stop()!
    expect(out.events.map((e) => e.type)).toEqual([
      'pad_activate',
      'one_shot',
      'pad_deactivate',
      'bank_switch',
      'fx_bypass_toggle',
    ])
  })

  it('events come back sorted by t (insertion order is monotonic)', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    r.onTapLoop('drums-1')
    clock.advance(500)
    r.onTapLoop('bass-1')
    clock.advance(500)
    r.onTapOneShot('fx-1')
    const ts = r.stop()!.events.map((e) => e.t)
    expect(ts).toEqual([...ts].sort((a, b) => a - b))
  })

  it('durationBeats reflects the elapsed clock at stop()', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    clock.advance(5714) // 8 beats at 84 BPM
    expect(r.stop()!.durationBeats).toBeCloseTo(8, 1)
  })

  it('uses the BPM that was active at start(), not the current BPM', () => {
    const r = createMixRecorder({ clock })
    clock.setBpm(84)
    r.start('kit_a')
    clock.advance(1000)
    clock.setBpm(120)
    r.onTapLoop('drums-1')
    const out = r.stop()!
    expect(out.bpm).toBe(84)
    expect(out.events[0]!.t).toBeCloseTo(1.4, 2)
  })

  it('observer methods called outside an active run are no-ops', () => {
    const r = createMixRecorder({ clock })
    r.onTapLoop('drums-1')
    expect(r.eventCount()).toBe(0)
    expect(r.isRecording()).toBe(false)
  })
})

describe('observer registration', () => {
  it('setPadActionObserver routes notifyPadAction calls to the observer', () => {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const observer: PadActionObserver = {
      onTapLoop: (padId) => calls.push({ method: 'onTapLoop', args: [padId] }),
      onTapOneShot: (padId) => calls.push({ method: 'onTapOneShot', args: [padId] }),
      onDeactivate: (padId) => calls.push({ method: 'onDeactivate', args: [padId] }),
      onSetCurrentBank: (b) => calls.push({ method: 'onSetCurrentBank', args: [b] }),
      onToggleFxBypass: (b, blk) => calls.push({ method: 'onToggleFxBypass', args: [b, blk] }),
    }
    setPadActionObserver(observer)

    notifyPadAction('onTapLoop', 'drums-1')
    notifyPadAction('onTapOneShot', 'fx-1')
    notifyPadAction('onDeactivate', 'drums-1')
    notifyPadAction('onSetCurrentBank', 'B')
    notifyPadAction('onToggleFxBypass', 'A', 'block-0')

    expect(calls.map((c) => c.method)).toEqual([
      'onTapLoop',
      'onTapOneShot',
      'onDeactivate',
      'onSetCurrentBank',
      'onToggleFxBypass',
    ])
  })

  it('notifyPadAction with no observer is a silent no-op', () => {
    setPadActionObserver(null)
    expect(getPadActionObserver()).toBeNull()
    expect(() => notifyPadAction('onTapLoop', 'drums-1')).not.toThrow()
  })

  it('setPadActionObserver(null) clears the previous observer', () => {
    const calls: string[] = []
    setPadActionObserver({
      onTapLoop: (id) => calls.push(id),
      onTapOneShot: () => {},
      onDeactivate: () => {},
      onSetCurrentBank: () => {},
      onToggleFxBypass: () => {},
    })
    notifyPadAction('onTapLoop', 'drums-1')
    setPadActionObserver(null)
    notifyPadAction('onTapLoop', 'bass-1')
    expect(calls).toEqual(['drums-1'])
  })

  it('a recorder registered as observer captures from notifyPadAction calls', () => {
    const r = createMixRecorder({ clock })
    setPadActionObserver(r)
    r.start('kit_a')
    notifyPadAction('onTapLoop', 'drums-1')
    notifyPadAction('onTapOneShot', 'fx-1')
    const out = r.stop()!
    expect(out.events).toHaveLength(2)
    expect(out.events[0]!.type).toBe('pad_activate')
    expect(out.events[1]!.type).toBe('one_shot')
  })
})

describe('createMixRecorder — empty session', () => {
  it('captures a session with zero events when no actions are taken', () => {
    const r = createMixRecorder({ clock })
    r.start('kit_a')
    clock.advance(2000)
    const out = r.stop()!
    expect(out.events).toEqual([])
    expect(out.durationBeats).toBeCloseTo(2.8, 1)
  })
})
