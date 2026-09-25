import { describe, expect, it } from 'vitest'
import { createVoidFlakeGeometry } from './ProceduralFlake'

describe('ProceduralFlake geometry generator', () => {
  it('generates non-indexed instanced geometry with position, normal, aBary, and aFlake', () => {
    const geom = createVoidFlakeGeometry({ sides: 6, capacity: 64 })
    expect(geom.attributes.position).toBeDefined()
    expect(geom.attributes.normal).toBeDefined()
    expect(geom.attributes.aBary).toBeDefined()
    expect(geom.attributes.aFlake).toBeDefined()
    expect(geom.instanceCount).toBe(64)
    // 6 sides * 2 triangles = 12 triangles * 3 vertices = 36 vertices
    expect(geom.attributes.position.count).toBe(36)
  })

  it('evaluates deterministically for identical seeds', () => {
    const g1 = createVoidFlakeGeometry({ seed: 42, sides: 5 })
    const g2 = createVoidFlakeGeometry({ seed: 42, sides: 5 })
    const pos1 = Array.from(g1.attributes.position.array)
    const pos2 = Array.from(g2.attributes.position.array)
    expect(pos1).toEqual(pos2)
  })

  it('cycles barycentric coordinates correctly across triangle corners', () => {
    const geom = createVoidFlakeGeometry({ sides: 4 })
    const bary = geom.attributes.aBary.array
    // Vertex 0: [1, 0, 0]
    expect([bary[0], bary[1], bary[2]]).toEqual([1, 0, 0])
    // Vertex 1: [0, 1, 0]
    expect([bary[3], bary[4], bary[5]]).toEqual([0, 1, 0])
    // Vertex 2: [0, 0, 1]
    expect([bary[6], bary[7], bary[8]]).toEqual([0, 0, 1])
  })
})
