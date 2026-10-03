import { describe, expect, it } from 'vitest'
import { ONE_SHOT_HOLD, ONE_SHOT_REST, ONE_SHOT_RETURN, oneShotCycle, oneShotPose } from './PackModel'

describe('one-shot clip playback', () => {
  const d = 0.5
  const period = d + ONE_SHOT_HOLD + ONE_SHOT_RETURN + ONE_SHOT_REST

  it('plays once, holds the end pose, blends home, rests, then repeats', () => {
    expect(oneShotCycle(d).period).toBeCloseTo(period, 9)
    expect(oneShotPose(d, 0.25)).toEqual({ time: 0.25, weight: 1 })
    expect(oneShotPose(d, d + 0.5)).toEqual({ time: d, weight: 1 }) // holding
    expect(oneShotPose(d, d + ONE_SHOT_HOLD + ONE_SHOT_RETURN / 2).weight).toBeCloseTo(0.5, 9) // blending home
    expect(oneShotPose(d, period - 0.01).weight).toBe(0) // resting at the start pose
    expect(oneShotPose(d, period + 0.25)).toEqual({ time: 0.25, weight: 1 }) // the next cycle
  })

  it('never jumps: the shown pose changes by small steps across whole cycles', () => {
    // The shown pose blends the clip at `time` (weight) with its first frame (1 - weight),
    // so weight × time tracks it: 0 is the first frame, d the end pose.
    const shown = (t: number) => {
      const { time, weight } = oneShotPose(d, t)
      return weight * time
    }
    for (let t = 1 / 60; t < 3 * period; t += 1 / 60) expect(Math.abs(shown(t) - shown(t - 1 / 60))).toBeLessThan(0.05)
  })
})
