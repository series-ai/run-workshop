/**
 * Plays a model's catalogue PFX bindings at their sockets. RVX effects are
 * drawn at nominal size 1, so each binding scales its effect to
 * `binding.size` model units and turns the effect's +Y to `binding.aim`.
 *
 * Loops run while their trigger is on. One-shots fire once per trigger:
 * `clip:<name>` bindings once per clip cycle, `binding.at` seconds in;
 * `manual` bindings at the swing point of the clip in `clipClock` (a held
 * item on an avatar playing an action clip), or every few seconds when no
 * clip drives them, so a viewer sees them without a button.
 */
import { createPortal, useFrame } from '@react-three/fiber'
import { isPfxOneShot, PfxById } from '@rvx-pfx'
import { Suspense, useMemo, useRef, useState, type RefObject } from 'react'
import { PropertyBinding, Quaternion, Vector3, type Group, type Object3D } from 'three'
import type { PfxBinding, VoxelModelEntry } from '@rvx/contracts/catalog'

/** Time into the running clip: total seconds since it started, and its length. */
export interface ClipClock {
  elapsed: number
  duration: number
}

/** Seconds between replays of a one-shot that no clip drives. */
export const ONE_SHOT_REPLAY_SECONDS = 2
/** Where in an action clip a manual one-shot fires (the swing or shot). */
export const MANUAL_CLIP_FRACTION = 0.45

/**
 * Which bindings play: `idle` and `manual` while PFX are on, `clip:<name>`
 * only while that clip runs; `only` limits playback to one effect id.
 */
export function activeBindings(entry: Pick<VoxelModelEntry, 'pfx'>, activeClip: string | null, only?: string): VoxelModelEntry['pfx'] {
  return entry.pfx.filter((b) => (!only || b.effectId === only) && (b.trigger === 'idle' || b.trigger === 'manual' || b.trigger === `clip:${activeClip}`))
}

/**
 * The trigger count for a one-shot now (it fires each time this goes up);
 * -1 before its first trigger.
 */
export function oneShotCycle(binding: Pick<PfxBinding, 'trigger' | 'at'>, clock: ClipClock | null, seconds: number): number {
  if (clock && clock.duration > 0 && binding.trigger !== 'idle') {
    const at = binding.trigger === 'manual' ? clock.duration * MANUAL_CLIP_FRACTION : (binding.at ?? 0)
    if (at > clock.duration) throw new Error(`PFX fires at ${at} s, after the ${clock.duration.toFixed(2)} s clip`)
    return Math.floor((clock.elapsed - at) / clock.duration)
  }
  return Math.floor(seconds / ONE_SHOT_REPLAY_SECONDS)
}

const UP = new Vector3(0, 1, 0)
const anchorScale = new Vector3()
const modelScale = new Vector3()

function BindingPfx({ binding, anchor, model, clipClock }: { binding: PfxBinding; anchor: Object3D; model: Object3D; clipClock?: RefObject<ClipClock | null> }) {
  const oneShot = isPfxOneShot(binding.effectId)
  const [play, setPlay] = useState(-1)
  const group = useRef<Group>(null)
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, binding.aim ? new Vector3(...binding.aim).normalize() : UP), [binding.aim])
  // `size` is in the model's own units. Socket parents may carry scale, and
  // clips animate it (a ghost squashes as it dies), so cancel the socket's
  // scale: at first render (loops pre-warm on mount, in world space, so the
  // scale must be right then) and again every frame.
  // `offset` is in model units along the socket's axes; the socket's own scale is cancelled the same way.
  const scaleNow = (): [number, number, number] => {
    model.updateWorldMatrix(true, true)
    anchor.getWorldScale(anchorScale)
    const unit = model.getWorldScale(modelScale).x
    const safe = (v: number) => Math.max(Math.abs(v), 1e-3)
    return [unit / safe(anchorScale.x), unit / safe(anchorScale.y), unit / safe(anchorScale.z)]
  }
  const place = (): { position: [number, number, number]; scale: [number, number, number] } => {
    const perUnit = scaleNow()
    const offset = binding.offset ?? [0, 0, 0]
    return {
      position: [offset[0] * perUnit[0], offset[1] * perUnit[1], offset[2] * perUnit[2]],
      scale: [binding.size * perUnit[0], binding.size * perUnit[1], binding.size * perUnit[2]],
    }
  }
  useFrame((state) => {
    if (oneShot) {
      const cycle = oneShotCycle(binding, clipClock?.current ?? null, state.clock.elapsedTime)
      if (cycle >= 0 && cycle !== play) setPlay(cycle)
    }
    if (!group.current) return
    const { position, scale } = place()
    group.current.position.set(...position)
    group.current.scale.set(...scale)
  })
  if (oneShot && play < 0) return null
  const initial = place()
  return createPortal(
    <group ref={group} quaternion={quaternion} position={initial.position} scale={initial.scale}>
      <Suspense fallback={null}>
        <PfxById effectId={binding.effectId} playKey={play} />
      </Suspense>
    </group>,
    anchor,
  )
}

export function SocketPfx({
  model,
  entry,
  activeClip = null,
  only,
  clipClock,
}: {
  model: Object3D
  entry: VoxelModelEntry
  activeClip?: string | null
  only?: string
  clipClock?: RefObject<ClipClock | null>
}) {
  return (
    <>
      {activeBindings(entry, activeClip, only).map((binding) => {
        const anchor = binding.socket ? model.getObjectByName(PropertyBinding.sanitizeNodeName(binding.socket)) : model
        if (!anchor) throw new Error(`${entry.id}: PFX socket "${binding.socket}" is missing`)
        return <BindingPfx key={entry.pfx.indexOf(binding)} binding={binding} anchor={anchor} model={model} clipClock={clipClock} />
      })}
    </>
  )
}
