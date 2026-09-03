import { describe, expect, it } from 'vitest'
import {
  levelness,
  startToss,
  stepToss,
  TossBody,
  TossOptions,
  TossQuat,
  TossVec,
} from './toss'

// Unit cube corners: the contact set for a d6 of half-size 0.3.
const CUBE: TossVec[] = []
for (const x of [-0.3, 0.3]) {
  for (const y of [-0.3, 0.3]) {
    for (const z of [-0.3, 0.3]) CUBE.push({ x, y, z })
  }
}

// The six face normals of that cube.
const CUBE_NORMALS: TossVec[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

const OPTS: TossOptions = {
  tableY: 0,
  vertices: CUBE,
  faceNormals: CUBE_NORMALS,
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
    contactTime: 0,
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
    // A cube lying flat has its center exactly one half-size above the table.
    expect(body.position.y).toBeCloseTo(0.3, 3)
  })

  it('is exactly level once it sleeps, from any starting tilt', () => {
    for (let seed = 0; seed < 12; seed++) {
      let s = seed * 7 + 1
      const rng = () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 0x100000000
      }
      const body = startToss({ homeX: 0, homeZ: 0, height: 0.3, rng })
      for (let i = 0; i < 4000 && !body.settled; i++) stepToss(body, 1 / 120, OPTS)
      expect(body.settled).toBe(true)
      expect(levelness(body, CUBE_NORMALS).dot).toBeGreaterThan(0.99999)
    }
  })

  it('tips a die resting on an edge down onto a face', () => {
    const body = fallingBody(0.42)
    body.velocity = { x: 0, y: -0.2, z: 0 }
    // Rolled 30 degrees, so it lands on an edge rather than a face.
    const a = Math.PI / 6
    body.quaternion = { x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) }
    for (let i = 0; i < 900 && !body.settled; i++) stepToss(body, 1 / 120, OPTS)
    expect(body.settled).toBe(true)
    expect(levelness(body, CUBE_NORMALS).dot).toBeGreaterThan(0.99999)
  })

  it('rebounds off the bounds instead of leaving the table', () => {
    const body = fallingBody(0.5)
    body.velocity = { x: 14, y: 0, z: 0 }
    for (let i = 0; i < 90; i++) stepToss(body, 1 / 120, { ...OPTS, bounds: 1.2 })
    expect(Math.abs(body.position.x)).toBeLessThanOrEqual(1.2 + 1e-6)
  })
})

// The complaint this guards: the die used to be declared asleep while still
// tilted, and was then rotated onto a face in one visible jump.
describe('settling continuity', () => {
  function angleBetween(a: TossQuat, b: TossQuat): number {
    const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
    return 2 * Math.acos(Math.min(1, d))
  }

  it('never turns the die more than a degree in a single step', () => {
    for (let seed = 0; seed < 12; seed++) {
      let s = seed * 13 + 5
      const rng = () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 0x100000000
      }
      const body = startToss({ homeX: 0, homeZ: 0, height: 0.3, rng })
      let prev = { ...body.quaternion }
      let slowestStepsMax = 0
      for (let i = 0; i < 4000 && !body.settled; i++) {
        stepToss(body, 1 / 120, OPTS)
        const spin = Math.hypot(
          body.angularVelocity.x,
          body.angularVelocity.y,
          body.angularVelocity.z,
        )
        // Only the tail of the throw matters; a fast tumble turns a lot per
        // step and is supposed to.
        if (spin < 1) {
          slowestStepsMax = Math.max(slowestStepsMax, angleBetween(prev, body.quaternion))
        }
        prev = { ...body.quaternion }
      }
      expect(body.settled).toBe(true)
      expect(slowestStepsMax).toBeLessThan(Math.PI / 180)
    }
  })
})
