import type { RigId } from './rig'

export interface ProportionLike {
  height: number
  legRatio?: number
  build?: number
  shoulderWidth: number
  torsoBulk: number
  waistScale: number
  headScale: number
  limbThickness: number
  armLength?: number
  bodyLength?: number
  neckScale?: number
  handScale?: number
  footScale?: number
}

export interface Vec3Out {
  x: number
  y: number
  z: number
}

const SIDE_SUFFIX = /_[lr]$/
const FINGER = /^(thumb|index|middle|ring|pinky)_0[1-3]$/
const QUADRUPED_LEG = /^leg_(fl|fr|bl|br)_(upper|lower)$/
const QUADRUPED_PAW = /^leg_(fl|fr|bl|br)_paw$/
const ARACHNID_DIAG_LEG = /^leg_[14]_[lr]_(coxa|femur|tibia)$/
const ARACHNID_SIDE_LEG = /^leg_[23]_[lr]_(coxa|femur|tibia)$/

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Reference standing stature spans (metres) of the UAL1 bind rig:
// foot.y (0.1602) + head crown (0.2760) = 0.4362 fixed height; thigh->foot = 0.9233; Head->thigh = 0.6223.
const UAL1_FIXED_H = 0.4362
const UAL1_LEG_H = 0.9233
const UAL1_TORSO_H = 0.6223
const UAL1_PELVIS_H = 0.19297 // spine_01.y (1.27649) - thigh_l.y (1.08352)
const UAL1_UPPER_TORSO_H = 0.42932 // Head.y (1.70581) - spine_01.y (1.27649)
const UAL1_NECK_H = 0.09287 // Head.y (1.70581) - neck_01.y (1.61294)
const UAL1_UPPER_SPINE_H = UAL1_UPPER_TORSO_H - UAL1_NECK_H
const UAL1_BODY_H = UAL1_LEG_H + UAL1_TORSO_H
const UAL1_TOTAL_H = UAL1_BODY_H + UAL1_FIXED_H

export interface HumanStature {
  legY: number
  torsoY: number
  armReach: number
}

/** Decompose humanoid height + legRatio into anatomical leg/torso/arm scales without scaling head or weapons. */
export function humanStatureFor(proportions: ProportionLike): HumanStature {
  const height = proportions.height
  const legRatio = proportions.legRatio ?? 1
  const armLength = proportions.armLength ?? 1
  const stature = Math.max(0.55, (height * UAL1_TOTAL_H - UAL1_FIXED_H) / UAL1_BODY_H)
  const targetBodyH = stature * UAL1_BODY_H
  const legLo = Math.min(1.9, Math.max(0.52, (targetBodyH - 1.9 * UAL1_TORSO_H) / UAL1_LEG_H))
  const legHi = Math.max(legLo, Math.min(1.9, (targetBodyH - 0.52 * UAL1_TORSO_H) / UAL1_LEG_H))
  const legY = clamp((1 + 1.1 * (stature - 1)) * legRatio, legLo, legHi)
  const torsoY = clamp((targetBodyH - legY * UAL1_LEG_H) / UAL1_TORSO_H, 0.52, 1.9)
  const armReach = clamp(0.55 * legY + 0.45 * torsoY + (armLength - 1), 0.65, 1.65)
  return { legY, torsoY, armReach }
}

export const ARM_SHIELD_HELD_IDS = new Set(['held_heater_shield', 'held_spiked_buckler'])

export function isArmShieldHeldItem(id?: string | null): boolean {
  return Boolean(id && ARM_SHIELD_HELD_IDS.has(id))
}

/** Arm thickness morph factor matching the body archetype builders in polykit.py. */
export function armThicknessFactorFor(bodyId: string, build = 0): number {
  if (bodyId === 'body_orc') return 1.08
  if (bodyId === 'body_troll') return 0.98
  const baseCoord = bodyId === 'body_slim' ? -1 : bodyId === 'body_heavy' ? 1 : 0
  const targetCoord = clamp(baseCoord + build, -1, 1)
  return targetCoord < 0 ? 1 + (0.86 - 1) * -targetCoord : 1 + (1.02 - 1) * targetCoord
}

