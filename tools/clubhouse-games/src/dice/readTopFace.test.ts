import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { readTopFace, restQuaternion, snapToFace } from './readTopFace'

describe('readTopFace d6', () => {
  it('reads 3 on identity (py up)', () => {
    expect(readTopFace(6, new THREE.Quaternion())).toBe(3)
  })

  it('reads 1 after Rx(-π/2) (pz up)', () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    expect(readTopFace(6, q)).toBe(1)
  })

  it('reads 6 after Rx(+π/2) (nz up)', () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
    expect(readTopFace(6, q)).toBe(6)
  })
})

const D6_LOCAL: Record<number, [number, number, number]> = {
  1: [0, 0, 1],
  2: [1, 0, 0],
  3: [0, 1, 0],
  4: [0, -1, 0],
  5: [-1, 0, 0],
  6: [0, 0, -1],
}

describe('restQuaternion d6', () => {
  it('round-trips through Euler XYZ (R3F rotation prop)', () => {
    for (let v = 1; v <= 6; v++) {
      const rest = restQuaternion(6, v, 0)
      const euler = new THREE.Euler().setFromQuaternion(rest, 'XYZ')
      const q = new THREE.Quaternion().setFromEuler(euler)
      expect(readTopFace(6, q), `value ${v}`).toBe(v)
    }
  })

  it('puts each value 1-6 on +Y', () => {
    const up = new THREE.Vector3(0, 1, 0)
    for (let v = 1; v <= 6; v++) {
      const q = restQuaternion(6, v, 0)
      expect(readTopFace(6, q), `value ${v}`).toBe(v)
      const n = new THREE.Vector3(...D6_LOCAL[v]).applyQuaternion(q)
      expect(n.dot(up), `value ${v} alignment`).toBeGreaterThan(0.99)
    }
  })
})

describe('snapToFace d6', () => {
  it('puts the winning face exactly on +Y', () => {
    const up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < 16; i++) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(i * 0.7, i * 1.1, i * 0.3),
      )
      const snapped = snapToFace(6, q)
      const value = readTopFace(6, snapped)
      const world = new THREE.Vector3(...D6_LOCAL[value]).applyQuaternion(snapped)
      expect(world.dot(up)).toBeGreaterThan(0.99)
      expect(readTopFace(6, snapped)).toBe(value)
    }
  })
})

describe('readTopFace polyhedra', () => {
  it('returns a value in 1..N for identity', () => {
    for (const kind of [4, 8, 10, 12, 20] as const) {
      const v = readTopFace(kind, new THREE.Quaternion())
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(kind)
    }
  })
})
