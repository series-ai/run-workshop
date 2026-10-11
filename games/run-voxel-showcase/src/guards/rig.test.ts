import { Bone, Group, Matrix4, PropertyBinding, Skeleton } from 'three'
import { describe, expect, it } from 'vitest'
import { PIRATE_RIG } from '@rvx/contracts/avatarRig.generated'
import { assertPartsRigCompatible, assertSkinRigCompatible, RigMismatchError } from './rig'

type Joint = (typeof PIRATE_RIG)[number]

/** A skeleton with PN's hierarchy and rest pose under a scene root, like a loaded GLB. */
function pnSkeleton(order: readonly Joint[] = PIRATE_RIG, extra: string[] = []): Skeleton {
  const scene = new Group()
  const bones = new Map<string, Bone>()
  for (const joint of PIRATE_RIG) {
    const bone = new Bone()
    bone.name = PropertyBinding.sanitizeNodeName(joint.name)
    bone.position.fromArray([...joint.translation])
    bone.quaternion.fromArray([...joint.rotation])
    bone.scale.fromArray([...joint.scale])
    bones.set(joint.name, bone)
  }
  for (const joint of PIRATE_RIG) (joint.parent ? bones.get(joint.parent)! : scene).add(bones.get(joint.name)!)
  const extras = extra.map((name) => Object.assign(new Bone(), { name }))
  for (const b of extras) scene.add(b)
  return new Skeleton(
    [...order.map((j) => bones.get(j.name)!), ...extras],
    [...order.map((j) => new Matrix4().fromArray([...j.inverseBindMatrix])), ...extras.map(() => new Matrix4())],
  )
}

describe('rig guards', () => {
  it('accepts matching parts and skins, including extra skin bones', () => {
    expect(() => assertPartsRigCompatible('fantasy', pnSkeleton(), pnSkeleton())).not.toThrow()
    expect(() => assertSkinRigCompatible('pirate', pnSkeleton(PIRATE_RIG, ['Barrel']))).not.toThrow()
  })
  it('rejects a joint-order swap in a parts file', () => {
    const swapped = [PIRATE_RIG[1]!, PIRATE_RIG[0]!, ...PIRATE_RIG.slice(2)]
    expect(() => assertPartsRigCompatible('fantasy', pnSkeleton(swapped), pnSkeleton())).toThrow(RigMismatchError)
  })
  it('rejects an inverse-bind drift, a missing matrix, a moved rest pose and a re-parented joint', () => {
    const drift = pnSkeleton()
    drift.boneInverses[9]!.elements[13] += 0.01
    expect(() => assertSkinRigCompatible('fantasy', drift)).toThrow(/HandR.*inverse bind matrix/)
    const missing = pnSkeleton()
    missing.boneInverses.length = 3
    expect(() => assertSkinRigCompatible('fantasy', missing)).toThrow(/inverse bind matrix/)
    const moved = pnSkeleton()
    moved.bones[3]!.position.y += 0.05
    expect(() => assertSkinRigCompatible('fantasy', moved)).toThrow(/Head.*rest pose/)
    const reparented = pnSkeleton()
    reparented.bones[3]!.add(reparented.bones[4]!) // Arm.L under Head
    expect(() => assertSkinRigCompatible('fantasy', reparented)).toThrow(/ArmL/)
  })
})
