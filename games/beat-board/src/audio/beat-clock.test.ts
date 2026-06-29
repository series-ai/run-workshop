/**
 * beat-clock — focused unit tests.
 *
 * The full sequencer behaviour is exercised by the recording-capture and
 * pad-grid-engine acceptance tests; this file pins the small helpers
 * (`nextBarFromNow`, `nextEighthNoteFromNow`) so the bar-aligned timing
 * contract used by the Pad-Grid Engine doesn't regress silently.
 */
import { afterEach, describe, it, expect } from 'vitest'
import {
  createBeatClock,
  secondsPerBar,
  DEFAULT_BPM,
  __resetBeatClock,
} from './beat-clock'

describe('beat-clock helpers', () => {
  afterEach(() => {
    __resetBeatClock()
  })

  it('secondsPerBar(84) is the four-beat duration at 84 BPM', () => {
    // 60 seconds / 84 BPM × 4 beats per bar ≈ 2.857 s per bar
    expect(secondsPerBar(84)).toBeCloseTo((60 / 84) * 4, 5)
  })

  it('a fresh clock reports a full bar remaining until the next bar boundary', () => {
    const clock = createBeatClock(DEFAULT_BPM)
    // No update() yet — the sequencer is at beat 0 / phase 0, so the entire
    // bar lies ahead.
    expect(clock.nextBarFromNow()).toBeCloseTo(secondsPerBar(DEFAULT_BPM), 5)
  })

  it('nextBarFromNow shrinks as time advances within the current bar', () => {
    const clock = createBeatClock(DEFAULT_BPM)
    clock.start()
    const bar = secondsPerBar(DEFAULT_BPM)
    // Advance by half a bar.
    clock.update(bar / 2)
    expect(clock.nextBarFromNow()).toBeCloseTo(bar / 2, 4)
  })

  it('nextBarFromNow stays positive and bounded by one bar after crossing a boundary', () => {
    const clock = createBeatClock(DEFAULT_BPM)
    clock.start()
    const bar = secondsPerBar(DEFAULT_BPM)
    // Cross the bar boundary by a small overshoot — the helper must always
    // report a positive remainder ≤ one bar.
    clock.update(bar + 0.01)
    const remaining = clock.nextBarFromNow()
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(bar + 1e-6)
  })

  it('nextEighthNoteFromNow stays reserved for the FX phase but still works', () => {
    // Phase 1 routes pad activation / fade timing through nextBarFromNow.
    // The eighth-note helper remains exported for the Phase 3 FX engine
    // (continuous filter sweeps / XY-pad smoothing). Pin the surface so
    // the FX work doesn't have to re-prove the contract.
    const clock = createBeatClock(DEFAULT_BPM)
    const eighth = secondsPerBar(DEFAULT_BPM) / 8
    expect(clock.nextEighthNoteFromNow()).toBeCloseTo(eighth, 4)
  })
})
