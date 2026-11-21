import { useEffect, useMemo } from 'react'
import { InstancedMesh, Matrix4, type MeshStandardMaterial } from 'three'
import type { LevelPropEntry } from '@voxchar/contracts/catalog'
import type { ResolvedLevelKit } from '@voxchar/contracts/levelKits'
import { assetRefFor } from '../avatar/composePolyAvatar'
import { findStaticMesh, readGltf } from '../avatar/polyRig'
import { useAssetUrls } from '../useAssetUrl'

export type LevelPlacement = ResolvedLevelKit['placements'][number]

interface InstanceProps {
  item: LevelPropEntry
  placements: readonly LevelPlacement[]
  material: MeshStandardMaterial
}

export function LevelInstances(props: InstanceProps) {
  const { item } = props
  const refs = useMemo(() => [assetRefFor(item.pack, item.leaf, item.relativePath)], [item])
  const urls = useAssetUrls(refs)
  return urls?.[0] ? <LoadedInstances {...props} url={urls[0]} /> : null
}

function LoadedInstances({ item, placements, material, url }: InstanceProps & { url: string }) {
  const geometry = findStaticMesh(readGltf(url), item.nodeName).geometry
  const mesh = useMemo(() => {
    const instances = new InstancedMesh(geometry, material, placements.length)
    instances.name = item.id
    const matrix = new Matrix4()
    placements.forEach(({ position, turn }, index) => {
      matrix.makeRotationY(turn * Math.PI / 2).setPosition(...position)
      instances.setMatrixAt(index, matrix)
    })
    instances.castShadow = !material.transparent
    instances.receiveShadow = true
    instances.computeBoundingSphere()
    return instances
  }, [geometry, item.id, material, placements])
  useEffect(() => () => {
    mesh.dispose()
  }, [mesh])
  return <primitive object={mesh} />
}
