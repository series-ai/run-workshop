import { join } from 'node:path'
import { DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { loadGlbHeadless } from './animationAudit'
import { STAGE_DIR } from './paths'
import { measureConstructionRoute } from './constructionRoute'

async function exportedSimMesh(id: string, material: MeshBasicMaterial): Promise<Mesh> {
  const gltf = await loadGlbHeadless(join(STAGE_DIR, 'run-chisel-sim/3D/sim/props', `${id}.glb`))
  const node = gltf.scene.getObjectByName(id)
  if (!(node instanceof Mesh)) throw new Error(`Missing exported mesh "${id}"`)
  return new Mesh(node.geometry, material)
}

describe('construction route clearance', () => {
  it('finds floor support across adjoining exported sidewalks and reports a gap', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const floor = await exportedSimMesh('prop_sidewalk_tile', material)
    const next = floor.clone()
    next.position.x = 2
    const route: [number, number, number][] = [[0, 0.16, 0], [2, 0.16, 0]]
    expect(measureConstructionRoute(route, [floor, next])).toMatchObject({ problems: [] })
    next.position.x = 2.65
    expect(measureConstructionRoute(route, [floor, next]).problems.map(({ kind }) => kind)).toContain('floor gap')
    material.dispose()
  })

  it('reports low clearance over an exported floor', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const floor = await exportedSimMesh('prop_sidewalk_tile', material)
    const ceiling = floor.clone()
    ceiling.position.copy(new Vector3(0, 1.56, 0))
    const result = measureConstructionRoute([[-0.5, 0.16, 0], [0.5, 0.16, 0]], [floor, ceiling])
    expect(result.problems.map(({ kind }) => kind)).toContain('headroom')
    material.dispose()
  })

  it('detects a barrier between consecutive floor samples', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const floor = await exportedSimMesh('prop_sidewalk_tile', material)
    const wall = await exportedSimMesh('prop_brick_wall', material)
    wall.position.set(0, 0.16, 0.05)
    wall.scale.z = 0.02
    const result = measureConstructionRoute([[0, 0.16, 0], [0, 0.16, 0.10]], [floor, wall])
    expect(result.problems.map(({ kind }) => kind)).toContain('obstruction')
    material.dispose()
  })

  it('rejects a passage narrower than the adult envelope', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const floor = await exportedSimMesh('prop_sidewalk_tile', material)
    const wall = await exportedSimMesh('prop_brick_wall', material)
    wall.geometry.computeBoundingBox()
    const depth = wall.geometry.boundingBox
    if (!depth) throw new Error('Missing wall bounds')
    wall.rotation.y = Math.PI / 2
    wall.position.set(-0.22 - depth.max.z, 0.16, 0)
    const other = wall.clone()
    other.position.x = 0.22 - depth.min.z
    const result = measureConstructionRoute([[0, 0.16, -0.5], [0, 0.16, 0.5]], [floor, wall, other])
    expect(result.problems.map(({ kind }) => kind)).toContain('width')
    material.dispose()
  })

  it('rejects an abrupt floor rise across a tile seam', async () => {
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const floor = await exportedSimMesh('prop_sidewalk_tile', material)
    const next = floor.clone()
    next.position.set(2, 0.32, 0)
    const route: [number, number, number][] = [[0, 0.16, 0], [0.99, 0.16, 0], [1.01, 0.48, 0], [2, 0.48, 0]]
    const result = measureConstructionRoute(route, [floor, next])
    expect(result.problems.map(({ kind }) => kind)).toContain('step rise')
    material.dispose()
  })
})
