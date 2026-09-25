import { describe, expect, it } from 'vitest'
import { createCrystalGeometry, createShardGeometry, hash11 } from './ProceduralCrystal'

describe('ProceduralCrystal', () => {
  it('generates a 60-triangle faceted crystal geometry with 180 vertices', () => {
    const geo = createCrystalGeometry({ seed: 42, sides: 6 })
    const pos = geo.getAttribute('position')
    expect(pos).toBeDefined()
    expect(pos.count).toBe(180) // 60 triangles * 3 vertices
    expect(geo.userData['pfxTriangleCount']).toBe(60)

    const normals = geo.getAttribute('normal')
    expect(normals).toBeDefined()
    expect(normals.count).toBe(180)
  })

  it('guarantees deterministic geometry generation given identical seed', () => {
    const geo1 = createCrystalGeometry({ seed: 12345, sides: 6, roughness: 0.3 })
    const geo2 = createCrystalGeometry({ seed: 12345, sides: 6, roughness: 0.3 })

    const pos1 = geo1.getAttribute('position').array as Float32Array
    const pos2 = geo2.getAttribute('position').array as Float32Array

    expect(pos1.length).toBe(pos2.length)
    for (let i = 0; i < pos1.length; i++) {
      expect(pos1[i]).toBeCloseTo(pos2[i], 5)
    }
  })

  it('generates distinct geometries for different seeds', () => {
    const geo1 = createCrystalGeometry({ seed: 1, sides: 6 })
    const geo2 = createCrystalGeometry({ seed: 2, sides: 6 })

    const pos1 = geo1.getAttribute('position').array as Float32Array
    const pos2 = geo2.getAttribute('position').array as Float32Array

    let identical = true
    for (let i = 0; i < pos1.length; i++) {
      if (Math.abs(pos1[i] - pos2[i]) > 0.001) {
        identical = false
        break
      }
    }
    expect(identical).toBe(false)
  })

  it('generates valid low-profile shard geometries', () => {
    const shard = createShardGeometry(7, 5)
    const pos = shard.getAttribute('position')
    expect(pos.count).toBe(5 * 2 * 4 * 3 + 5 * 3 + 5 * 3) // 5 sides -> 50 triangles = 150 vertices
    expect(shard.boundingBox).toBeDefined()
  })

  it('computes deterministic scalar hash11 in [0, 1)', () => {
    const h1 = hash11(3.14159)
    const h2 = hash11(3.14159)
    expect(h1).toBe(h2)
    expect(h1).toBeGreaterThanOrEqual(0)
    expect(h1).toBeLessThan(1)
  })
})