/** Nominal palm half-thickness and palm surface offset (metres) in UAL1 `build_hand`. */
const PALM_HALF_THICKNESS = 0.025
const PALM_SURFACE_OFFSET = 0.016

/** Compute held-item socket offset in hand-bone local space accounting for body hand thickness, skeletal limbThickness, and handScale. */
export function heldSocketOffsetFor<T extends Vec3Out>(
  palmOffset: readonly [number, number, number],
  armFactor: number,
  limbThickness: number,
  out: T,
  handScaleOverride = 1,
): T {
  const skelHandScale = (1 + 0.35 * (limbThickness - 1)) * handScaleOverride
  const bodyHand = 0.5 + 0.5 * armFactor
  const palmThicknessDelta = (bodyHand - 1) * PALM_HALF_THICKNESS
  const baseOffset = Math.abs(palmOffset[0]) + palmThicknessDelta
  const handleRadiusGap = Math.max(0, Math.abs(palmOffset[0]) - PALM_SURFACE_OFFSET)
  const palmThickness = Math.max(0, baseOffset - handleRadiusGap)
  out.x = Math.sign(palmOffset[0]) * (palmThickness * skelHandScale + handleRadiusGap)
  out.y = palmOffset[1] * skelHandScale
  out.z = palmOffset[2] * skelHandScale
  return out
}

/** Upward clearance as UAL1 lies prone/supine (e.g., Death01) so head/back/torso stay above y = 0 without altering sitting or crouch clips. */
export function ual1FloorLiftY(proportions: ProportionLike, localUpY: number, rawDropZ = 0): number {
  const drop = clamp((rawDropZ - 0.51) / 0.10, 0, 1)
  if (drop < 1e-4) return 0
  const headDip = clamp((0.40 - localUpY) / 0.35, 0, 1)
  const limbGirth = 0.92 * (1 + 0.85 * (proportions.limbThickness - 1))
  const maxGirth = Math.max(1, proportions.torsoBulk, proportions.waistScale, proportions.headScale, limbGirth)
  return drop * (0.064 + 0.022 * headDip + 0.165 * Math.max(0, maxGirth - 1))
}

/** Upward clearance as a quadruped rolls onto its side or collapses belly-down so expanded ribs, shoulders, head, and short-leg hips stay above y = 0. */
export function quadrupedRollLiftY(proportions: ProportionLike, localSideY: number, rawDropY = 0): number {
  const legY = proportions.legRatio ?? 1
  const sideTilt = clamp(Math.abs(localSideY), 0, 1)
  let rollLift = 0
  if (sideTilt >= 1e-4) {
    const legMass = 1 + 0.85 * (proportions.limbThickness - 1)
    const sideScale = Math.max(1, proportions.shoulderWidth, proportions.torsoBulk, proportions.headScale, 0.9 * legMass)
    rollLift = sideTilt * (0.34 * Math.max(0, sideScale - 1) + 0.22 * Math.max(0, 1 - legY))
  }
  const collapse = clamp((rawDropY - 0.05) / 0.18, 0, 1)
  const collapseLift =
    collapse < 1e-4
      ? 0
      : collapse * (0.20 * Math.max(0, proportions.torsoBulk - 1) + 0.08 * Math.max(0, proportions.headScale - 1) + 0.16 * Math.max(0, 1 - legY))
  return Math.max(rollLift, collapseLift)
}

/** Upward clearance as an arachnid flips or collapses belly-down so enlarged dorsal carapace/abdomen clears y = 0. */
export function arachnidFlipLiftY(proportions: ProportionLike, localUpY: number, rawDropY = 0): number {
  const flip = clamp((1 - localUpY) * 0.5, 0, 1)
  const collapse = clamp((rawDropY - 0.05) / 0.12, 0, 1)
  const factor = Math.max(flip, collapse)
  if (factor < 1e-4) return 0
  return factor * 0.22 * Math.max(0, Math.max(proportions.torsoBulk, proportions.headScale) - 1)
}

