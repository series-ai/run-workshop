import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AnimationMixer, Mesh, MeshStandardMaterial, SpotLight } from 'three'
import type { LevelPropEntry } from '@voxchar/contracts/catalog'
import { assetRefFor } from '../avatar/composePolyAvatar'
import { readGltf } from '../avatar/polyRig'
import { useAssetUrls } from '../useAssetUrl'

type VehicleProps = {
  item: Pick<LevelPropEntry, 'pack' | 'leaf'>
  path: string
  clipName: string
  lightsOn: boolean
}

export function KitVehicle({ item, path, clipName, lightsOn }: VehicleProps) {
  const refs = useMemo(() => [assetRefFor(item.pack, item.leaf, path)], [item.pack, item.leaf, path])
  const urls = useAssetUrls(refs)
  return urls?.[0] ? <LoadedVehicle url={urls[0]} clipName={clipName} lightsOn={lightsOn} /> : null
}

function LoadedVehicle({ url, clipName, lightsOn }: { url: string; clipName: string; lightsOn: boolean }) {
  const gltf = readGltf(url)
  const { root, lamps, lenses } = useMemo(() => {
    const root = gltf.scene.clone(true)
    const lamps: SpotLight[] = []
    const lenses: MeshStandardMaterial[] = []
    root.traverse((object) => {
      if (object instanceof SpotLight && typeof object.userData.intensityOn === 'number') {
        const [target] = object.children
        if (target) object.target = target
        lamps.push(object)
      }
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        const color = object.userData.emissiveOn
        if (object.material instanceof MeshStandardMaterial && Array.isArray(color) && color.length === 3) {
          const lens = object.material.clone()
          lens.emissive.setRGB(color[0], color[1], color[2])
          lens.emissiveIntensity = 0
          object.material = lens
          lenses.push(lens)
        }
      }
    })
    return { root, lamps, lenses }
  }, [gltf])
  const mixer = useMemo(() => new AnimationMixer(root), [root])
  const clip = gltf.animations.find((animation) => animation.name === clipName)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => () => lenses.forEach((material) => material.dispose()), [lenses])

  useEffect(() => {
    for (const lamp of lamps) lamp.intensity = lightsOn ? lamp.userData.intensityOn : 0
    for (const lens of lenses) lens.emissiveIntensity = lightsOn ? 1 : 0
    invalidate()
  }, [invalidate, lamps, lenses, lightsOn])

  useEffect(() => {
    if (!clip) return
    const action = mixer.clipAction(clip).reset().play()
    invalidate()
    return () => {
      action.stop()
      invalidate()
    }
  }, [clip, mixer, invalidate])

  useFrame((_, delta) => {
    if (!clip) return
    mixer.update(Math.min(delta, 0.05))
    invalidate()
  })

  if (clipName && !clip) throw new Error(`Vehicle is missing animation "${clipName}".`)
  return <primitive object={root} />
}
