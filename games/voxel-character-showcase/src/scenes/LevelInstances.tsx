import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, type MeshStandardMaterial } from 'three'
import type { LevelPropEntry } from '@voxchar/contracts/catalog'
import type { ResolvedLevelKit } from '@voxchar/contracts/levelKits'
import { assetRefFor } from '../avatar/composePolyAvatar'
import { findStaticMesh, readGltf } from '../avatar/polyRig'
import { useAssetUrls } from '../useAssetUrl'
import type { VoxelGeometry } from './levelVoxelGeometry'

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

function LoadedInstances({ url, ...props }: InstanceProps & { url: string }) {
  const geometry = findStaticMesh(readGltf(url), props.item.nodeName).geometry
  return <LevelGeometryInstances {...props} geometry={geometry} />
}

export function LevelVoxelInstances({ mesh, ...props }: InstanceProps & { mesh: VoxelGeometry }) {
  const geometry = useMemo(() => {
    return new BufferGeometry()
      .setAttribute('position', new BufferAttribute(mesh.positions, 3))
      .setAttribute('normal', new BufferAttribute(mesh.normals, 3))
      .setAttribute('uv', new BufferAttribute(mesh.uv, 2))
      .setAttribute('uv1', new BufferAttribute(mesh.grain, 2))
      .setIndex(new BufferAttribute(mesh.indices, 1))
  }, [mesh])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <LevelGeometryInstances {...props} geometry={geometry} />
}

function LevelGeometryInstances({ item, placements, material, geometry }: InstanceProps & { geometry: BufferGeometry }) {
  const { gl, invalidate } = useThree()
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
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true
    invalidate()
    return () => {
      gl.shadowMap.needsUpdate = true
      invalidate()
      mesh.dispose()
    }
  }, [gl, invalidate, mesh])
  return <primitive object={mesh} />
}
