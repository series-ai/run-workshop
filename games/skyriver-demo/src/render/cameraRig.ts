/**
 * @file cameraRig.ts — the Skyriver chase camera, as a pure function of the frame it renders.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R5 — "chase-cam smoothing is a pure function of (previous projection, current projection, alpha)
 *     with explicit reset on restore/rollback".
 *   P2-13 — pure chase-cam smoothing specified (no persistent smoothing accumulators).
 *   Visual target "Chase Cam — Red Shuttle" — the shuttle sits ahead in frame with its thrusters
 *     toward the camera, the city canyon opening up past it.
 *   A5 — "chase-cam shows no jump after simulated restore".
 *
 * WHY THERE IS NO SMOOTHING STATE
 * -------------------------------
 * The obvious way to write a chase cam is to keep a camera position and ease it toward a target each
 * frame. That is exactly what breaks under this engine: a rollback, a checkpoint hydration or a
 * replay seek moves the simulation discontinuously, and an eased camera would then sweep across the
 * seam — a visible jump whose length depends on how far the sim moved. Every value here is computed
 * from (previous projection, current projection, alpha) alone, so the pose after a restore is the
 * pose the same frame always had. "Reset on restore" is free because there is nothing to reset.
 *
 * The smoothing the look needs instead comes from interpolation (session.ts interpolates the two
 * projections, and snaps rather than sweeps when the tick gap is not 1) and from the boom geometry,
 * which trails the shuttle's own heading rather than chasing the camera's previous heading.
 *
 * Angles are in turns, matching the sim (src/sim/systems.ts). Determinism is not required here —
 * this is presentation only, never checksummed — so plain Math.sin/Math.cos are correct and cheap.
 */
import type { PerspectiveCamera } from 'three';

import type { SkyriverProjection } from '../sim/runtime';
import { interpolateSkyriverFlight } from '../sim/session';
import { CHASM_BOUNDS, type SkyriverCamera, type SkyriverFlight } from '../sim/systems';
import { SKYRIVER_ROOFLINE_MIN_M } from './presentationLayout';

const TURNS_TO_RADIANS = Math.PI * 2;

/** Boom length at cruise speed, metres. Far enough back to hold the whole shuttle in frame. */
export const CHASE_DISTANCE_M = 22;
/** Extra boom length at top speed. Acceleration reads as the city pulling away behind the craft. */
export const CHASE_SPEED_PULLBACK_M = 10;
/** Boom lift above the shuttle, metres. Puts the rear deck and its taillight strip in view. */
/** T7: craned up — the chase looks down on the shuttle and into the canyon below it. */
export const CHASE_HEIGHT_M = 10.5;
/**
 * How much of the shuttle's own climb angle the boom follows, 0..1.
 *
 * Below 1 the boom stays flatter than the craft, so a climb shows the thrusters and a dive shows the
 * canopy instead of the camera rigidly sitting on the flight axis. T6R lowered it from 0.55: at the
 * sim's 54-degree pitch limit the old boom pitched the view ~30 degrees up, over the roofline.
 */
export const CHASE_PITCH_FOLLOW = 0.2;
/**
 * T6R hard limits on the boom elevation, turns, after the orbit offset is added: about 20 degrees
 * down and 9 degrees up. Combined with the presented canyon walls (presentationLayout.ts) this keeps
 * every frame inside the chasm: walls on both sides, depth below, never a full-sky frame.
 */
/** T7-2: limit ~-12 degrees (was -20): the horizon holds the top 25-30% of the frame. */
export const CHASE_PITCH_MIN_TURNS = -0.034;
export const CHASE_PITCH_MAX_TURNS = 0.025;
/** Aim point ahead of the shuttle, metres, along the boom. */
export const CHASE_LOOK_AHEAD_M = 140;
/**
 * Aim point drop, metres. Tilts the view down into the canyon so the shuttle sits in the lower third
 * and the vanishing point sits ahead of and above it (the Neon Rain composition).
 */
/** T7: ~12 degrees more look-down than T6R-2 (aim drop 9 m -> 36 m at 140 m ahead, plus the crane). */
/**
 * T7-2: aim drop retuned with the crane so the view pitches ~12.5 degrees down: rivers and depth
 * below, horizon near the top 30%, crowned rooflines and the hazed sky band in the upper third.
 */
export const CHASE_LOOK_DOWN_M = 25;
/** T7-3: aim a few degrees higher than T7-2 so crowns and the sky band frame the winding view. */
export const CHASE_LOOK_DOWN_AUTOPILOT_M = 13;
/** T7-3: share of the craft's bank the camera follows (it leans into the turns with it). */
export const CHASE_BANK_FOLLOW = 0.55;
/** T7 boost drama: field-of-view widen at full boost, degrees, and camera shake amplitude, metres. */
export const CHASE_BOOST_FOV_DEG = 12;
export const CHASE_BOOST_SHAKE_M = 0.28;
export const CHASE_BASE_FOV_DEG = 62;
/**
 * T7 fly mode: the boom's heading is compressed toward the canyon axis by this factor on its
 * across-canyon component, so the vanishing point and both walls stay in frame while the pilot
 * crabs. Continuous everywhere; only a heading within a few degrees of dead-across still faces a wall.
 */
