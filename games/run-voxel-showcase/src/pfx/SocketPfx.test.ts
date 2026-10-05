import { describe, expect, it } from 'vitest'
import { activeBindings, loopWindowOpen, MANUAL_CLIP_FRACTION, ONE_SHOT_REPLAY_SECONDS, oneShotCycle } from './SocketPfx'

const entry = {
  pfx: [
    { effectId: 'web', socket: 'socket-mouth', trigger: 'clip:attack', size: 20 },
    { effectId: 'poison', socket: 'socket-body', trigger: 'clip:death', size: 20 },
    { effectId: 'glow', trigger: 'idle', size: 20 },
  ],
} as const

describe('PFX triggers', () => {
  it('plays idle bindings always and clip bindings only with their clip', () => {
    expect(activeBindings(entry as never, 'attack').map((b) => b.effectId)).toEqual(['web', 'glow'])
    expect(activeBindings(entry as never, 'idle').map((b) => b.effectId)).toEqual(['glow'])
    expect(activeBindings(entry as never, 'death', 'poison').map((b) => b.effectId)).toEqual(['poison'])
  })

  it('fires clip one-shots once per clip cycle at their time', () => {
    const b = { trigger: 'clip:attack', at: 0.4 }
    const clock = (elapsed: number) => ({ elapsed, duration: 1.2 })
    expect(oneShotCycle(b, clock(0.39), 0)).toBe(-1)
    expect(oneShotCycle(b, clock(0.4), 0)).toBe(0)
    expect(oneShotCycle(b, clock(1.59), 0)).toBe(0)
    expect(oneShotCycle(b, clock(1.6), 0)).toBe(1)
    expect(() => oneShotCycle({ trigger: 'clip:attack', at: 2 }, clock(0), 0)).toThrow(/after the/)
  })

  it('runs a clip loop with `at` from that time to the end of each cycle', () => {
    const clock = (elapsed: number) => ({ elapsed, duration: 1.2 })
    const b = { trigger: 'clip:attack', at: 0.4 }
    expect(loopWindowOpen(b, clock(0.39))).toBe(false)
    expect(loopWindowOpen(b, clock(0.4))).toBe(true)
    expect(loopWindowOpen(b, clock(1.19))).toBe(true)
    expect(loopWindowOpen(b, clock(1.3))).toBe(false)
    expect(loopWindowOpen({ trigger: 'clip:attack' }, clock(0))).toBe(true)
    expect(loopWindowOpen(b, null)).toBe(true)
    expect(() => loopWindowOpen({ trigger: 'clip:attack', at: 2 }, clock(0))).toThrow(/after the/)
  })

  it('fires manual one-shots at every strike of a multi-shot clip, once per strike', () => {
    const clock = (elapsed: number) => ({ elapsed, duration: 1, strikes: [0.05, 0.45, 0.85] })
    expect(oneShotCycle({ trigger: 'manual' }, clock(0.04), 0)).toBe(-1)
    expect(oneShotCycle({ trigger: 'manual' }, clock(0.05), 0)).toBe(0)
    expect(oneShotCycle({ trigger: 'manual' }, clock(0.5), 0)).toBe(1)
    expect(oneShotCycle({ trigger: 'manual' }, clock(0.9), 0)).toBe(2)
    expect(oneShotCycle({ trigger: 'manual' }, clock(1.06), 0)).toBe(3)
    expect(oneShotCycle({ trigger: 'manual' }, clock(2.46), 0)).toBe(7)
  })

  it('times manual one-shots to an action clip, or to a timer without one', () => {
    const at = 1 * MANUAL_CLIP_FRACTION
    expect(oneShotCycle({ trigger: 'manual' }, { elapsed: at - 0.01, duration: 1 }, 0)).toBe(-1)
    expect(oneShotCycle({ trigger: 'manual' }, { elapsed: at, duration: 1 }, 0)).toBe(0)
    expect(oneShotCycle({ trigger: 'manual' }, null, ONE_SHOT_REPLAY_SECONDS * 2.5)).toBe(2)
    expect(oneShotCycle({ trigger: 'idle' }, { elapsed: 5, duration: 1 }, 0)).toBe(0)
  })
})
