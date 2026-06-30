/**
 * Integration test — `src/audio/beat-clock.ts`
 *
 * Issue beat-board-03-audio-engine-and-beat-sequencer. Asserts BPM range,
 * bar/beat callback ordering, BPM hot-swap preserving the in-flight bar,
 * `secondsPerBar` math, and `juice/feedback-channel` `beat` channel mirror.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BEAT_FEEDBACK_CHANNEL,
  BEATS_PER_BAR,
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
  createBeatClock,
  getBeatClock,
  secondsPerBar,
  __resetBeatClock,
} from '../../src/audio/beat-clock'
import {
  getGlobalFeedbackBus,
  resetGlobalFeedbackBus,
} from '@modules/juice/feedback-channel/FeedbackChannel'

beforeEach(() => {
  __resetBeatClock()
  resetGlobalFeedbackBus()
})

afterEach(() => {
  __resetBeatClock()
  resetGlobalFeedbackBus()
})

describe('secondsPerBar()', () => {
  it('matches the prd.md formula (60/bpm)*4 at 4/4 meter', () => {
    expect(secondsPerBar(60)).toBeCloseTo(4, 6) // 1 bar/sec at 60 bpm × 4 beats
    expect(secondsPerBar(84)).toBeCloseTo((60 / 84) * 4, 6)
    expect(secondsPerBar(120)).toBeCloseTo(2, 6)
    expect(secondsPerBar(240)).toBeCloseTo(1, 6)
  })

  it('rejects BPM outside the 40–240 range', () => {
    expect(() => secondsPerBar(39)).toThrow(/range/i)
    expect(() => secondsPerBar(241)).toThrow(/range/i)
    expect(() => secondsPerBar(NaN)).toThrow(/finite/i)
  })

  it('accepts both endpoints of the supported range', () => {
    expect(() => secondsPerBar(MIN_BPM)).not.toThrow()
    expect(() => secondsPerBar(MAX_BPM)).not.toThrow()
  })
})

describe('createBeatClock() — beat / bar callback ordering at 84 BPM', () => {
  it('fires onBeat 4× and onBar 1× per bar; bar fires after the 4th beat of that bar', () => {
    const clock = createBeatClock(84)
    const events: string[] = []
    clock.subscribeBeat((beat, bar) => {
      events.push(`beat:${bar}.${beat}`)
    })
    clock.subscribeBar((bar) => {
      events.push(`bar:${bar}`)
    })

    clock.start()
    // Advance just past one bar — floating-point math at 84 bpm makes
    // `(60/84)*4` round below the 4th tick boundary, so we add an epsilon
    // smaller than a single beat to guarantee the bar wrap fires.
    clock.update(secondsPerBar(84) + 1e-6)

    // Beat boundaries cross at ticks 1..4. The 4th tick wraps to bar 1,
    // beat 0; in the same tick the bar boundary fires.
    // beat callback fires when the *new* beat number differs from prev.
    // Sequence: bar 0 beat 1, bar 0 beat 2, bar 0 beat 3, bar 1 beat 0,
    // and the bar boundary fires at the same tick as the last beat.
    const beats = events.filter((e) => e.startsWith('beat:'))
    const bars = events.filter((e) => e.startsWith('bar:'))
    expect(beats).toHaveLength(BEATS_PER_BAR)
    expect(bars).toHaveLength(1)
    // Last event in this update should be the bar — bar event is queued
    // *after* the beat that triggered the bar wrap.
    expect(events[events.length - 1]).toBe('bar:1')
  })

  it('counts beats relative to bar (0..3) and increments bar on wrap', () => {
    const clock = createBeatClock(120) // 2 sec/bar
    const beatLog: Array<[number, number]> = []
    clock.subscribeBeat((beat, bar) => beatLog.push([bar, beat]))
    clock.start()
    // 2 bars at 120 bpm = 4 sec. Advance in fine-grained steps so jsdom
    // doesn't have trouble with monolithic dt values.
    for (let i = 0; i < 8; i++) {
      clock.update(0.5)
    }
    expect(beatLog.length).toBeGreaterThanOrEqual(2 * BEATS_PER_BAR)
    // bar 0: beats 1,2,3 then wrap to bar 1 beat 0
    expect(beatLog[0]).toEqual([0, 1])
    expect(beatLog[1]).toEqual([0, 2])
    expect(beatLog[2]).toEqual([0, 3])
    expect(beatLog[3]).toEqual([1, 0])
    // bar 1: beats 1,2,3 then wrap to bar 2 beat 0
    expect(beatLog[4]).toEqual([1, 1])
    expect(beatLog[7]).toEqual([2, 0])
  })
})

describe('createBeatClock() — BPM hot-swap', () => {
  it('clamps setBpm() to [40, 240]', () => {
    const clock = createBeatClock(120)
    expect(() => clock.setBpm(39)).toThrow(/range/i)
    expect(() => clock.setBpm(241)).toThrow(/range/i)
  })

  it('rebuilds the underlying sequencer at the new tempo', () => {
    const clock = createBeatClock(60)
    expect(clock.getBpm()).toBe(60)
    expect(clock.secondsPerBar()).toBeCloseTo(4, 6)
    clock.setBpm(120)
    expect(clock.getBpm()).toBe(120)
    expect(clock.secondsPerBar()).toBeCloseTo(2, 6)
  })

  it('preserves in-flight bar position across a BPM change (does not lose progress)', () => {
    // Acceptance: "BPM change recomputes timing without losing the in-flight bar".
    // At 60 bpm we play 1 second (= 1 beat = 25% through the bar). After a
    // hot-swap to 120 bpm, the clock should resume at the same fractional
    // offset within the bar — *not* restart from zero. We assert the
    // remaining bar time at the new tempo equals the *expected* remainder
    // (75% × 2 sec = 1.5 sec) rather than a full bar (which would mean we
    // lost the carry).
    const clock = createBeatClock(60)
    clock.start()

    clock.update(1.0) // 1 beat at 60 bpm = 25% of bar
    const remainingAtOldTempo = clock.nextBarTimeFromNow()
    // 75% × 4 sec = 3 sec remain at 60 bpm
    expect(remainingAtOldTempo).toBeCloseTo(3, 5)

    // Hot-swap to 120 bpm — carry the 25% phase into the new bar.
    clock.setBpm(120)

    const remainingAtNewTempo = clock.nextBarTimeFromNow()
    // 75% × 2 sec = 1.5 sec — the *fractional* position survived the swap.
    // If carry had been dropped, this would be 2 sec (a fresh bar).
    expect(remainingAtNewTempo).toBeCloseTo(1.5, 1)
    expect(remainingAtNewTempo).toBeLessThan(2) // strictly less than a full bar
  })
})

describe('createBeatClock() — feedback channel mirror', () => {
  it('emits every beat into the global juice/feedback-channel `beat` channel', () => {
    const clock = createBeatClock(120)
    const bus = getGlobalFeedbackBus()
    const observed: Array<{ beat?: number; bar?: number; bpm?: number }> = []
    bus.on(BEAT_FEEDBACK_CHANNEL, (event) => {
      observed.push({
        beat: event['beat'] as number | undefined,
        bar: event['bar'] as number | undefined,
        bpm: event['bpm'] as number | undefined,
      })
    })

    clock.start()
    clock.update(secondsPerBar(120) + 1e-6) // 1 bar = 4 beats (epsilon for FP)

    expect(observed).toHaveLength(BEATS_PER_BAR)
    expect(observed[0]).toEqual({ beat: 1, bar: 0, bpm: 120 })
    expect(observed[3]).toEqual({ beat: 0, bar: 1, bpm: 120 })
  })

  it('mirrors the new BPM after a hot-swap', () => {
    const clock = createBeatClock(120)
    const bus = getGlobalFeedbackBus()
    const seenBpms = new Set<number>()
    bus.on(BEAT_FEEDBACK_CHANNEL, (event) => {
      seenBpms.add(event['bpm'] as number)
    })

    clock.start()
    clock.update(secondsPerBar(120))
    clock.setBpm(60)
    clock.update(secondsPerBar(60))

    expect(seenBpms.has(120)).toBe(true)
    expect(seenBpms.has(60)).toBe(true)
  })
})

describe('createBeatClock() — nextBarTimeFromNow()', () => {
  it('returns a full bar at start and decreases as time elapses', () => {
    const clock = createBeatClock(120) // 2 sec/bar
    expect(clock.nextBarTimeFromNow()).toBeCloseTo(2, 5)
    clock.start()
    clock.update(0.5) // 1 beat in
    const remaining = clock.nextBarTimeFromNow()
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(2)
    expect(remaining).toBeCloseTo(1.5, 5)
  })
})

describe('getBeatClock() singleton', () => {
  it('returns the same instance across calls', () => {
    const a = getBeatClock()
    const b = getBeatClock()
    expect(a).toBe(b)
  })

  it('seeds the singleton at DEFAULT_BPM', () => {
    expect(getBeatClock().getBpm()).toBe(DEFAULT_BPM)
  })
})

describe('reset()', () => {
  it('stops and rewinds the clock to bar 0 / beat 0', () => {
    const clock = createBeatClock(120)
    const beats: Array<[number, number]> = []
    clock.subscribeBeat((beat, bar) => beats.push([bar, beat]))
    clock.start()
    clock.update(secondsPerBar(120) * 1.25) // 5 beats
    expect(beats.length).toBeGreaterThanOrEqual(5)

    const beforeReset = beats.length
    clock.reset()
    expect(clock.isActive()).toBe(false)

    clock.start()
    clock.update(secondsPerBar(120)) // exactly one bar from zero again
    const newBeats = beats.slice(beforeReset)
    expect(newBeats[0]).toEqual([0, 1])
  })
})
