/**
 * Loads one catalogued pack model and places it by its bounds.
 *
 * Two details are load-bearing. The drei GLTF cache shares one scene graph per
 * URL, so this clones before touching materials — otherwise a wireframe toggle
 * in one viewer leaks into the next. And placement comes from the catalogue
 * bounds rather than the loaded geometry, so the transform is known before the
 * GLB arrives and does not pop when it does.
 */
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, type Ref } from 'react'
import { Mesh, MeshStandardMaterial, type Group } from 'three'
import { modelAssetReference, type PirateNationModelEntry } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { modelTransform, type ModelTransformOptions } from './modelTransform'

export interface PackModelProps extends ModelTransformOptions {
  /** Pass the `…-collision` entry here to render collision geometry instead. */
  entry: PirateNationModelEntry
  /** Scene name, so `FitCamera` can find this group by name. */
  name?: string
  wireframe?: boolean
  castShadow?: boolean
  rotationY?: number
  /** Exposes the placed group, for callers that drive animation or spin it. */
  groupRef?: Ref<Group>
}

function LoadedPackModel({
  url,
  entry,
  name,
  wireframe = false,
  castShadow = true,
  rotationY = 0,
  groupRef,
  ...transform
}: PackModelProps & { url: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])
  // Plain arithmetic on six numbers — memoising it would cost more than it saves,
  // and `at` arrives as a fresh array each render so a memo would miss anyway.
  const placement = modelTransform(entry.bounds, transform)

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh !== true) return
      mesh.castShadow = castShadow
      mesh.receiveShadow = castShadow
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) (material as MeshStandardMaterial).wireframe = wireframe
    })
  }, [model, wireframe, castShadow])

  return (
    <group
      ref={groupRef}
      name={name}
      position={placement.position}
      rotation={[0, rotationY, 0]}
      scale={placement.scale}
      dispose={null}
    >
      <primitive object={model} />
    </group>
  )
}

export function PackModel(props: PackModelProps) {
  const url = useAssetUrl(modelAssetReference(props.entry))
  if (!url) return null
  return <LoadedPackModel {...props} url={url} />
}
