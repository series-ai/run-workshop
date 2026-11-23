import { Matrix4, Quaternion, Vector3, type Object3D, type Skeleton, type SkinnedMesh } from 'three'
import type { AvatarProportions } from '@voxchar/contracts/catalog'
import {
  arachnidFlipLiftY,
  boneScaleFor,
  humanStatureFor,
  quadrupedRollLiftY,
  type HumanStature,
} from '@voxchar/contracts/proportions'
import { isAnimalRig, type RigId } from '@voxchar/contracts/rig'

export { boneScaleFor, humanStatureFor, type HumanStature }

/**
 * Parametric skeletal proportions (performance rule P6).
 *
 * Each bone gets a scale in model axes (X width, Y up, Z depth) around its bind joint.
 *   1. The scale goes into the inverse bind matrix, so the skin near the bone changes shape.
 *      It does not pass to child bones, so no shear occurs.
 *   2. Each child joint moves with the scale of its parent (wider clavicles -> shoulders move out).
 *   3. On UAL1 humanoids, `height` drives real stature (legs + spine + arm reach) while keeping
 *      head, hands, foot height, horizontal girth, and held weapons true-to-scale — NOT a uniform
 *      zoom on `root`. `legRatio` shifts waist height between long-legged and compact builds while
 *      conserving total height. On creature rigs, `height` scales overall size cleanly around `y = 0`.
 *   4. Sole/paw grounding tracks accumulated `worldY` so feet remain planted on `y = 0`.
 */

interface SkeletonBind {
  inverses: Matrix4[]
  positions: Vector3[]
  inverseRotations: Quaternion[]
  parents: number[]
  scales: Vector3[]
  restPelvis: Vector3 | null
}

const binds = new WeakMap<Skeleton, SkeletonBind>()
const appliedYOffsets = new WeakMap<Object3D, number>()
const restChildScales = new WeakMap<Object3D, Vector3>()
const scratchMatrix = new Matrix4()
const scratchOffset = new Vector3()
const scratchScale = new Vector3()

function captureBind(skeleton: Skeleton): SkeletonBind {
  const inverses = skeleton.boneInverses.map((matrix) => matrix.clone())
  const positions: Vector3[] = []
  const inverseRotations: Quaternion[] = []
  for (const inverse of inverses) {
    const position = new Vector3()
    const rotation = new Quaternion()
    scratchMatrix.copy(inverse).invert().decompose(position, rotation, scratchScale)
    positions.push(position)
    inverseRotations.push(rotation.invert())
  }
  const parents = skeleton.bones.map((bone) => (bone.parent ? skeleton.bones.indexOf(bone.parent as (typeof skeleton.bones)[number]) : -1))
  skeleton.boneInverses = inverses.map((matrix) => matrix.clone())
  const pelvis = skeleton.bones.find((b) => b.name === 'pelvis' || b.name === 'body')
  return {
    inverses,
    positions,
    inverseRotations,
    parents,
    scales: skeleton.bones.map(() => new Vector3(1, 1, 1)),
    restPelvis: pelvis ? pelvis.position.clone() : null,
  }
}

const QUADRUPED_PAW = /^leg_(fl|fr|bl|br)_paw$/
const ARACHNID_TIBIA = /^leg_[1-4]_[lr]_tibia$/

function applyToSkeleton(skeleton: Skeleton, proportions: AvatarProportions, rigId: RigId): number {
  let bind = binds.get(skeleton)
  if (!bind) {
    bind = captureBind(skeleton)
    binds.set(skeleton, bind)
  }
  const { bones, boneInverses } = skeleton
  for (let i = 0; i < bones.length; i++) boneScaleFor(bones[i]!.name, proportions, bind.scales[i]!, rigId)

  const rootUniformScale = rigId === 'ual1' ? 1 : proportions.height
  const worldY = new Float64Array(bones.length)
  let lowestSoleY = Infinity

  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i]!
    const scale = bind.scales[i]!
    const joint = bind.positions[i]!
    scratchMatrix.makeScale(scale.x, scale.y, scale.z)
    scratchMatrix.setPosition(joint.x - scale.x * joint.x, joint.y - scale.y * joint.y, joint.z - scale.z * joint.z)
    boneInverses[i]!.multiplyMatrices(bind.inverses[i]!, scratchMatrix)

    if (bone.name === 'root') bone.scale.setScalar(rootUniformScale)

    const parent = bind.parents[i]!
    if (parent < 0 || bones[parent]!.name === 'root') {
      worldY[i] = joint.y
    } else {
      worldY[i] = worldY[parent]! + (joint.y - bind.positions[parent]!.y) * bind.scales[parent]!.y
      scratchOffset
        .copy(joint)
        .sub(bind.positions[parent]!)
        .multiply(bind.scales[parent]!)
        .applyQuaternion(bind.inverseRotations[parent]!)
      bone.position.copy(scratchOffset)
    }

    if (rigId === 'ual1' && (bone.name === 'foot_l' || bone.name === 'foot_r')) {
      lowestSoleY = Math.min(lowestSoleY, worldY[i]! - scale.y * joint.y)
    } else if (rigId === 'quadruped' && QUADRUPED_PAW.test(bone.name)) {
      lowestSoleY = Math.min(lowestSoleY, worldY[i]! - scale.y * joint.y)
    } else if (rigId === 'arachnid' && ARACHNID_TIBIA.test(bone.name)) {
      lowestSoleY = Math.min(lowestSoleY, worldY[i]! - scale.y * joint.y)
    }
  }
  if (!Number.isFinite(lowestSoleY)) throw new Error(`The ${rigId} skeleton has no grounding foot/paw/tibia bone.`)
  return lowestSoleY * rootUniformScale
}

