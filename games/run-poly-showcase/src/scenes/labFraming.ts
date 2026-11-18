import type { AvatarProportions } from '@poly/contracts/catalog'
import type { RigId } from '@poly/contracts/rig'

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
}

const RIG_STAGE: Readonly<Record<RigId, RigStageSpec>> = {
  ual1: { height: 2.16, yawDeg: 20, pitchDeg: 6, plinthRadius: 0.86 },
  // A front view shortens a wolf or a spider to a blob. A 3/4 view shows the side line, the stride and the tail.
  quadruped: { height: 1.4, yawDeg: 38, pitchDeg: 7, plinthRadius: 1.1 },
  arachnid: { height: 1.1, yawDeg: 36, pitchDeg: 14, plinthRadius: 1.16 },
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

export function labFramingFor(rigId: RigId, proportions: AvatarProportions, aspect: number): LabFraming {
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
  const pitch = (stage.pitchDeg * Math.PI) / 180
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

  const yaw = (stage.yawDeg * Math.PI) / 180
  const flat = distance * Math.cos(pitch)
  return {
    position: [Math.sin(yaw) * flat, targetY + distance * Math.sin(pitch), Math.cos(yaw) * flat],
    target: [0, targetY, 0],
    plinthRadius,
  }
}
