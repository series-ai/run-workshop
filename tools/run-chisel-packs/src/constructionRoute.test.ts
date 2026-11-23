import { join } from 'node:path'
import { DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { loadGlbHeadless } from './animationAudit'
import { STAGE_DIR } from './paths'
import { measureConstructionRoute } from './constructionRoute'

describe('construction route clearance', () => {
  it('finds floor support across adjoining exported sidewalks and reports a gap', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const gltf = await loadGlbHeadless(join(STAGE_DIR, 'run-chisel-sim/3D/sim/props/prop_sidewalk_tile.glb'))
    const tile = gltf.scene.getObjectByName('prop_sidewalk_tile') as Mesh
    const floor = new Mesh(tile.geometry, material)
    const next = floor.clone()
    next.position.x = 2
    const route: [number, number, number][] = [[0, 0.16, 0], [2, 0.16, 0]]
    expect(measureConstructionRoute(route, [floor, next])).toMatchObject({ problems: [] })
    next.position.x = 2.65
    const result = measureConstructionRoute(route, [floor, next])
    expect(result.problems.some(({ kind }) => kind === 'floor gap')).toBe(true)
    material.dispose()
  })

  it('reports low clearance over an exported floor', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const gltf = await loadGlbHeadless(join(STAGE_DIR, 'run-chisel-sim/3D/sim/props/prop_sidewalk_tile.glb'))
    const tile = gltf.scene.getObjectByName('prop_sidewalk_tile') as Mesh
    const floor = new Mesh(tile.geometry, material)
    const ceiling = floor.clone()
    ceiling.position.copy(new Vector3(0, 1.56, 0))
    const result = measureConstructionRoute([[-0.5, 0.16, 0], [0.5, 0.16, 0]], [floor, ceiling])
    expect(result.problems.some(({ kind }) => kind === 'headroom')).toBe(true)
    material.dispose()
  })
})
