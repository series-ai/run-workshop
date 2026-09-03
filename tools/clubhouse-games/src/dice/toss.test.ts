import { describe, expect, it } from 'vitest'
import { startToss, stepToss, TossBody } from './toss'

function stillBody(y: number): TossBody {
  return {
    position: { x: 0, y, z: 0 },
    velocity: { x: 0, y: -5, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    settled: false,
    bounces: 0,
  }
}

describe('stepToss', () => {
  it('rejects non-positive dt', () => {
    expect(() => stepToss(stillBody(1), 0, { restY: 0.3, radius: 0.3 })).toThrow(/dt/)
  })

  it('reverses vertical velocity on table contact', () => {
    const body = stillBody(0.2)
    stepToss(body, 1 / 60, { restY: 0.3, radius: 0.3, restitution: 0.5 })
    expect(body.position.y).toBe(0.3)
    expect(body.velocity.y).toBeGreaterThan(0)
    expect(body.bounces).toBe(1)
  })

  it('settles after energy drops', () => {
    const body = startToss(0, 0, 0.3, () => 0.5)
    for (let i = 0; i < 720; i++) {
      stepToss(body, 1 / 60, { restY: 0.3, radius: 0.3 })
    }
    expect(body.settled).toBe(true)
    expect(body.position.y).toBeCloseTo(0.3, 5)
    expect(body.bounces).toBeGreaterThan(0)
  })

  it('keeps the die near home', () => {
    const body = stillBody(0.5)
    body.position.x = 0
    body.velocity.x = 12
    body.velocity.y = 0
    for (let i = 0; i < 30; i++) {
      stepToss(body, 1 / 60, { restY: 0.3, radius: 0.3, homeX: 0, homeZ: 0, maxDist: 1.15 })
    }
    expect(Math.hypot(body.position.x, body.position.z)).toBeLessThanOrEqual(1.16)
  })
})
