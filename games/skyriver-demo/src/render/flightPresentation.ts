/**
 * @file flightPresentation.ts — where the shuttle is *drawn*, as a pure function of the sim state.
 *
 * T6R P0 "camera escapes the chasm". The sim's seeded autopilot ring (systems.ts deriveFlightPath)
 * is a ~200 m circle whose 24 waypoints alternate between ~330 m and ~1130 m altitude, often only
 * 50-100 m apart horizontally. Followed literally, the shuttle yo-yos at the 54-degree pitch limit
 * and spends half of every loop pointed across the canyon at a wall. systems.ts is frozen (it is a
 * hashed sim source), so the canyon run is a presentation mapping instead:
 *
 *   Autopilot — a pure tick-based arc runs at 70% of the old 150 m/s cruise presentation rate. The
 *   sim still owns its ring pose and speed. The draw route uses tick and alpha, so new presenters,
 *   rollback, and lap wrap agree.
 *
 *   Free flight — the sim pose is drawn as is. A 75-tick blend joins the frozen autopilot route to
 *   the sim ring pose. A second 75-tick blend joins a free-flight pose back to the clock route.
 *
 * The runner's per-tick mode events store source poses by tick, even when the display skips frames.
 * A caller-owned timeline epoch clears those records when the runner replaces its history. A restore
 * inside a transition still lacks its source event because the projection has no transition history.
 */
import type { SkyriverRenderState } from '../sim/session';
import {
  deriveFlightPath,
  type SkyriverFlight,
} from '../sim/systems';
import { CANYON_LOOP_LENGTH_M, canyonBendApexes, canyonHeading, warpCanyon, wrapCanyonV, type WarpOut } from './canyonWarp';
import { SKYRIVER_ROOFLINE_MIN_M } from './presentationLayout';
import { SKYRIVER_SHOWCASE_BEND_V } from './city';
import { ROUTE_MAX_ALTITUDE_M, routeAltitude, routeAltitudeSlope, routeLateral, routeLateralSlope } from './routeProfile';
import { SHUTTLE_NOZZLE_ROOTS_LOCAL, SHUTTLE_WAKE_SAMPLE_COUNT } from './shuttle';

const TAU = Math.PI * 2;

/**
 * T7-3 bank: roll, in turns, per unit of path curvature (1/m), and its cap. At the loop's tightest
 * S-bends (~1/800 m) plus the route's own snake this banks the craft ~20-25 degrees into the turn.
 */
/** T7-5: soft-limited bank (tanh, never rail-hits a clamp) with a slow per-stretch variation. */
const BANK_TURNS_PER_CURVATURE = 46;
const BANK_MAX_TURNS = 0.1;
const BANK_VARIATION_WAVELENGTH_M = 2300;
/** Arc-length step for the numeric heading derivative, metres. */
const CURVATURE_STEP_M = 12;

/** Free-flight hand-off easing, ticks (30 Hz). */
const HANDOFF_TICKS = 75;
/** Boost drama ramp-in seconds and release ticks (30 Hz). */
const BOOST_RAMP_S = 0.2;
const BOOST_RELEASE_TICKS = 18;
/** R29 keeps the route pure while reducing the old 150 m/s steady autopilot presentation by 30%. */
export const SKYRIVER_AUTOPILOT_PRESENTATION_SHARE = 0.7;
export const SKYRIVER_AUTOPILOT_REFERENCE_SPEED_MPS = 150;
/** main.ts uses this same shallow pitch on the hull and in the exhaust nozzle transform. */
export const SHUTTLE_DRAW_PITCH_SHARE = 0.45;
export const SHUTTLE_WAKE_CRUISE_LENGTH_M = 80;
export const SHUTTLE_WAKE_BOOST_LENGTH_M = 160;
export const SHUTTLE_WAKE_CRUISE_WIDTH_M = 2.5;
export const SHUTTLE_WAKE_BOOST_WIDTH_M = 4.5;
export const SHUTTLE_WAKE_TAIL_WIDTH_M = 0.5;
/** Blend the transformed nozzle into exact route samples over a short weld region. */
export const SHUTTLE_WAKE_WELD_BLEND_M = 15;
const WAKE_TURBULENCE_CYCLES = 23;
const WAKE_TURBULENCE_RATE = 2.7;
const WAKE_TURBULENCE_M = 0.12;
const WAKE_ROUTE_BLEND_MAX_OFFSET_M = 1;

