import type { AvatarProportions } from '@voxchar/contracts/catalog'
import type { RigId } from '@voxchar/contracts/rig'

/**
 * Camera framing of the avatar lab for each rig.
 *
 * The lab has a HUD bar on the top edge of the viewport. The subject must stay below that bar
 * with headroom, at every rig size (a 1.34x troll, a long wolf, a wide spider).
 */

interface RigStageSpec {
  /** Subject height in metres at height 1.0. It includes headgear, raised weapons and attack poses. */
  height: number
  /** Camera turn about the subject, in degrees. 0 looks at the front (+Z). */
  yawDeg: number
  /** Camera angle above the horizon, in degrees. */
  pitchDeg: number
  /** Plinth radius in metres at height 1.0. The plinth holds the full footprint of the subject. */
  plinthRadius: number
  headTargetY: number
  headDistance: number
  feetTargetY: number
  feetDistance: number
}

const RIG_STAGE: Readonly<Record<RigId, RigStageSpec>> = {
  ual1: { height: 2.16, yawDeg: 20, pitchDeg: 6, plinthRadius: 0.86, headTargetY: 1.56, headDistance: 1.45, feetTargetY: 0.38, feetDistance: 1.85 },
  // A front view shortens a quadruped or spider to a blob. A 3/4 view shows the side line, the stride and the tail.
  quadruped: { height: 1.4, yawDeg: 38, pitchDeg: 7, plinthRadius: 1.1, headTargetY: 0.85, headDistance: 1.55, feetTargetY: 0.38, feetDistance: 1.85 },
  arachnid: { height: 1.1, yawDeg: 36, pitchDeg: 14, plinthRadius: 1.16, headTargetY: 0.34, headDistance: 1.55, feetTargetY: 0.24, feetDistance: 1.85 },
  fox: { height: 1.05, yawDeg: 42, pitchDeg: 8, plinthRadius: 1.05, headTargetY: 0.64, headDistance: 1.4, feetTargetY: 0.25, feetDistance: 1.65 },
  horse: { height: 2.35, yawDeg: 44, pitchDeg: 7, plinthRadius: 1.95, headTargetY: 1.72, headDistance: 2.0, feetTargetY: 0.45, feetDistance: 2.4 },
  wolf: { height: 1.4, yawDeg: 40, pitchDeg: 7, plinthRadius: 1.3, headTargetY: 0.92, headDistance: 1.55, feetTargetY: 0.32, feetDistance: 1.85 },
  corgi: { height: 0.7, yawDeg: 38, pitchDeg: 10, plinthRadius: 0.55, headTargetY: 0.4, headDistance: 1.1, feetTargetY: 0.16, feetDistance: 1.2 },
  pug: { height: 0.68, yawDeg: 38, pitchDeg: 10, plinthRadius: 0.55, headTargetY: 0.38, headDistance: 1.1, feetTargetY: 0.16, feetDistance: 1.2 },
  gsd: { height: 1.45, yawDeg: 40, pitchDeg: 8, plinthRadius: 1.0, headTargetY: 1.0, headDistance: 1.45, feetTargetY: 0.32, feetDistance: 1.8 },
  cat: { height: 0.72, yawDeg: 38, pitchDeg: 10, plinthRadius: 0.55, headTargetY: 0.42, headDistance: 1.05, feetTargetY: 0.16, feetDistance: 1.2 },
  aquatic: { height: 1.4, yawDeg: 48, pitchDeg: 8, plinthRadius: 1.45, headTargetY: 0.72, headDistance: 1.35, feetTargetY: 0.45, feetDistance: 1.65 },
  avian: { height: 1.6, yawDeg: 38, pitchDeg: 14, plinthRadius: 1.75, headTargetY: 0.72, headDistance: 1.25, feetTargetY: 0.16, feetDistance: 1.45 },
  serpent: { height: 1.25, yawDeg: 52, pitchDeg: 12, plinthRadius: 1.45, headTargetY: 0.52, headDistance: 1.15, feetTargetY: 0.12, feetDistance: 1.65 },
  dragon: { height: 2.15, yawDeg: 40, pitchDeg: 12, plinthRadius: 2.25, headTargetY: 1.0, headDistance: 1.65, feetTargetY: 0.25, feetDistance: 2.1 },
  kaiju: { height: 2.05, yawDeg: 42, pitchDeg: 8, plinthRadius: 1.55, headTargetY: 1.62, headDistance: 1.6, feetTargetY: 0.28, feetDistance: 1.95 },
}