/**
 * Restore the unscaled animated pelvis position prior to `mixer.update` so paused clips,
 * throttled LOD frames, or tracks without pelvis motion never compound pelvis scaling across frames.
 */
export function unscaleAnimatedPelvis(pelvis: Object3D | null, restPelvis: Vector3 | null, appliedScale: Vector3): void {
  if (!pelvis || !restPelvis) return
  const yOffset = appliedYOffsets.get(pelvis) ?? 0
  if (yOffset !== 0) {
    pelvis.position.y -= yOffset
    appliedYOffsets.set(pelvis, 0)
  }
  if (
    Math.abs(appliedScale.x - 1) < 1e-4 &&
    Math.abs(appliedScale.y - 1) < 1e-4 &&
    Math.abs(appliedScale.z - 1) < 1e-4
  ) {
    return
  }
  pelvis.position.x = restPelvis.x + (pelvis.position.x - restPelvis.x) / appliedScale.x
  pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) / appliedScale.y
  pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) / appliedScale.z
  appliedScale.set(1, 1, 1)
}

/**
 * Scale the animated pelvis/body displacement delta around rest so gait bounce, crouch/sit depth,
 * and creature Death roll clearances stay proportional and above the floor plane (zero allocations per frame).
 */
export function scaleAnimatedPelvis(
  pelvis: Object3D | null,
  restPelvis: Vector3 | null,
  proportions: AvatarProportions,
  rigId: RigId,
  appliedScale?: Vector3,
): void {
  if (!pelvis || !restPelvis || isAnimalRig(rigId)) {
    appliedScale?.set(1, 1, 1)
    return
  }
  if (rigId === 'ual1') {
    appliedYOffsets.set(pelvis, 0)
    const { legY } = humanStatureFor(proportions)
    if (Math.abs(legY - 1) < 1e-4) {
      appliedScale?.set(1, 1, 1)
      return
    }
    const xz = 0.5 + 0.5 * legY
    pelvis.position.x = restPelvis.x + (pelvis.position.x - restPelvis.x) * xz
    pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) * xz
    pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) * legY
    appliedScale?.set(xz, xz, legY)
  } else if (rigId === 'quadruped') {
    const legY = proportions.legRatio ?? 1
    const bodyZ = proportions.bodyLength ?? 1
    const q = pelvis.quaternion
    const localSideY = 2 * (q.x * q.y + q.w * q.z)
    const rawDropY = Math.max(0, restPelvis.y - pelvis.position.y)
    const liftY = quadrupedRollLiftY(proportions, localSideY, rawDropY)
    if (Math.abs(legY - 1) < 1e-4 && Math.abs(bodyZ - 1) < 1e-4 && liftY < 1e-4) {
      appliedYOffsets.set(pelvis, 0)
      appliedScale?.set(1, 1, 1)
      return
    }
    pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) * legY + liftY
    pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) * bodyZ
    appliedYOffsets.set(pelvis, liftY)
    appliedScale?.set(1, legY, bodyZ)
  } else {
    const q = pelvis.quaternion
    const localUpY = 1 - 2 * (q.x * q.x + q.z * q.z)
    const liftY = arachnidFlipLiftY(proportions, localUpY)
    if (liftY > 0) pelvis.position.y += liftY
    appliedYOffsets.set(pelvis, liftY)
    appliedScale?.set(1, 1, 1)
  }
}

/**
 * Apply proportions to every skinned mesh skeleton below `root`.
 * `root` is the rig root object (the parent of the `root` bone). This function owns `root.position.y`.
 */
export function applyProportionsToSkeleton(root: Object3D, proportions: AvatarProportions, rigId: RigId = 'ual1'): void {
  if (isAnimalRig(rigId)) {
    // External animal rigs have baked bind-rotated armature ancestors; scale only the non-mesh armature child so skin_ isn't double-scaled.
    for (const child of root.children) {
      if ((child as SkinnedMesh).isSkinnedMesh) continue
      let restScale = restChildScales.get(child)
      if (!restScale) {
        restScale = child.scale.clone()
        restChildScales.set(child, restScale)
      }
      child.scale.copy(restScale).multiplyScalar(proportions.height)
    }
    root.position.y = 0
    return
  }
  const skeletons = new Set<Skeleton>()
  root.traverse((object) => {
    const mesh = object as SkinnedMesh
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton)
  })
  if (skeletons.size === 0) throw new Error('applyProportionsToSkeleton: no skinned mesh is below the rig root.')
  let lowestSoleY = Infinity
  for (const skeleton of skeletons) lowestSoleY = Math.min(lowestSoleY, applyToSkeleton(skeleton, proportions, rigId))
  root.position.y = Math.abs(lowestSoleY) < 1e-12 ? 0 : -lowestSoleY
}

/** Nominal palm half-thickness (metres) in UAL1 `build_hand` before `body.hand` scaling. */
const PALM_HALF_THICKNESS = 0.025

/**
 * Compute held-item socket offset in hand-bone local space: `body.hand` (`0.5 + 0.5 * armFactor`)
 * only alters palm half-thickness along `palmOffset[0]`, while `limbThickness` scales the hand bone uniformly.
 */
export function computeHeldSocketPosition(
  palmOffset: readonly [number, number, number],
  armFactor: number,
  limbThickness: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  const skelHandScale = 1 + 0.35 * (limbThickness - 1)
  const bodyHand = 0.5 + 0.5 * armFactor
  const palmThicknessDelta = (bodyHand - 1) * PALM_HALF_THICKNESS
  out.set(palmOffset[0] + Math.sign(palmOffset[0]) * palmThicknessDelta, palmOffset[1], palmOffset[2])
  return out.multiplyScalar(skelHandScale)
}
