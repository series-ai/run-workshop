import { describe, expect, it } from 'vitest'
import { startToss, stepToss, TossBody, TossOptions, TossVec } from './toss'

// Unit cube corners: the contact set for a d6 of half-size 0.3.
const CUBE: TossVec[] = []
for (const x of [-0.3, 0.3]) {
  for (const y of [-0.3, 0.3]) {
    for (const z of [-0.3, 0.3]) CUBE.push({ x, y, z })
  }
}

const OPTS: TossOptions = {
  tableY: 0,
  vertices: CUBE,
  inertia: (2 / 3) * 0.3 * 0.3,
}

function fallingBody(y: number): TossBody {
  return {
    position: { x: 0, y, z: 0 },
    velocity: { x: 0, y: -5, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    settled: false,
    bounces: 0,
    restTime: 0,
  }
}

describe('stepToss', () => {
  it('rejects non-positive dt', () => {
    expect(() => stepToss(fallingBody(1), 0, OPTS)).toThrow(/dt/)
  })

  it('rejects an empty contact set', () => {
    expect(() => stepToss(fallingBody(1), 1 / 60, { ...OPTS, vertices: [] })).toThrow(/vertex/)
  })

  it('bounces the body back up off the table', () => {
    const body = fallingBody(0.28)
    stepToss(body, 1 / 60, OPTS)
    expect(body.position.y).toBeGreaterThanOrEqual(0.3 - 1e-9)
    expect(body.velocity.y).toBeGreaterThan(0)
    expect(body.bounces).toBeGreaterThan(0)
  })

  it('spins up when it lands on a corner', () => {
    const body = fallingBody(0.4)
    // Tilted so one corner reaches the table well before the others.
    const a = Math.PI / 5
    body.quaternion = { x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) }
    for (let i = 0; i < 20; i++) stepToss(body, 1 / 120, OPTS)
    const spin = Math.hypot(
      body.angularVelocity.x,
      body.angularVelocity.y,
      body.angularVelocity.z,
    )
    expect(spin).toBeGreaterThan(0.1)
  })

  it('comes to rest flat on a face', () => {
    const body = startToss({ homeX: 0, homeZ: 0, height: 0.3, rng: () => 0.5 })
    for (let i = 0; i < 2400 && !body.settled; i++) stepToss(body, 1 / 120, OPTS)
    expect(body.settled).toBe(true)
    // Resting flat puts the lowest corners exactly on the table.
    expect(body.position.y).toBeGreaterThan(0.28)
    expect(body.position.y).toBeLessThan(0.53)
  })

  it('rebounds off the bounds instead of leaving the table', () => {
    const body = fallingBody(0.5)
    body.velocity = { x: 14, y: 0, z: 0 }
    for (let i = 0; i < 90; i++) stepToss(body, 1 / 120, { ...OPTS, bounds: 1.2 })
    expect(Math.abs(body.position.x)).toBeLessThanOrEqual(1.2 + 1e-6)
  })
})