if (ROUTE_MAX_ALTITUDE_M > SKYRIVER_ROOFLINE_MIN_M - 200) {
  throw new Error('SKYRIVER_ROUTE_ABOVE_ROOFLINE');
}

/** The drawn pose: a SkyriverFlight (so cameraRig consumes it unchanged) plus a cosmetic roll. */
export interface PresentedFlight extends SkyriverFlight {
  readonly roll: number;
  /**
   * T7: 0..1 boost drama level for the camera (FOV widen, shake). Ramps in over the first 0.4 s of
   * boost, and eases out over BOOST_RELEASE_TICKS after the sim drops boostT to 0 on release.
   */
  readonly boostVisual: number;
  /**
   * R12 landmark reveal: at a tight bend's entry, the world point of the bend's mega-tower body and a
   * 0..1 weight the camera leans its aim toward it by. 0 away from bend entries and in free flight.
   */
  readonly revealX: number;
  readonly revealZ: number;
  readonly revealWeight: number;
  /** Retired in T7-3 (the loop has no cuts); always 0. */
  readonly cutFade: number;
  /** T7-3: the pose in canyon space (v along the loop, x across). Free flight: the box is straight. */
  readonly canyonV: number;
  readonly canyonX: number;
  /** Route coordinate and blend weight for the wake during either flight-mode hand-off. */
  readonly wakeTrackV: number;
  readonly wakeTrackWeight: number;
}

type MutablePresented = { -readonly [K in keyof PresentedFlight]: PresentedFlight[K] };

export interface TrackPose {
  cutFade: number;
  v: number;
  lateral: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** Minimal current render pose needed to sample the world-space exhaust. */
export interface ShuttleWakePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly mode: number;
  readonly boostVisual: number;
  readonly canyonV: number;
  readonly wakeTrackV: number;
  readonly wakeTrackWeight: number;
}

/** Reusable arrays and scratch poses for 32 world-space wake samples. */
export interface WorldWakeSamples {
  readonly centers: Float32Array;
  readonly tangents: Float32Array;
  readonly leftCenters: Float32Array;
  readonly rightCenters: Float32Array;
  readonly leftTangents: Float32Array;
  readonly rightTangents: Float32Array;
  readonly routeCenters: Float32Array;
  readonly freeCenters: Float32Array;
  readonly track: TrackPose;
  readonly roots: readonly [Float64Array, Float64Array];
  lengthM: number;
  rootWidthM: number;
  tailWidthM: number;
}

interface TransitionPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly canyonV: number;
  readonly canyonX: number;
}

type MutableTransitionPose = { -readonly [K in keyof TransitionPose]: TransitionPose[K] };

interface ModeTransition {
  readonly startTick: number;
  readonly fromMode: SkyriverFlight['mode'];
  readonly toMode: SkyriverFlight['mode'];
  readonly previousFlightKey: string;
  readonly targetFlightKey: string;
  readonly targetAnchorV: number;
  readonly initialArcDelta: number;
  readonly source: TransitionPose;
}

interface TransitionEvaluation {
  active: boolean;
  progress: number;
}

export interface SkyriverFlightPresenter {
  /**
   * Starts a new simulation timeline. The epoch must increase after rollback, history replacement,
   * or restore. A seek within the same history keeps its epoch. A fresh restore inside a blend still
   * needs the source mode event; projections do not include that event's history.
   */
  resetTimeline(epoch: number): void;
  /**
   * Records an authoritative adjacent mode edge from the runner event callback. It reads only
   * previous/current; render alpha is not part of the event timestamp.
   */
  observeModeEdge(state: Pick<SkyriverRenderState, 'previous' | 'current'>, epoch: number): void;
  /** Writes the drawn pose for this frame into an internal scratch object and returns it. */
  present(state: SkyriverRenderState, epoch: number): PresentedFlight;
  /** Track length, metres (for probes). */
  readonly trackLength: number;
  /** Cruise speed used by the pure tick-based autopilot route. */
  readonly autopilotSpeedMps: number;
}

/** Pure route distance for one simulation timestamp. The loop seam is exact. */
export function skyriverAutopilotArc(
  tick: number,
  alpha: number,
  speedMps: number,
  trackLength = CANYON_LOOP_LENGTH_M,
): number {
  const timeSeconds = (tick + alpha) / 30;
  return wrap(timeSeconds * speedMps, trackLength);
}