export const CHASE_FLY_YAW_COMPRESSION = 0.45;
/** T7 fly mode: when the wall ahead is nearer than this, metres, the boom lengthens (up to +14 m). */
export const CHASE_WALL_PULLBACK_RANGE_M = 380;

/** The camera never drops below this altitude, metres. Keeps a dive out of the city floor. */
export const CHASE_MIN_ALTITUDE_M = Math.max(12, CHASM_BOUNDS.minY - 40);
/** The camera never rises above this, metres: under the presented roofline with margin. */
export const CHASE_MAX_ALTITUDE_M = SKYRIVER_ROOFLINE_MIN_M - 120;
/** The camera never leaves the corridor sideways (inner tower faces sit at |x| >= 440). */
export const CHASE_MAX_ABS_X_M = 425;

/** Speed band the pull-back is measured against (mirrors systems.ts SPEED_MIN/MAX_MPS). */
const SPEED_FLOOR_MPS = 40;
const SPEED_CEILING_MPS = 260;
/** Boost multiplier in systems.ts, so a boosted frame pulls back past the un-boosted ceiling. */
const BOOST_SPEED_HEADROOM = 1.8;

export interface SkyriverVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SkyriverCameraPose {
  readonly position: SkyriverVec3;
  /** World point the camera looks at. */
  readonly target: SkyriverVec3;
  /** Boom length actually used this frame, metres. For the debug line. */
  readonly distance: number;
  /** T7: vertical field of view, degrees (absent on poses built before T7). */
  readonly fov?: number;
  /** T7-3: roll about the view axis, radians. */
  readonly roll?: number;
}

/** The writable form of a pose, for a caller that reuses one scratch object per frame. */
export interface SkyriverCameraPoseScratch {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  distance: number;
  /** T7: vertical field of view for this frame, degrees. */
  fov: number;
  /** T7-3: camera roll about the view axis, radians (banks into the turns). */
  roll: number;
}

/** T7 presentation-only effects, each a pure function of the frame's state. */
export interface SkyriverCameraEffects {
  /** 0..1 boost drama level (flightPresentation.ts boostVisual). */
  readonly boost: number;
  /** Continuous presentation time, seconds (tick + alpha), for the shake phase. */
  readonly time: number;
}

/**
 * Allocates a scratch pose.
 *
 * A scratch buffer is not smoothing state: nothing is read back out of it, so the pose written on
 * any frame depends only on that frame's arguments. Reusing one keeps the render loop
 * allocation-free, which is the same discipline T4's traffic update follows.
 */
