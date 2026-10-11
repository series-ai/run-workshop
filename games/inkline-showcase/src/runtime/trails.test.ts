import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { InkTrails } from './trails'

describe('bounded motion ribbons', () => {
  it('renders an explicit long shot without weakening sweep teleport protection', () => {
    const trails = new InkTrails()
    trails.line(3, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 18 }, { x: .02, y: 0, z: 0 }, 1)
    trails.update(1)
    expect(trails.activeCount).toBe(1)
    expect(trails.triangleCount).toBe(4)
    const mesh = trails.group.children[0] as THREE.Mesh
    const position = mesh.geometry.getAttribute('position')
    expect(position.getZ(2)).toBe(18)
    expect((mesh.material as THREE.MeshBasicMaterial).forceSinglePass).toBe(true)
    trails.update(1.076)
    expect(trails.activeCount).toBe(0)
    expect(trails.triangleCount).toBe(0)
    trails.dispose()
  })
  it('uses actual anchor paths and expires without replacing geometry', () => {
    const trails = new InkTrails()
    const mesh = trails.group.children[0] as THREE.Mesh
    const geometry = mesh.geometry
    trails.sample(0, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0)
    trails.sample(0, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, .03)
    trails.update(.03)
    expect(trails.activeCount).toBe(1)
    expect(trails.triangleCount).toBe(4)
    expect(geometry.attributes.position.getX(2)).toBe(1)
    trails.update(.22)
    expect(trails.activeCount).toBe(0)
    expect(trails.triangleCount).toBe(0)
    expect(mesh.geometry).toBe(geometry)
    trails.dispose()
  })

  it('keeps four continuous paths within the fixed triangle budget', () => {
    const trails = new InkTrails()
    for (let i = 0; i < 1000; i++) for (let slot = 0; slot < 4; slot++) {
      trails.sample(slot, { x: i * .01, y: slot, z: 0 }, { x: i * .01, y: slot + 1, z: 0 }, i / 1000)
    }
    trails.update(1)
    expect(trails.activeCount).toBe(4)
    expect(trails.triangleCount).toBe(240)
    const geometry = (trails.group.children[0] as THREE.Mesh).geometry
    expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true)
    const color = geometry.attributes.color
    for (let i = 0; i < color.count; i++) expect(color.getW(i)).toBeGreaterThanOrEqual(0)
    trails.dispose()
  })

  it('starts a new path after a teleport or a backward seek', () => {
    const trails = new InkTrails()
    trails.sample(0, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 1)
    trails.sample(0, { x: .5, y: 0, z: 0 }, { x: .5, y: 1, z: 0 }, 1.01)
    trails.sample(0, { x: 20, y: 0, z: 0 }, { x: 20, y: 1, z: 0 }, 1.02)
    trails.update(1.02)
    expect(trails.triangleCount).toBe(0)
    trails.sample(0, { x: 20.2, y: 0, z: 0 }, { x: 20.2, y: 1, z: 0 }, .5)
    trails.update(.5)
    expect(trails.triangleCount).toBe(0)
    trails.dispose()
  })

  it('clears at reset and validates external samples', () => {
    const trails = new InkTrails(), point = { x: 0, y: 0, z: 0 }
    expect(() => trails.sample(4, point, point, 0)).toThrow('index')
    expect(() => trails.sample(0, point, point, NaN)).toThrow('finite')
    expect(() => trails.sample(0, point, point, 0, '#151716', 1)).toThrow('lifetime')
    trails.clear()
    expect(trails.activeCount).toBe(0)
    trails.dispose()
    expect(() => trails.sample(0, point, point, 0)).toThrow('disposed')
  })
})