function wrap(value: number, period: number): number {
  const w = value % period;
  return w < 0 ? w + period : w;
}

function smoothstep01(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

function wrapTurns(turns: number): number {
  return turns - Math.round(turns);
}

/** Heading of the route itself (canyon heading plus the snake's angle), radians. */
function routeHeading(v: number): number {
  return canyonHeading(v) + Math.atan(routeLateralSlope(v));
}

const poseWarp: WarpOut = { x: 0, z: 0, heading: 0 };

/**
 * The autopilot's drawn pose at track arc length `uIn` (0 = the lap start). Pure; exported so the
 * loop-wide clearance test (tests/clearance.test.ts) sweeps exactly the poses the game draws.
 */
export function autopilotTrackPose(uIn: number, out: TrackPose): TrackPose {
  const trackLength = CANYON_LOOP_LENGTH_M;
  const v = wrap(uIn + trackLength / 2, trackLength) - trackLength / 2;
  warpCanyon(routeLateral(v), v, poseWarp);
  const heading = routeHeading(v);
  // Bank into the turn: signed curvature of the route in the horizontal plane.
  let dh = routeHeading(v + CURVATURE_STEP_M) - routeHeading(v - CURVATURE_STEP_M);
  dh -= TAU * Math.round(dh / TAU);
  const curvature = dh / (2 * CURVATURE_STEP_M);
  const character = 0.7 + 0.3 * Math.sin((TAU * v) / BANK_VARIATION_WAVELENGTH_M + 0.8);
  const bank = BANK_MAX_TURNS * Math.tanh((-curvature * BANK_TURNS_PER_CURVATURE * character) / BANK_MAX_TURNS);
  const lateralSlope = routeLateralSlope(v);
  out.cutFade = 0;
  out.v = v;
  out.lateral = routeLateral(v);
  out.x = poseWarp.x;
  out.y = routeAltitude(v);
  out.z = poseWarp.z;
  // Sim basis: yaw 0 faces +Z, forward x = sin(yaw).
  out.yaw = wrapTurns(heading / TAU);
  out.pitch = Math.atan(routeAltitudeSlope(v) / Math.sqrt(1 + lateralSlope * lateralSlope)) / TAU;
  out.roll = bank;
  return out;
}

function emptyTrackPose(): TrackPose {
  return { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
}

/** Allocate once and reuse for each frame's world-space exhaust update. */
export function createWorldWakeSamples(): WorldWakeSamples {
  const floats = SHUTTLE_WAKE_SAMPLE_COUNT * 3;
  return {
    centers: new Float32Array(floats),
    tangents: new Float32Array(floats),
    leftCenters: new Float32Array(floats),
    rightCenters: new Float32Array(floats),
    leftTangents: new Float32Array(floats),
    rightTangents: new Float32Array(floats),
    routeCenters: new Float32Array(floats),
    freeCenters: new Float32Array(floats),
    track: emptyTrackPose(),
    roots: [new Float64Array(3), new Float64Array(3)],
    lengthM: SHUTTLE_WAKE_CRUISE_LENGTH_M,
    rootWidthM: SHUTTLE_WAKE_CRUISE_WIDTH_M,
    tailWidthM: SHUTTLE_WAKE_TAIL_WIDTH_M,
  };
}

/**
 * Samples an analytic wake behind the presented pose. Autopilot points use the exact route mapping;
 * free flight uses the current forward tangent because past input is not available. The explicit
 * output buffer owns all scratch state, so rewinds and repeated calls need no frame history.
 */
export function sampleWorldWake(pose: ShuttleWakePose, time: number, out: WorldWakeSamples): void {
  const boost = Math.min(1, Math.max(0, pose.boostVisual));
  const lengthM = SHUTTLE_WAKE_CRUISE_LENGTH_M +
    (SHUTTLE_WAKE_BOOST_LENGTH_M - SHUTTLE_WAKE_CRUISE_LENGTH_M) * boost;
  out.lengthM = lengthM;
  out.rootWidthM = SHUTTLE_WAKE_CRUISE_WIDTH_M +
    (SHUTTLE_WAKE_BOOST_WIDTH_M - SHUTTLE_WAKE_CRUISE_WIDTH_M) * boost;
  out.tailWidthM = SHUTTLE_WAKE_TAIL_WIDTH_M;

  const pitch = pose.pitch * SHUTTLE_DRAW_PITCH_SHARE * TAU;
  const yaw = pose.yaw * TAU;
  const roll = pose.roll * TAU;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  // Match hull.rotation.order = 'YXZ', including the negative draw pitch in setPose().
  for (let nozzle = 0; nozzle < 2; nozzle += 1) {
    const [localX, localY, localZ] = SHUTTLE_NOZZLE_ROOTS_LOCAL[nozzle]!;
    const rzX = localX * cr - localY * sr;
    const rzY = localX * sr + localY * cr;
    const rxY = rzY * cp + localZ * sp;
    const rxZ = -rzY * sp + localZ * cp;
    const root = out.roots[nozzle]!;
    root[0] = pose.x + rzX * cy + rxZ * sy;
    root[1] = pose.y + rxY;
    root[2] = pose.z - rzX * sy + rxZ * cy;
  }

  const forwardX = Math.sin(yaw) * cp;
  const forwardY = sp;
  const forwardZ = Math.cos(yaw) * cp;
  const trackWeight = Math.min(1, Math.max(0, pose.wakeTrackWeight));
  const trackV = pose.wakeTrackV;
  const hasTrack = trackWeight > 0;
  const sampleLengthM = trackWeight > 0 && trackWeight < 1
    ? Math.max(0, lengthM - WAKE_ROUTE_BLEND_MAX_OFFSET_M)
    : lengthM;

  for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
    const t = i / (SHUTTLE_WAKE_SAMPLE_COUNT - 1);
    const distance = sampleLengthM * t;
    const offset = i * 3;
    const freeX = pose.x - forwardX * distance;
    const freeY = pose.y - forwardY * distance;
    const freeZ = pose.z - forwardZ * distance;
    out.freeCenters[offset] = freeX;
    out.freeCenters[offset + 1] = freeY;
    out.freeCenters[offset + 2] = freeZ;

    if (hasTrack) {
      autopilotTrackPose(trackV - distance, out.track);
      out.routeCenters[offset] = out.track.x;
      out.routeCenters[offset + 1] = out.track.y;
      out.routeCenters[offset + 2] = out.track.z;
    } else {
      out.routeCenters[offset] = freeX;
      out.routeCenters[offset + 1] = freeY;
      out.routeCenters[offset + 2] = freeZ;
    }

    const routeDeltaX = out.routeCenters[offset]! - freeX;
    const routeDeltaY = out.routeCenters[offset + 1]! - freeY;
    const routeDeltaZ = out.routeCenters[offset + 2]! - freeZ;
    const routeGap = Math.hypot(routeDeltaX, routeDeltaY, routeDeltaZ);
    const boundedWeight = trackWeight < 1 && routeGap > 0
      ? Math.min(trackWeight, WAKE_ROUTE_BLEND_MAX_OFFSET_M / routeGap)
      : trackWeight;
    out.centers[offset] = i === 0 ? pose.x : freeX + routeDeltaX * boundedWeight;
    out.centers[offset + 1] = i === 0 ? pose.y : freeY + routeDeltaY * boundedWeight;
    out.centers[offset + 2] = i === 0 ? pose.z : freeZ + routeDeltaZ * boundedWeight;
  }

  for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
    const current = i * 3;
    const before = (i === 0 ? 0 : i - 1) * 3;
    const after = (i === SHUTTLE_WAKE_SAMPLE_COUNT - 1 ? i : i + 1) * 3;
    let tx = out.centers[before]! - out.centers[after]!;
    let ty = out.centers[before + 1]! - out.centers[after + 1]!;
    let tz = out.centers[before + 2]! - out.centers[after + 2]!;
    let tangentLength = Math.hypot(tx, ty, tz) || 1;
    tx /= tangentLength;
    ty /= tangentLength;
    tz /= tangentLength;
    out.tangents[current] = tx;
    out.tangents[current + 1] = ty;
    out.tangents[current + 2] = tz;

    const t = i / (SHUTTLE_WAKE_SAMPLE_COUNT - 1);
    const distance = sampleLengthM * t;
    const horizontalLength = Math.hypot(tx, tz);
    const rightX = horizontalLength > 1e-4 ? tz / horizontalLength : Math.cos(yaw);
    const rightZ = horizontalLength > 1e-4 ? -tx / horizontalLength : -Math.sin(yaw);
    const arc = (hasTrack ? trackV : pose.canyonV) - distance;
    const phase = (TAU * WAKE_TURBULENCE_CYCLES * arc) / CANYON_LOOP_LENGTH_M + time * WAKE_TURBULENCE_RATE;
    const turbulence = Math.sin(phase) * WAKE_TURBULENCE_M * smoothstep01(distance / SHUTTLE_WAKE_WELD_BLEND_M);
    out.centers[current] += rightX * turbulence;
    out.centers[current + 2] += rightZ * turbulence;
  }

  const rootTangentX = out.tangents[0]!;
  const rootTangentY = out.tangents[1]!;
  const rootTangentZ = out.tangents[2]!;
  for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
    const t = i / (SHUTTLE_WAKE_SAMPLE_COUNT - 1);
    const distance = lengthM * t;
    const current = i * 3;
    const weld = smoothstep01(distance / SHUTTLE_WAKE_WELD_BLEND_M);
    for (let nozzle = 0; nozzle < 2; nozzle += 1) {
      const centers = nozzle === 0 ? out.leftCenters : out.rightCenters;
      const roots = out.roots[nozzle]!;
      const rootX = roots[0]! - rootTangentX * distance;
      const rootY = roots[1]! - rootTangentY * distance;
      const rootZ = roots[2]! - rootTangentZ * distance;
      centers[current] = rootX + (out.centers[current]! - rootX) * weld;
      centers[current + 1] = rootY + (out.centers[current + 1]! - rootY) * weld;
      centers[current + 2] = rootZ + (out.centers[current + 2]! - rootZ) * weld;
    }
  }

  for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
    const current = i * 3;
    const before = (i === 0 ? 0 : i - 1) * 3;
    const after = (i === SHUTTLE_WAKE_SAMPLE_COUNT - 1 ? i : i + 1) * 3;
    let tx = out.centers[before]! - out.centers[after]!;
    let ty = out.centers[before + 1]! - out.centers[after + 1]!;
    let tz = out.centers[before + 2]! - out.centers[after + 2]!;
    const centerLength = Math.hypot(tx, ty, tz) || 1;
    tx /= centerLength;
    ty /= centerLength;
    tz /= centerLength;
    out.tangents[current] = tx;
    out.tangents[current + 1] = ty;
    out.tangents[current + 2] = tz;

    for (let nozzle = 0; nozzle < 2; nozzle += 1) {
      const centers = nozzle === 0 ? out.leftCenters : out.rightCenters;
      const tangents = nozzle === 0 ? out.leftTangents : out.rightTangents;
      let ribbonX = centers[before]! - centers[after]!;
      let ribbonY = centers[before + 1]! - centers[after + 1]!;
      let ribbonZ = centers[before + 2]! - centers[after + 2]!;
      const ribbonLength = Math.hypot(ribbonX, ribbonY, ribbonZ) || 1;
      ribbonX /= ribbonLength;
      ribbonY /= ribbonLength;
      ribbonZ /= ribbonLength;
      tangents[current] = ribbonX;
      tangents[current + 1] = ribbonY;
      tangents[current + 2] = ribbonZ;
    }
  }
}

