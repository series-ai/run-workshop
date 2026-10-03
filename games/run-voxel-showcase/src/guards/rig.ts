/**
 * Rig compatibility with the Pirate Nation skeleton.
 *
 * Parts rebind to the PN skeleton, so their joints must match it exactly
 * (names, order, inverse bind matrices). Skins keep their own skeleton and
 * play clips by bone name, so every PN joint must exist by name with a
 * matching inverse bind matrix; extra bones may sit anywhere (PN's knight
 * has `Barrel` mid-rig).
 */
import { Matrix4, PropertyBinding, type Bone, type Object3D, type Skeleton } from 'three'
import { PIRATE_RIG } from '@rvx/contracts/avatarRig.generated'

export const RIG_EPSILON = 1e-4

export class RigMismatchError extends Error {
  override name = 'RigMismatchError'
  constructor(
    readonly pack: string,
    readonly joint: string,
    detail: string,
  ) {
    super(`${pack}: joint "${joint}" ${detail}`)
  }
}

const PN_JOINTS = PIRATE_RIG.map((joint) => ({
  name: PropertyBinding.sanitizeNodeName(joint.name),
  parent: joint.parent ? PropertyBinding.sanitizeNodeName(joint.parent) : null,
  ibm: joint.inverseBindMatrix,
  world: joint.worldMatrix,
}))

function maxDiff(a: ArrayLike<number> | undefined, b: ArrayLike<number>): number {
  if (!a || a.length !== 16) return Infinity
  let max = 0
  for (let i = 0; i < 16; i += 1) {
    const d = Math.abs((a[i] ?? NaN) - (b[i] ?? NaN))
    if (!Number.isFinite(d)) return Infinity
    max = Math.max(max, d)
  }
  return max
}

/** Rest world matrix of a bone relative to its skeleton's scene root, and its nearest bone ancestor. */
function restOf(bone: Bone, bones: Set<Bone>): { world: number[]; parent: string | null } {
  const m = new Matrix4()
  let parent: string | null = null
  for (let o: Object3D | null = bone; o; o = o.parent) {
    if (o !== bone && parent === null && bones.has(o as Bone)) parent = o.name
    if (!o.parent) break // the gltf.scene root is not part of the rig
    m.premultiply(new Matrix4().compose(o.position, o.quaternion, o.scale))
  }
  return { world: m.elements, parent }
}

/** Rest pose and hierarchy: clips drive local transforms, so they must match PN's, not only the bind matrices. */
function assertRest(pack: string, skeleton: Skeleton): void {
  const bones = new Set(skeleton.bones)
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]))
  for (const joint of PN_JOINTS) {
    const bone = byName.get(joint.name)
    if (!bone) continue
    const rest = restOf(bone, bones)
    const diff = maxDiff(rest.world, joint.world)
    if (diff > RIG_EPSILON) throw new RigMismatchError(pack, joint.name, `rest pose differs from PN by ${diff.toExponential(2)}`)
    if (rest.parent !== joint.parent) throw new RigMismatchError(pack, joint.name, `hangs under "${rest.parent}", PN has "${joint.parent}"`)
  }
}

export function assertPartsRigCompatible(pack: string, parts: Skeleton, pirate: Skeleton): void {
  const names = parts.bones.map((bone) => bone.name)
  pirate.bones.forEach((bone, i) => {
    if (names[i] !== bone.name) throw new RigMismatchError(pack, bone.name, `is at position ${names.indexOf(bone.name)}, expected ${i} (joint order differs from PN)`)
    const diff = maxDiff(parts.boneInverses[i]?.elements, pirate.boneInverses[i]!.elements)
    if (diff > RIG_EPSILON) throw new RigMismatchError(pack, bone.name, `inverse bind matrix differs from PN by ${diff.toExponential(2)} (max ${RIG_EPSILON})`)
  })
  if (names.length !== pirate.bones.length) throw new RigMismatchError(pack, names[pirate.bones.length] ?? '?', 'is an extra joint in a parts file')
  assertRest(pack, parts)
}

export function assertSkinRigCompatible(pack: string, skin: Skeleton): void {
  const names = skin.bones.map((bone) => bone.name)
  for (const joint of PN_JOINTS) {
    const i = names.indexOf(joint.name)
    if (i === -1) throw new RigMismatchError(pack, joint.name, 'is missing')
    const diff = maxDiff(skin.boneInverses[i]?.elements, joint.ibm)
    if (diff > RIG_EPSILON) throw new RigMismatchError(pack, joint.name, `inverse bind matrix differs from PN by ${diff.toExponential(2)} (max ${RIG_EPSILON})`)
  }
  assertRest(pack, skin)
}
