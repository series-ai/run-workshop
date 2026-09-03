import { BoxGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { DIE_KINDS } from './kinds'
import { extractFaceClusters, facesForDie } from './geometry'

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