export function createFlightPresenter(seed: number): SkyriverFlightPresenter {
  const path = deriveFlightPath(seed);
  const trackLength = CANYON_LOOP_LENGTH_M;
  const ringLength = path.segmentLength.reduce((sum, length) => sum + length, 0);
  const autopilotSpeedMps = SKYRIVER_AUTOPILOT_PRESENTATION_SHARE * SKYRIVER_AUTOPILOT_REFERENCE_SPEED_MPS * trackLength / ringLength;

  const result: MutablePresented = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, mode: 0, autopilotT: 0, boostT: 0, roll: 0, boostVisual: 0, cutFade: 0, canyonV: 0, canyonX: 0, wakeTrackV: 0, wakeTrackWeight: 1, revealX: 0, revealZ: 0, revealWeight: 0,
  };
  const apexes = canyonBendApexes(900);
  const revealWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  // Observed like handoffTick: the tick a boost release was seen, dropped when the tick runs back.
  let boostEndTick: number | null = null;

  function boostVisualOf(state: SkyriverRenderState): number {
    const current = state.current;
    if (boostEndTick !== null && current.tick < boostEndTick) boostEndTick = null;
    if (state.flight.boostT > 0) {
      boostEndTick = null;
      return Math.min(1, state.flight.boostT / BOOST_RAMP_S);
    }
    if (state.previous.flight.boostT > 0 && current.tick - state.previous.tick === 1) boostEndTick = current.tick;
    if (boostEndTick === null) return 0;
    const k = (current.tick - boostEndTick + state.alpha) / BOOST_RELEASE_TICKS;
    return k >= 1 ? 0 : 1 - k * k * (3 - 2 * k);
  }
  const poseA: TrackPose = { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  const targetPose: MutableTransitionPose = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, canyonV: 0, canyonX: 0,
  };
  const sourcePose: MutableTransitionPose = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, canyonV: 0, canyonX: 0,
  };
  const projectedFree: { v: number; lateral: number } = { v: 0, lateral: 0 };
  const inverseWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  const sourceWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  const targetWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  const blendWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  // Keep one edge per observed tick for reverse seeks in this epoch. Evaluation scans this history.
  const transitions = new Map<number, ModeTransition>();
  const currentEvaluation: TransitionEvaluation = { active: false, progress: 0 };
  let timelineEpoch = -1;

  function requireTimelineEpoch(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch !== timelineEpoch) {
      throw new Error('SKYRIVER_PRESENTATION_TIMELINE_EPOCH_MISMATCH');
    }
  }

  function resetTimeline(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch <= timelineEpoch) {
      throw new Error('SKYRIVER_PRESENTATION_TIMELINE_EPOCH_MUST_INCREASE');
    }
    transitions.clear();
    boostEndTick = null;
    timelineEpoch = epoch;
  }

  function projectFreePoint(x: number, z: number, out: { v: number; lateral: number }): void {
    // Free flight is bounded to the straight canyon zone. Start near its world-z coordinate, then
    // solve for the nearest centreline point in the canyon's local tangent frame.
    let v = wrapCanyonV(z);
    for (let iteration = 0; iteration < 8; iteration += 1) {
      warpCanyon(0, v, inverseWarp);
      const dx = x - inverseWarp.x;
      const dz = z - inverseWarp.z;
      const along = dx * Math.sin(inverseWarp.heading) + dz * Math.cos(inverseWarp.heading);
      if (Math.abs(along) < 1e-5) break;
      v = wrapCanyonV(v + along);
    }
    warpCanyon(0, v, inverseWarp);
    const dx = x - inverseWarp.x;
    const dz = z - inverseWarp.z;
    out.v = v;
    out.lateral = dx * Math.cos(inverseWarp.heading) - dz * Math.sin(inverseWarp.heading);
  }

  function routePitch(v: number): number {
    return Math.atan(routeAltitudeSlope(v) / Math.sqrt(1 + routeLateralSlope(v) ** 2)) / TAU;
  }

  function wrappedArcDelta(fromV: number, toV: number): number {
    let delta = toV - fromV;
    delta -= trackLength * Math.round(delta / trackLength);
    return delta;
  }

  function copyTransitionPose(source: TransitionPose, out: MutableTransitionPose): void {
    out.x = source.x;
    out.y = source.y;
    out.z = source.z;
    out.yaw = source.yaw;
    out.pitch = source.pitch;
    out.roll = source.roll;
    out.canyonV = source.canyonV;
    out.canyonX = source.canyonX;
  }

  function blendTransitionPose(
    source: TransitionPose,
    target: TransitionPose,
    progress: number,
    arcDelta: number,
    out: MutableTransitionPose,
  ): void {
    if (progress <= 0) {
      copyTransitionPose(source, out);
      return;
    }
    if (progress >= 1) {
      copyTransitionPose(target, out);
      return;
    }

    const v = wrapCanyonV(source.canyonV + arcDelta * progress);
    const lateral = source.canyonX + (target.canyonX - source.canyonX) * progress;
    warpCanyon(lateral, v, blendWarp);
    warpCanyon(source.canyonX, source.canyonV, sourceWarp);
    warpCanyon(target.canyonX, target.canyonV, targetWarp);

    const sourceYawLocal = wrapTurns(source.yaw - canyonHeading(source.canyonV) / TAU);
    const targetYawLocal = wrapTurns(target.yaw - canyonHeading(target.canyonV) / TAU);
    const yawLocal = sourceYawLocal + wrapTurns(targetYawLocal - sourceYawLocal) * progress;
    out.yaw = wrapTurns(canyonHeading(v) / TAU + yawLocal);
    out.pitch = routePitch(v) +
      (source.pitch - routePitch(source.canyonV)) * (1 - progress) +
      (target.pitch - routePitch(target.canyonV)) * progress;
    out.roll = source.roll + (target.roll - source.roll) * progress;
    out.canyonV = v;
    out.canyonX = lateral;

    // Keep exact endpoint positions while the path follows the bent canyon between them.
    const sourceResidualX = source.x - sourceWarp.x;
    const targetResidualX = target.x - targetWarp.x;
    const sourceResidualZ = source.z - sourceWarp.z;
    const targetResidualZ = target.z - targetWarp.z;
    out.x = blendWarp.x + sourceResidualX * (1 - progress) + targetResidualX * progress;
    out.z = blendWarp.z + sourceResidualZ * (1 - progress) + targetResidualZ * progress;
    const sourceHeightResidual = source.y - routeAltitude(source.canyonV);
    const targetHeightResidual = target.y - routeAltitude(target.canyonV);
    out.y = routeAltitude(v) + sourceHeightResidual * (1 - progress) + targetHeightResidual * progress;
  }

  function writeModeTarget(
    timeTick: number,
    mode: SkyriverFlight['mode'],
    flight: SkyriverFlight,
    out: MutableTransitionPose,
  ): void {
    if (mode === 0) {
      autopilotTrackPose(skyriverAutopilotArc(timeTick, 0, autopilotSpeedMps, trackLength), poseA);
      out.x = poseA.x;
      out.y = poseA.y;
      out.z = poseA.z;
      out.yaw = poseA.yaw;
      out.pitch = poseA.pitch;
      out.roll = poseA.roll;
      out.canyonV = poseA.v;
      out.canyonX = poseA.lateral;
      return;
    }
    out.x = flight.x;
    out.y = flight.y;
    out.z = flight.z;
    out.yaw = flight.yaw;
    out.pitch = flight.pitch;
    out.roll = 0;
    projectFreePoint(flight.x, flight.z, projectedFree);
    out.canyonV = projectedFree.v;
    out.canyonX = projectedFree.lateral;
  }

  function removeTransitionsFrom(startTick: number): void {
    for (const tick of transitions.keys()) if (tick >= startTick) transitions.delete(tick);
  }

  function latestTransition(
    timeTick: number,
    startBefore: number,
    targetMode: SkyriverFlight['mode'],
  ): ModeTransition | null {
    let latest: ModeTransition | null = null;
    for (const transition of transitions.values()) {
      if (transition.startTick > timeTick || transition.startTick >= startBefore || transition.toMode !== targetMode) continue;
      if (latest === null || transition.startTick > latest.startTick) latest = transition;
    }
    return latest;
  }

  function evaluatePose(
    timeTick: number,
    flight: SkyriverFlight,
    out: MutableTransitionPose,
    startBefore = Number.POSITIVE_INFINITY,
    evaluation?: TransitionEvaluation,
  ): void {
    const transition = latestTransition(timeTick, startBefore, flight.mode);
    if (transition === null) {
      writeModeTarget(timeTick, flight.mode, flight, out);
      if (evaluation) {
        evaluation.active = false;
        evaluation.progress = flight.mode === 0 ? 1 : 0;
      }
      return;
    }

    const elapsed = timeTick - transition.startTick;
    if (elapsed >= HANDOFF_TICKS) {
      writeModeTarget(timeTick, flight.mode, flight, out);
      if (evaluation) {
        evaluation.active = false;
        evaluation.progress = flight.mode === 0 ? 1 : 0;
      }
      return;
    }

    const progress = smoothstep01(elapsed / HANDOFF_TICKS);
    writeModeTarget(timeTick, transition.toMode, flight, targetPose);
    const targetMovement = wrappedArcDelta(transition.targetAnchorV, targetPose.canyonV);
    blendTransitionPose(transition.source, targetPose, progress, transition.initialArcDelta + targetMovement, out);
    if (evaluation) {
      evaluation.active = true;
      evaluation.progress = progress;
    }
  }

  function flightKey(flight: SkyriverFlight): string {
    return JSON.stringify([
      flight.mode, flight.x, flight.y, flight.z, flight.yaw, flight.pitch,
      flight.speed, flight.autopilotT, flight.boostT,
    ]);
  }

  function samePose(a: TransitionPose, b: TransitionPose): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z && a.yaw === b.yaw &&
      a.pitch === b.pitch && a.roll === b.roll && a.canyonV === b.canyonV && a.canyonX === b.canyonX;
  }

  function observeModeEdge(state: Pick<SkyriverRenderState, 'previous' | 'current'>, epoch: number): void {
    requireTimelineEpoch(epoch);
    const previous = state.previous;
    const current = state.current;
    if (current.tick - previous.tick !== 1) return;
    const startTick = previous.tick;
    const old = transitions.get(startTick);
    if (previous.flight.mode === current.flight.mode) {
      if (old && (old.fromMode !== previous.flight.mode || old.toMode !== current.flight.mode)) {
        removeTransitionsFrom(startTick);
      }
      return;
    }

    evaluatePose(startTick, previous.flight, sourcePose, startTick);
    const previousFlightKey = flightKey(previous.flight);
    writeModeTarget(current.tick, current.flight.mode, current.flight, targetPose);
    const targetFlightKey = flightKey(current.flight);
    const targetAnchorV = targetPose.canyonV;
    const initialArcDelta = wrappedArcDelta(sourcePose.canyonV, targetAnchorV);
    if (old && old.fromMode === previous.flight.mode && old.toMode === current.flight.mode &&
      old.previousFlightKey === previousFlightKey && old.targetFlightKey === targetFlightKey &&
      old.targetAnchorV === targetAnchorV && old.initialArcDelta === initialArcDelta &&
      samePose(old.source, sourcePose)) return;

    removeTransitionsFrom(startTick);
    transitions.set(startTick, {
      startTick,
      fromMode: previous.flight.mode,
      toMode: current.flight.mode,
      previousFlightKey,
      targetFlightKey,
      targetAnchorV,
      initialArcDelta,
      source: {
        x: sourcePose.x, y: sourcePose.y, z: sourcePose.z, yaw: sourcePose.yaw, pitch: sourcePose.pitch,
        roll: sourcePose.roll, canyonV: sourcePose.canyonV, canyonX: sourcePose.canyonX,
      },
    });
  }

  function present(state: SkyriverRenderState, epoch: number): PresentedFlight {
    requireTimelineEpoch(epoch);
    const flight = state.flight;
    const timeTick = state.current.tick - 1 + state.alpha;
    result.boostT = flight.boostT;
    result.mode = flight.mode;
    result.autopilotT = flight.autopilotT;
    result.cutFade = 0;
    result.revealX = 0;
    result.revealZ = 0;
    result.revealWeight = 0;
    result.boostVisual = boostVisualOf(state);

    evaluatePose(timeTick, flight, result, Number.POSITIVE_INFINITY, currentEvaluation);
    if (flight.mode !== 0 && !currentEvaluation.active) {
      // Keep the steady free-flight traffic anchor and pose contract unchanged.
      result.canyonV = flight.z;
      result.canyonX = flight.x;
    }
    result.speed = flight.mode === 0 ? autopilotSpeedMps : flight.speed;
    result.wakeTrackV = result.canyonV;
    result.wakeTrackWeight = flight.mode === 0 && !currentEvaluation.active ? 1 : 0;

    if (flight.mode !== 0) return result;
    autopilotTrackPose(skyriverAutopilotArc(timeTick, 0, autopilotSpeedMps, trackLength), poseA);

    // R13 reveal. Scale the route reveal until the hull completes its return to that route.
    let best = 0;
    for (const apex of apexes) {
      let d = apex.v - poseA.v;
      d -= trackLength * Math.round(d / trackLength);
      const showcase = Math.abs(apex.v - SKYRIVER_SHOWCASE_BEND_V) < 1;
      const far = 2900;
      const hold = 2300;
      const end = 1000;
      const tail = 400;
      if (d <= end - tail || d > far) continue;
      const ease = smoothstep01((far - d) / (far - hold));
      const release = smoothstep01((d - (end - tail)) / tail);
      const weight = ease * release * (showcase ? 1 : 0.55) * currentEvaluation.progress;
      if (weight > best) {
        best = weight;
        warpCanyon(apex.side * apex.radius * 0.995, apex.v, revealWarp);
        result.revealX = revealWarp.x;
        result.revealZ = revealWarp.z;
      }
    }
    result.revealWeight = best;
    return result;
  }

  return { resetTimeline, observeModeEdge, present, trackLength, autopilotSpeedMps };
}
