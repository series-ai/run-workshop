import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh, type MeshStandardMaterial } from 'three'
import type { WorldPropEntry } from '@chisel/contracts/catalog'
import { assetRefFor } from '../avatar/composePolyAvatar'
import { findStaticMesh, readGltf } from '../avatar/polyRig'
import { useAssetUrls } from '../useAssetUrl'
import type { PropPlacement } from './sceneLayouts'

interface StageTileBatchProps {
  item: WorldPropEntry
  material: MeshStandardMaterial
  tiles: readonly PropPlacement[]
}

export function StageTileBatch(props: StageTileBatchProps) {
  const { pack, leaf, relativePath } = props.item
  const refs = useMemo(() => [assetRefFor(pack, leaf, relativePath)], [pack, leaf, relativePath])
  const urls = useAssetUrls(refs)
  return urls?.[0] ? <LoadedTileBatch {...props} url={urls[0]} /> : null
}

function LoadedTileBatch({ item, material, tiles, url }: StageTileBatchProps & { url: string }) {
  const geometry = findStaticMesh(readGltf(url), item.nodeName).geometry
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const instances = mesh.current!
    const transform = new Object3D()
    tiles.forEach((tile, index) => {
      transform.position.set(...tile.position)
      transform.rotation.y = tile.rotationY ?? 0
      transform.scale.set(...(tile.scale ?? [1, 1, 1]))
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
    })
    instances.instanceMatrix.needsUpdate = true
    instances.computeBoundingSphere()
  }, [geometry, material, tiles])

  return <instancedMesh ref={mesh} args={[geometry, material, tiles.length]} />
}
