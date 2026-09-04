import { BoxGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { DIE_KINDS } from './kinds'
import { dieRestHeight, dieVertices, extractFaceClusters, facesForDie } from './geometry'

describe('facesForDie', () => {
  it('emits one face per side for every kind', () => {
    for (const kind of DIE_KINDS) {
      const faces = facesForDie(kind, 1)
      expect(faces, `d${kind}`).toHaveLength(kind)
      expect(new Set(faces.map((f) => f.value)).size).toBe(kind)
    }
  })

  it('pairs opposites to N+1 on even kinds', () => {
    for (const kind of [6, 8, 10, 12, 20] as const) {
      const faces = facesForDie(kind, 1)
      for (const f of faces) {
        const opposite = faces.reduce((best, g) =>
          f.normal.dot(g.normal) < f.normal.dot(best.normal) ? g : best,
        )
        expect(f.value + opposite.value, `d${kind} value ${f.value}`).toBe(kind + 1)
      }
    }
  })

  it('clusters BoxGeometry triangles into 6 faces', () => {
    const geom = new BoxGeometry(1, 1, 1)
    expect(extractFaceClusters(geom)).toHaveLength(6)
    geom.dispose()
  })
})

describe('dieVertices', () => {
  it('returns the eight corners of a cube, scaled', () => {
    const v = dieVertices(6, 0.3)
    expect(v).toHaveLength(8)
    for (const p of v) {
      expect(Math.abs(p.x)).toBeCloseTo(0.3, 6)
      expect(Math.abs(p.y)).toBeCloseTo(0.3, 6)
      expect(Math.abs(p.z)).toBeCloseTo(0.3, 6)
    }
  })

  it('gives every kind a contact set', () => {
    for (const kind of DIE_KINDS) {
      expect(dieVertices(kind, 1).length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('dieRestHeight', () => {
  it('is the half-size for a cube', () => {
    expect(dieRestHeight(6, 0.3)).toBeCloseTo(0.3, 6)
  })

  it('sits below the circumradius for the rounder solids', () => {
    for (const kind of DIE_KINDS) {
      const h = dieRestHeight(kind, 1)
      expect(h).toBeGreaterThan(0)
      expect(h).toBeLessThanOrEqual(1 + 1e-9)
      if (kind !== 6) expect(h).toBeLessThan(1)
    }
  })
})