function setVec(out: Vec3Out, x: number, y: number, z: number): Vec3Out {
  out.x = x
  out.y = y
  out.z = z
  return out
}

const QUADRUPED_FRONT_LEG = /^leg_f[lr]_(upper|lower)$/

/** Scale of one bone in model axes (X width, Y up, Z depth) for the given proportions and rig contract. */
export function boneScaleFor<T extends Vec3Out>(
  boneName: string,
  proportions: ProportionLike,
  out: T,
  rigId: RigId = 'ual1',
): T {
  const {
    shoulderWidth,
    torsoBulk,
    waistScale,
    headScale,
    limbThickness,
    legRatio = 1,
    bodyLength = 1,
    neckScale = 1,
    handScale: handScaleOverride = 1,
    footScale: footScaleOverride = 1,
  } = proportions

  if (rigId === 'quadruped') {
    const legMass = 1 + 0.85 * (limbThickness - 1)
    const pawXZ = 1 + 0.4 * (limbThickness - 1)
    const pelvisY = 1 + 0.45 * (waistScale - 1)
    const spineY = 1 + 0.65 * (torsoBulk - 1)
    const chestY = 1 + 0.75 * (torsoBulk - 1)
    if (boneName === 'root') return setVec(out, 1, 1, 1) as T
    if (boneName === 'pelvis') {
      return setVec(out, Math.max(waistScale, 0.62 + 0.32 * legMass), pelvisY, bodyLength) as T
    }
    if (boneName === 'spine_01' || boneName === 'spine_02') {
      return setVec(out, (waistScale + torsoBulk) * 0.5, spineY, bodyLength) as T
    }
    if (boneName === 'chest') return setVec(out, shoulderWidth, chestY, bodyLength) as T
    if (boneName === 'neck') {
      const neck = 1 + 0.45 * (torsoBulk - 1) + 0.25 * (shoulderWidth - 1)
      return setVec(out, neck, neck, 0.5 + 0.5 * bodyLength) as T
    }
    if (boneName === 'head' || boneName === 'jaw') return setVec(out, headScale, headScale, headScale) as T
    if (boneName === 'tail_01' || boneName === 'tail_02' || boneName === 'tail_03') {
      return setVec(out, legMass, legMass, 0.65 + 0.35 * bodyLength) as T
    }
    if (QUADRUPED_FRONT_LEG.test(boneName)) {
      // Keep front and hind paws co-planar on y = 0 regardless of torsoBulk/waistScale spine depth changes.
      const frontUpperDeltaY = 0.03 * pelvisY + 0.06 * spineY - 0.12 * chestY
      const frontLegY = clamp((frontUpperDeltaY + 0.55 * legRatio) / 0.52, 0.45, 1.85)
      return setVec(out, legMass, frontLegY, legMass) as T
    }
    if (QUADRUPED_LEG.test(boneName)) return setVec(out, legMass, legRatio, legMass) as T
    if (QUADRUPED_PAW.test(boneName)) return setVec(out, pawXZ, 1, pawXZ) as T
    throw new Error(`"${boneName}" is not a quadruped bone.`)
  }

  if (rigId === 'arachnid') {
    const legSpanX = Math.max(legRatio, legRatio + 0.35 * Math.max(0, torsoBulk - 1))
    if (boneName === 'root') return setVec(out, 1, 1, 1) as T
    if (boneName === 'body') return setVec(out, shoulderWidth, 1 + 0.45 * (torsoBulk - 1), bodyLength) as T
    if (boneName === 'abdomen') return setVec(out, torsoBulk, torsoBulk, torsoBulk * bodyLength) as T
    if (boneName === 'head') return setVec(out, headScale, headScale, headScale) as T
    if (ARACHNID_SIDE_LEG.test(boneName)) {
      return setVec(out, legSpanX, 1, limbThickness) as T
    }
    if (ARACHNID_DIAG_LEG.test(boneName)) {
      const diagZ = 0.65 * legSpanX + 0.35 * limbThickness
      return setVec(out, legSpanX, 1, diagZ) as T
    }
    throw new Error(`"${boneName}" is not an arachnid bone.`)
  }

  const { legY, torsoY, armReach } = humanStatureFor(proportions)
  // Moderate pelvis vertical stretch so hips & crotch stay aligned with femur sockets while upper spine absorbs legRatio.
  const pelvisY = clamp(0.6 + 0.4 * torsoY, 0.78, 1.22)
  const upperTorsoY = clamp((torsoY * UAL1_TORSO_H - UAL1_PELVIS_H * pelvisY) / UAL1_UPPER_TORSO_H, 0.35, 2.25)
  const neckY = clamp(1 + 0.35 * (upperTorsoY - 1), 0.8, 1.35)
  const upperSpineY = (upperTorsoY * UAL1_UPPER_TORSO_H - neckY * UAL1_NECK_H) / UAL1_UPPER_SPINE_H
  const handScale = (1 + 0.35 * (limbThickness - 1)) * handScaleOverride
  const footXZ = (1 + 0.25 * (limbThickness - 1)) * footScaleOverride
  const upperMass = 1 + 1.05 * (limbThickness - 1)
  const lowerMass = 1 + 0.8 * (limbThickness - 1)
  const spine02X = 1 + 0.3 * (shoulderWidth - 1) + 0.4 * (waistScale - 1) + 0.3 * (torsoBulk - 1)
  const spine03X = 1 + 0.55 * (shoulderWidth - 1) + 0.25 * (torsoBulk - 1)

  const name = boneName.replace(SIDE_SUFFIX, '')
  if (FINGER.test(name)) return setVec(out, handScale, handScale, handScale) as T
  switch (name) {
    case 'root':
      return setVec(out, 1, 1, 1) as T
    case 'pelvis':
      return setVec(
        out,
        Math.max(1 + 0.45 * (waistScale - 1), 0.94 * (0.64 + 0.36 * upperMass)),
        pelvisY,
        Math.max(1 + 0.7 * (waistScale - 1), 0.72 + 0.28 * upperMass),
      ) as T
    case 'spine_01':
      return setVec(
        out,
        1 + 0.85 * (waistScale - 1) + 0.15 * (torsoBulk - 1),
        upperSpineY,
        1 + 0.85 * (waistScale - 1) + 0.15 * (torsoBulk - 1),
      ) as T
    case 'spine_02':
      return setVec(out, spine02X, upperSpineY, 0.65 * torsoBulk + 0.35 * waistScale) as T
    case 'spine_03':
      return setVec(out, spine03X, upperSpineY, torsoBulk) as T
    case 'clavicle': {
      const minClavX =
        1.196 * Math.max(spine03X, spine02X * 0.96) -
        0.196 +
        0.28 * Math.max(0, limbThickness - 1) +
        0.38 * Math.max(0, torsoBulk - 1) +
        0.18 * Math.max(0, waistScale - 1)
      return setVec(
        out,
        Math.max(1 + 1.45 * (shoulderWidth - 1), minClavX),
        upperSpineY,
        1 + 0.55 * (torsoBulk - 1),
      ) as T
    }
    case 'neck_01': {
      const neck = (1 + 0.18 * (torsoBulk - 1)) * neckScale
      return setVec(out, neck, neckY, neck) as T
    }
    case 'Head':
      return setVec(out, headScale, headScale, headScale) as T
    case 'upperarm':
      return setVec(out, armReach, upperMass, upperMass) as T
    case 'lowerarm':
      return setVec(out, armReach, lowerMass, lowerMass) as T
    case 'thigh':
      return setVec(out, 1 + 0.68 * (limbThickness - 1), legY, upperMass) as T
    case 'calf':
      return setVec(out, lowerMass, legY, lowerMass) as T
    case 'hand':
      return setVec(out, handScale, handScale, handScale) as T
    case 'foot':
    case 'ball':
      return setVec(out, footXZ, 1, footXZ) as T
    default:
      throw new Error(`"${boneName}" is not a UAL1 bone.`)
  }
}