/** Part of the viewport height that the HUD bar covers, plus headroom below it. */
const HUD_BAND = 0.16
/** Part of the viewport height below the feet. It shows the front edge of the plinth. */
const FLOOR_BAND = 0.13
const SIDE_MARGIN = 1.1
/** Width of the plinth bevel outside its top face, in metres. */
export const PLINTH_BEVEL = 0.16
/** Lowest place of the near plinth edge in the frame: 1 is the bottom edge of the viewport. */
const NEAR_EDGE_LIMIT = 0.95
export const LAB_FOV_DEG = 36

export interface LabFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  plinthRadius: number
}

export type ReviewCameraAngle = 'threeQuarter' | 'front' | 'side' | 'back' | 'head' | 'feet'

export function labFramingFor(rigId: RigId, proportions: AvatarProportions, aspect: number): LabFraming {
  return labAngleFramingFor(rigId, proportions, aspect, 'threeQuarter')
}

export function labAngleFramingFor(
  rigId: RigId,
  proportions: AvatarProportions,
  aspect: number,
  angle: ReviewCameraAngle,
): LabFraming {
  const stage = RIG_STAGE[rigId]
  const legRatio = proportions.legRatio ?? 1
  const bodyLength = proportions.bodyLength ?? 1
  const height =
    rigId === 'quadruped'
      ? stage.height * proportions.height * (0.55 + 0.45 * legRatio)
      : stage.height * proportions.height
  const spreadScale =
    rigId === 'arachnid'
      ? Math.max(1, legRatio, bodyLength)
      : rigId === 'quadruped'
        ? Math.max(1, bodyLength)
        : 1
  const plinthRadius = stage.plinthRadius * Math.max(1, proportions.height) * spreadScale

  const tanHalf = Math.tan((LAB_FOV_DEG * Math.PI) / 360)
  const pitchDeg = angle === 'head' ? 4 : angle === 'feet' ? 4 : stage.pitchDeg
  const yawDeg =
    angle === 'front'
      ? 0
      : angle === 'side'
        ? 90
        : angle === 'back'
          ? 180
          : angle === 'head'
            ? 20
            : angle === 'feet'
              ? 34
              : stage.yawDeg

  const pitch = (pitchDeg * Math.PI) / 180
  const yaw = (yawDeg * Math.PI) / 180

  if (angle === 'head') {
    const h = proportions.height
    const targetY = stage.headTargetY * h
    const distance = stage.headDistance * Math.max(0.85, h)
    const flat = distance * Math.cos(pitch)
    return {
      position: [Math.sin(yaw) * flat, targetY + distance * Math.sin(pitch), Math.cos(yaw) * flat],
      target: [0, targetY, 0],
      plinthRadius,
    }
  }

  if (angle === 'feet') {
    const h = proportions.height
    const targetY = stage.feetTargetY * h
    const distance = stage.feetDistance * Math.max(0.85, h)
    const flat = distance * Math.cos(pitch)
    return {
      position: [Math.sin(yaw) * flat, targetY + distance * Math.sin(pitch), Math.cos(yaw) * flat],
      target: [0, targetY, 0],
      plinthRadius,
    }
  }

  const fitHeight = height / (2 * tanHalf * (1 - HUD_BAND - FLOOR_BAND))
  // The subject can turn on the turntable. Fit the full plinth, so no pose leaves the frame.
  const fitWidth = ((plinthRadius + PLINTH_BEVEL) * SIDE_MARGIN) / (tanHalf * Math.max(aspect, 0.2))
  let distance = Math.max(fitHeight, fitWidth)
  let targetY = 0
  // The camera looks down at a wide plinth. Move back until the near edge of the plinth top is in the frame.
  for (let step = 0; step < 40; step++) {
    // Move the target up, so the subject sits in the band between the HUD bar and the floor margin.
    targetY = height / 2 + distance * tanHalf * (HUD_BAND - FLOOR_BAND)
    const cameraHeight = targetY + distance * Math.sin(pitch)
    const nearEdge = distance * Math.cos(pitch) - plinthRadius
    const below = Math.tan(Math.atan2(cameraHeight, nearEdge) - pitch) / tanHalf
    if (nearEdge > 0 && below <= NEAR_EDGE_LIMIT) break
    distance *= 1.04
  }

  const flat = distance * Math.cos(pitch)
  return {
    position: [Math.sin(yaw) * flat, targetY + distance * Math.sin(pitch), Math.cos(yaw) * flat],
    target: [0, targetY, 0],
    plinthRadius,
  }
}
