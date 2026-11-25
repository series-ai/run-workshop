import { useLayoutEffect, useMemo, useRef } from 'react'
import { Matrix4, Object3D, type InstancedMesh } from 'three'
import type { WorldPropEntry } from '@chisel/contracts/catalog'
import { getSharedBlobShadowResources } from '../avatar/polyMaterial'
import { isFloorTileId, type PropPlacement } from './sceneLayouts'

type Footprint = readonly [x: number, z: number, width: number, depth: number]

const SHADOW_HEIGHT = 0.012
const CONTACT_FOOTPRINTS: Readonly<Partial<Record<string, readonly Footprint[]>>> = {
  prop_city_bus: [
    [0, 0, 2.85, 6.4],
    [-0.95, -1.58, 0.64, 0.88], [0.95, -1.58, 0.64, 0.88],
    [-0.95, 1.46, 0.64, 0.88], [0.95, 1.46, 0.64, 0.88],
  ],
  prop_lantern_noodle_bar: [
    [0, 0, 3.8, 2.0],
    [0, -0.02, 2.95, 1.46],
  ],
}

export function StagePropShadows({ placements, props }: {
  placements: readonly PropPlacement[]
  props: ReadonlyMap<string, WorldPropEntry>
}) {
  const { geometry, material } = getSharedBlobShadowResources()
  const batch = useRef<InstancedMesh>(null)
  const matrices = useMemo(() => {
    const parent = new Object3D()
    const local = new Object3D()
    return placements.flatMap((placement) => {
      if (isFloorTileId(placement.id) || placement.position[1] >= 0.6) return []
      const [width, , depth] = props.get(placement.id)!.bounds.size
      const footprints = CONTACT_FOOTPRINTS[placement.id] ?? [[0, 0, width * 1.5 + 0.2, depth * 1.5 + 0.2]]
      parent.position.set(...placement.position)
      parent.rotation.y = placement.rotationY ?? 0
      parent.scale.set(...(placement.scale ?? [1, 1, 1]))
      parent.updateMatrix()
      return footprints.map(([x, z, w, d]) => {
        local.position.set(x, SHADOW_HEIGHT, z)
        local.scale.set(w, 1, d)
        local.updateMatrix()
        return new Matrix4().multiplyMatrices(parent.matrix, local.matrix)
      })
    })
  }, [placements, props])

  useLayoutEffect(() => {
    const mesh = batch.current
    if (!mesh) return
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])

  return matrices.length ? <instancedMesh ref={batch} args={[geometry, material, matrices.length]} /> : null
}
