/**
 * Loads one catalogued model (any pack) and places it by its catalogue bounds.
 *
 * RUN models pass `assertModelContract` on load; a violation throws into the
 * nearest `ViewerErrorBoundary`. The drei cache shares one scene per URL, so
 * the scene is cloned before any material or animation work. Held items are
 * stored in the PN Hand.R joint frame and are turned upright for display.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type Ref } from 'react'
import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { ONE_SHOT_CLIPS } from '@rvx/contracts/clips'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { VoxelModelEntry } from '@rvx/contracts/catalog'
import { modelRef } from '../catalog'
import { assertModelContract } from '../guards/contract'
import { useAssetUrl } from '../useAssetUrl'
import { displayBounds, modelUprightRotation } from './modelViewConfig'
import { modelTransform, type ModelTransformOptions } from './modelTransform'
import { SocketPfx, type ClipClock } from '../pfx/SocketPfx'

export interface PackModelProps extends ModelTransformOptions {
  entry: VoxelModelEntry
  /** Scene name, so `FitCamera` can find this group by name. */
  name?: string
  /** Clip to loop; `undefined` = the entry's `idle` or first clip; `null` = rest pose. */
  clip?: string | null
  wireframe?: boolean
  castShadow?: boolean
  rotationY?: number
  groupRef?: Ref<Group>
  /** Play the entry's PFX bindings at their sockets (by trigger; see SocketPfx). */
  pfx?: boolean
  /** Limit PFX playback to this effect id. */
  pfxOnly?: string
}

function LoadedPackModel({ url, entry, name, clip, wireframe = false, castShadow = true, rotationY = 0, groupRef, pfx = false, pfxOnly, ...transform }: PackModelProps & { url: string }) {
  const gltf = useGLTF(url)
  const model = useMemo(() => {
    assertModelContract(gltf.scene, gltf.animations, entry)
    return cloneSkeleton(gltf.scene)
  }, [gltf, entry])
  const placement = modelTransform(displayBounds(entry), transform)
  const upright = useMemo(() => modelUprightRotation(entry.category), [entry.category])
  const mixer = useMemo(() => new AnimationMixer(model), [model])

  const clipName = clip === undefined ? (entry.clips.includes('idle') ? 'idle' : entry.clips[0]) : clip
  // Time into the running clip, so clip-triggered one-shots fire at `binding.at` each cycle.
  const clipClock = useRef<ClipClock | null>(null)
  // A one-shot is played by two actions of the clip: `main` runs it, `start`
  // holds its first frame, so the blend home ends exactly where the next cycle starts.
  const oneShot = useRef<{ main: AnimationAction; start: AnimationAction } | null>(null)
  useEffect(() => {
    if (!clipName) return
    const found = gltf.animations.find((c) => c.name === clipName)
    if (!found) throw new Error(`${entry.id} has no clip "${clipName}"`)
    const action = mixer.clipAction(found)
    if (entry.pack !== 'pirate' && ONE_SHOT_CLIPS.includes(clipName)) {
      // Open, close, hit, attack and death end in another pose than they start.
      // Looping them would snap back; play once, hold, blend home, rest, repeat.
      action.setLoop(LoopOnce, 1).reset().play()
      action.paused = true
      const start = mixer.clipAction(found.clone())
      start.setLoop(LoopOnce, 1).reset().play()
      start.paused = true
      start.time = 0
      start.setEffectiveWeight(0)
      oneShot.current = { main: action, start }
      clipClock.current = { elapsed: 0, duration: oneShotCycle(found.duration).period }
    } else {
      action.setLoop(LoopRepeat, Infinity).reset().fadeIn(0.15).play()
      clipClock.current = { elapsed: 0, duration: found.duration }
    }
    return () => {
      clipClock.current = null
      oneShot.current?.start.stop()
      oneShot.current = null
      action.fadeOut(0.15)
    }
  }, [mixer, gltf.animations, clipName, entry.id, entry.pack])
  useEffect(() => () => void mixer.stopAllAction(), [mixer])
  useFrame((_, delta) => {
    if (clipClock.current) clipClock.current.elapsed += delta
    const pair = oneShot.current
    if (pair && clipClock.current) {
      const { time, weight } = oneShotPose(pair.main.getClip().duration, clipClock.current.elapsed)
      pair.main.time = time
      pair.main.setEffectiveWeight(weight)
      pair.start.time = 0
      pair.start.setEffectiveWeight(1 - weight)
    }
    mixer.update(delta)
  })

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
    <group ref={groupRef} name={name} position={placement.position} rotation={[0, rotationY, 0]} scale={placement.scale} dispose={null}>
      <group quaternion={upright}>
        <primitive object={model} />
        {pfx && <SocketPfx model={model} entry={entry} activeClip={clipName ?? null} only={pfxOnly} clipClock={clipClock} />}
      </group>
    </group>
  )
}

/** One-shot playback: play, hold the end pose, blend back to the first frame, rest a moment. */
export const ONE_SHOT_HOLD = 0.8
export const ONE_SHOT_RETURN = 0.4
export const ONE_SHOT_REST = 0.3

export function oneShotCycle(duration: number): { period: number } {
  return { period: duration + ONE_SHOT_HOLD + ONE_SHOT_RETURN + ONE_SHOT_REST }
}

/** Clip time and weight of a one-shot `elapsed` seconds after it started (weight 0 = the clip's first frame). */
export function oneShotPose(duration: number, elapsed: number): { time: number; weight: number } {
  const phase = elapsed % oneShotCycle(duration).period
  if (phase <= duration + ONE_SHOT_HOLD) return { time: Math.min(phase, duration), weight: 1 }
  const back = (phase - duration - ONE_SHOT_HOLD) / ONE_SHOT_RETURN
  return { time: duration, weight: Math.max(0, 1 - back) }
}

export function PackModel(props: PackModelProps) {
  const url = useAssetUrl(modelRef(props.entry))
  if (!url) return null
  return <LoadedPackModel {...props} url={url} />
}