export function createCameraPoseScratch(): SkyriverCameraPoseScratch {
  return {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: CHASE_DISTANCE_M,
    fov: CHASE_BASE_FOV_DEG,
    roll: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Normalized position in the speed band, including the boost headroom. */
function speedFactor(speed: number, boostT: number): number {
  const ceiling = SPEED_CEILING_MPS * (boostT > 0 ? BOOST_SPEED_HEADROOM : 1);
  return clamp((speed - SPEED_FLOOR_MPS) / (ceiling - SPEED_FLOOR_MPS), 0, 1);
}

/**
 * Writes the chase pose for one interpolated flight state.
 *
 * The boom sits behind the craft along (yaw + orbitYaw) and is lifted along world up, so the orbit
 * offsets the pilot accumulates are a rigid rotation of the boom rather than a re-aim of the camera.
 * In autopilot the sim drives those offsets from the steering axes; in free flight the sim relaxes
 * them back to zero (systems.ts), so the same expression serves both modes and the free-flight
 * camera settles behind the craft on its own.
 */
export function writeCameraPose(
  out: SkyriverCameraPoseScratch,
  flight: SkyriverFlight,
  camera: SkyriverCamera,
  effects: SkyriverCameraEffects = { boost: 0, time: 0 },
): SkyriverCameraPoseScratch {
  let headingRad = flight.yaw * TURNS_TO_RADIANS;
  if (flight.mode === 1) {
    headingRad = Math.atan2(Math.sin(headingRad) * CHASE_FLY_YAW_COMPRESSION, Math.cos(headingRad));
  }
  const boomYawRad = headingRad + camera.orbitYaw * TURNS_TO_RADIANS;
  const boomPitchRad = clamp(
    flight.pitch * CHASE_PITCH_FOLLOW + camera.orbitPitch,
    CHASE_PITCH_MIN_TURNS,
    CHASE_PITCH_MAX_TURNS,
  ) * TURNS_TO_RADIANS;

  const boomCosPitch = Math.cos(boomPitchRad);
  // Same basis as the sim's kinematics (systems.ts): yaw 0 faces +Z, pitch lifts +Y.
  const boomX = Math.sin(boomYawRad) * boomCosPitch;
  const boomY = Math.sin(boomPitchRad);
  const boomZ = Math.cos(boomYawRad) * boomCosPitch;

  let distance = CHASE_DISTANCE_M
    + CHASE_SPEED_PULLBACK_M * speedFactor(flight.speed, flight.boostT);
  if (flight.mode === 1 && Math.abs(boomX) > 0.05) {
    // Distance to the inner wall face (|x| ~ 510) along the boom's heading.
    const wallAhead = ((Math.sign(boomX) * 510) - flight.x) / boomX;
    if (wallAhead < CHASE_WALL_PULLBACK_RANGE_M) {
      distance += Math.min(14, (CHASE_WALL_PULLBACK_RANGE_M - Math.max(wallAhead, 0)) * 0.05);
    }
  }

  out.distance = distance;
  // The |x| corridor clamp is a free-flight guard: autopilot runs around the whole loop in world space.
  out.position.x = flight.mode === 1
    ? clamp(flight.x - boomX * distance, -CHASE_MAX_ABS_X_M, CHASE_MAX_ABS_X_M)
    : flight.x - boomX * distance;
  // T7-5 descent framing: on a dive the boom drops with the craft instead of hanging above it, so the
  // shuttle keeps its size in frame rather than shrinking into a top-down view.
  const climb = Math.sin(flight.pitch * TURNS_TO_RADIANS);
  const descentDrop = flight.mode === 0 ? Math.max(0, -climb) * distance * 0.6 : 0;
  out.position.y = clamp(flight.y - boomY * distance + CHASE_HEIGHT_M - descentDrop, CHASE_MIN_ALTITUDE_M, CHASE_MAX_ALTITUDE_M);
  out.position.z = flight.z - boomZ * distance;

  // The aim runs along the *boom*, not along the craft's own heading.
  //
  // Measured, after a first version aimed down the flight axis: when the boom follows only part of
  // the climb angle (CHASE_PITCH_FOLLOW) but the aim follows all of it, the two diverge in
  // proportion to pitch, and at the sim's 0.15-turn pitch limit the shuttle slides off the bottom of
  // the frame entirely. Aiming along the boom makes the craft's screen position a constant of the
  // rig's geometry instead of a function of how steeply it happens to be climbing, and it gives the
  // orbit offsets their natural meaning: orbiting circles the shuttle rather than panning off it.
  out.target.x = flight.x + boomX * CHASE_LOOK_AHEAD_M;
  // T7-5: on climbs the aim lifts toward the skyline, so crowns and the haze band frame the view.
  const climbLift = flight.mode === 0 ? Math.min(0.25, Math.max(0, climb)) * CHASE_LOOK_AHEAD_M * 0.55 : 0;
  out.target.y = flight.y + boomY * CHASE_LOOK_AHEAD_M - (flight.mode === 0 ? CHASE_LOOK_DOWN_AUTOPILOT_M : CHASE_LOOK_DOWN_M) + climbLift;
  const rollTurns = (flight as { roll?: number }).roll ?? 0;
  out.roll = rollTurns * TURNS_TO_RADIANS * CHASE_BANK_FOLLOW;
  out.target.z = flight.z + boomZ * CHASE_LOOK_AHEAD_M;

  // Boost drama: a wider lens and a fine, fast shake. Both are pure functions of (boost, time).
  const boost = clamp(effects.boost, 0, 1);
  out.fov = CHASE_BASE_FOV_DEG + CHASE_BOOST_FOV_DEG * boost * boost * (3 - 2 * boost);
  if (boost > 0) {
    const t = effects.time;
    const amplitude = CHASE_BOOST_SHAKE_M * boost;
    out.position.x += amplitude * Math.sin(t * 37.1) * Math.sin(t * 5.3 + 1.1);
    out.position.y += amplitude * Math.sin(t * 43.7 + 2.0) * Math.sin(t * 6.1);
    out.target.y += amplitude * 2.2 * Math.sin(t * 29.3 + 0.7);
  }

  return out;
}

/**
 * The pose for the frame between two projections — the R5 signature.
 *
 * Interpolation is delegated to session.ts so the camera and the HUD cannot disagree about where the
 * shuttle is this frame, and so the "snap, do not sweep, across a tick gap" rule lives in exactly
 * one place.
 */
export function cameraPoseAt(
  previous: SkyriverProjection,
  current: SkyriverProjection,
  alpha: number,
  out: SkyriverCameraPoseScratch = createCameraPoseScratch(),
): SkyriverCameraPose {
  const blended = interpolateSkyriverFlight(previous, current, alpha);
  return writeCameraPose(out, blended.flight, blended.camera);
}

/**
 * Moves a three.js camera onto a pose.
 *
 * `three` is a type-only import: this touches only methods that already exist on the camera the
 * scene owns, so the rig stays loadable in node for a unit test.
 */
export function applyCameraPose(camera: PerspectiveCamera, pose: SkyriverCameraPose): void {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  if (pose.roll !== undefined && pose.roll !== 0) camera.rotateZ(pose.roll);
  if (pose.fov !== undefined && Math.abs(camera.fov - pose.fov) > 1e-3) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}
