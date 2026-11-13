/**
 * Preview orientation per category. World assets face -Z (PN props, ships,
 * buildings); rig assets face +X. Held items are stored in the PN Hand.R
 * joint frame, so previews first turn them back to their authored upright
 * pose with the joint's rest rotation.
 */
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import type { ModelBounds } from './modelTransform'
import { PIRATE_RIG } from '@rvx/contracts/avatarRig.generated'

export const DEFAULT_MODEL_PREVIEW_YAW = Math.PI - Math.PI / 5
export const CHARACTER_MODEL_PREVIEW_YAW = -Math.PI / 2 - Math.PI / 5

const RIG_CATEGORIES = new Set(['characters-skins', 'avatar', 'held-items'])

export function getModelPreviewYaw(category?: string): number {
  return category && RIG_CATEGORIES.has(category) ? CHARACTER_MODEL_PREVIEW_YAW : DEFAULT_MODEL_PREVIEW_YAW
}

const handR = PIRATE_RIG.find((joint) => joint.name === 'Hand.R')
if (!handR) throw new Error('rig contract has no Hand.R joint')

/** Rest rotation of Hand.R in rig space: turns a held item upright. */
export const HAND_R_REST_ROTATION = new Quaternion().setFromRotationMatrix(new Matrix4().fromArray([...handR.worldMatrix]))

export function modelUprightRotation(category: string): Quaternion {
  return category === 'held-items' ? HAND_R_REST_ROTATION.clone() : new Quaternion()
}

/** Catalogue bounds as displayed (held items rotated upright). */
export function displayBounds(entry: { category: string; bounds: ModelBounds }): ModelBounds {
  if (entry.category !== 'held-items') return entry.bounds
  const box = new Box3()
  const { min, max } = entry.bounds
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    box.expandByPoint(new Vector3(x, y, z).applyQuaternion(HAND_R_REST_ROTATION))
  }
  const size = box.getSize(new Vector3())
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z], size: [size.x, size.y, size.z] }
}
