/**
 * @file flightPresentation.ts — where the shuttle is *drawn*, as a pure function of the sim state.
 *
 * T6R P0 "camera escapes the chasm". The sim's seeded autopilot ring (systems.ts deriveFlightPath)
 * is a ~200 m circle whose 24 waypoints alternate between ~330 m and ~1130 m altitude, often only
 * 50-100 m apart horizontally. Followed literally, the shuttle yo-yos at the 54-degree pitch limit
 * and spends half of every loop pointed across the canyon at a wall. systems.ts is frozen (it is a
 * hashed sim source), so the canyon run is a presentation mapping instead:
 *
 *   Autopilot — the sim's arc length along its ring, S(autopilotT), is mapped 1:1 onto a stadium
 *   track laid along the canyon: two long straights (one per side of the corridor, opposite
 *   directions) joined by banked U-turns, with a gentle altitude swell well under the roofline. The
 *   sim advances autopilotT by speed * dt / segmentLength, so S grows at exactly the sim's speed and
 *   the drawn shuttle flies at the speed the HUD shows; boost reads unchanged.
 *
 *   Free flight — the sim pose is drawn as is. At the hand-off from autopilot, the gap between the
 *   track pose and the sim's own ring pose is computed from the frozen autopilotT (the sim does not
 *   advance it in free flight) and eased out over HANDOFF_TICKS, so the shuttle glides into the sim
 *   pose instead of teleporting.
 *
 *   Back to autopilot — the sim itself re-anchors to the nearest ring waypoint (a jump in sim
 *   space), so the presentation cuts to the matching track pose. A cut is honest about that jump.
 *
 * Purity: every pose is a function of (previous projection, current projection, alpha) and the
 * seed, plus one observed value: the tick at which a free-flight hand-off was seen (the projection
 * carries no event tail to recover it from). It is not smoothing state — the pose is never eased
 * toward a remembered pose — and it is dropped whenever the tick runs backwards (restore, rollback)
 * or the mode leaves free flight, so a restore can at worst skip the hand-off glide, never jump.
 */
import type { SkyriverRenderState } from '../sim/session';
import {
  deriveFlightPath,
  type SkyriverFlight,
  type SkyriverFlightPath,
} from '../sim/systems';
import { SKYRIVER_ROOFLINE_MIN_M } from './presentationLayout';

const TAU = Math.PI * 2;

/** Lateral offset of each straight from the canyon centreline, metres. Also the U-turn radius. */
export const TRACK_LANE_X_M = 230;
/** Mean cruise altitude, metres, and the swell around it. Max ~770 m: far under the roofline. */
/**
 * T7: raised from 560 m. The chase now flies high over a deep canyon and looks down into it (the
 * Neon Rain still's composition): rivers below, walls rising beside, crowned rooflines and a hazy
 * sky band above the lower stretches of wall.
 */
export const TRACK_BASE_Y_M = 1150;
const TRACK_SWELL_A_M = 150;
const TRACK_SWELL_B_M = 55;
/** Whole swell cycles per lap; low counts keep the climb angle shallow. */
const TRACK_SWELL_A_CYCLES = 2;
const TRACK_SWELL_B_CYCLES = 5;
/** Straight half-length clamp, metres. The presented canyon runs to ~|z| = 2700. */
const TRACK_MIN_HALF_M = 700;
const TRACK_MAX_HALF_M = 1900;
/** Peak roll through the U-turns, turns (~24 degrees). */
const TRACK_BANK_TURNS = 0.066;

/** Free-flight hand-off easing, ticks (30 Hz). */
const HANDOFF_TICKS = 75;
/** Boost drama ramp-in seconds and release ticks (30 Hz). */
const BOOST_RAMP_S = 0.4;
const BOOST_RELEASE_TICKS = 18;
/** Mirrors systems.ts PATH_TANGENT_STEP: the sim reads its own heading this far ahead. */
const PATH_TANGENT_STEP = 0.02;

if (TRACK_BASE_Y_M + TRACK_SWELL_A_M + TRACK_SWELL_B_M > SKYRIVER_ROOFLINE_MIN_M - 600) {
  throw new Error('SKYRIVER_TRACK_ABOVE_ROOFLINE');
}

/** The drawn pose: a SkyriverFlight (so cameraRig consumes it unchanged) plus a cosmetic roll. */
export interface PresentedFlight extends SkyriverFlight {
  readonly roll: number;
  /**
   * T7: 0..1 boost drama level for the camera (FOV widen, shake). Ramps in over the first 0.4 s of
   * boost, and eases out over BOOST_RELEASE_TICKS after the sim drops boostT to 0 on release.
   */
  readonly boostVisual: number;
}

type MutablePresented = { -readonly [K in keyof PresentedFlight]: PresentedFlight[K] };

interface TrackPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface SkyriverFlightPresenter {
  /** Writes the drawn pose for this frame into an internal scratch object and returns it. */
  present(state: SkyriverRenderState): PresentedFlight;
  /** Track length, metres (for probes). */
  readonly trackLength: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function wrap(value: number, period: number): number {
  const w = value % period;
  return w < 0 ? w + period : w;
}

function wrapTurns(turns: number): number {
  return turns - Math.round(turns);
}

/** Same Catmull-Rom ring the sim samples (systems.ts samplePath), as plain float math. */
function sampleRing(path: SkyriverFlightPath, t: number, out: { x: number; y: number; z: number }): void {
  const count = path.count;
  const wrapped = wrap(t, count);
  const index = Math.floor(wrapped);
  const local = wrapped - index;
  const i0 = (index - 1 + count) % count;
  const i1 = index % count;
  const i2 = (index + 1) % count;
  const i3 = (index + 2) % count;
  out.x = catmullRom(path.x[i0]!, path.x[i1]!, path.x[i2]!, path.x[i3]!, local);
  out.y = catmullRom(path.y[i0]!, path.y[i1]!, path.y[i2]!, path.y[i3]!, local);
  out.z = catmullRom(path.z[i0]!, path.z[i1]!, path.z[i2]!, path.z[i3]!, local);
}

export function createFlightPresenter(seed: number): SkyriverFlightPresenter {
  const path = deriveFlightPath(seed);
  const cumulative = new Float64Array(path.count + 1);
  for (let i = 0; i < path.count; i += 1) cumulative[i + 1] = cumulative[i]! + path.segmentLength[i]!;
  const ringLength = cumulative[path.count]!;

  const laneX = TRACK_LANE_X_M;
  const turnLength = Math.PI * laneX;
  const half = Math.min(TRACK_MAX_HALF_M, Math.max(TRACK_MIN_HALF_M, (ringLength - 2 * turnLength) / 4));
  const straight = 2 * half;
  const trackLength = 2 * straight + 2 * turnLength;

  /** Sim arc length at a ring parameter: exactly what the sim's per-tick advance integrates. */
  function ringArc(t: number): number {
    const wrapped = wrap(t, path.count);
    const index = Math.floor(wrapped);
    return cumulative[index]! + (wrapped - index) * path.segmentLength[index]!;
  }

  function trackU(autopilotT: number): number {
    return (ringArc(autopilotT) / ringLength) * trackLength;
  }

  function trackPose(uIn: number, out: TrackPose): void {
    const u = wrap(uIn, trackLength);
    let x: number;
    let z: number;
    let tx: number;
    let tz: number;
    let roll = 0;
    if (u < straight) {
      // Straight A: x = +lane, heading +z.
      x = laneX;
      z = -half + u;
      tx = 0;
      tz = 1;
    } else if (u < straight + turnLength) {
      const theta = (u - straight) / laneX;
      x = laneX * Math.cos(theta);
      z = half + laneX * Math.sin(theta);
      tx = -Math.sin(theta);
      tz = Math.cos(theta);
      roll = TRACK_BANK_TURNS * Math.sin(theta);
    } else if (u < 2 * straight + turnLength) {
      // Straight B: x = -lane, heading -z.
      x = -laneX;
      z = half - (u - straight - turnLength);
      tx = 0;
      tz = -1;
    } else {
      const theta = (u - 2 * straight - turnLength) / laneX;
      x = -laneX * Math.cos(theta);
      z = -half - laneX * Math.sin(theta);
      tx = Math.sin(theta);
      tz = -Math.cos(theta);
      roll = TRACK_BANK_TURNS * Math.sin(theta);
    }
    const phase = (u / trackLength) * TAU;
    const y = TRACK_BASE_Y_M
      + TRACK_SWELL_A_M * Math.sin(phase * TRACK_SWELL_A_CYCLES)
      + TRACK_SWELL_B_M * Math.sin(phase * TRACK_SWELL_B_CYCLES + 1.3);
    const dy = (TRACK_SWELL_A_M * TRACK_SWELL_A_CYCLES * Math.cos(phase * TRACK_SWELL_A_CYCLES)
      + TRACK_SWELL_B_M * TRACK_SWELL_B_CYCLES * Math.cos(phase * TRACK_SWELL_B_CYCLES + 1.3)) * (TAU / trackLength);

    out.x = x;
    out.y = y;
    out.z = z;
    // Sim basis: yaw 0 faces +Z, forward x = sin(yaw).
    out.yaw = Math.atan2(tx, tz) / TAU;
    out.pitch = Math.atan(dy) / TAU;
    out.roll = roll;
  }

  const result: MutablePresented = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, mode: 0, autopilotT: 0, boostT: 0, roll: 0, boostVisual: 0,
  };
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
  const poseA: TrackPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  const ring = { x: 0, y: 0, z: 0 };
  const ringAhead = { x: 0, y: 0, z: 0 };
  let handoffTick: number | null = null;

  function present(state: SkyriverRenderState): PresentedFlight {
    const flight = state.flight;
    const current = state.current;
    const previous = state.previous;
    result.speed = flight.speed;
    result.boostT = flight.boostT;
    result.mode = flight.mode;
    result.autopilotT = flight.autopilotT;
    result.roll = 0;
    result.boostVisual = boostVisualOf(state);

    if (flight.mode === 0) {
      handoffTick = null;
      // Interpolate along the track, not between two track points: the U-turns are curved.
      let u = trackU(current.flight.autopilotT);
      if (previous.flight.mode === 0 && current.tick - previous.tick === 1) {
        const u0 = trackU(previous.flight.autopilotT);
        let du = u - u0;
        if (du > trackLength / 2) du -= trackLength;
        if (du < -trackLength / 2) du += trackLength;
        u = u0 + du * state.alpha;
      }
      trackPose(u, poseA);
      result.x = poseA.x;
      result.y = poseA.y;
      result.z = poseA.z;
      result.yaw = poseA.yaw;
      result.pitch = poseA.pitch;
      result.roll = poseA.roll;
      return result;
    }

    result.x = flight.x;
    result.y = flight.y;
    result.z = flight.z;
    result.yaw = flight.yaw;
    result.pitch = flight.pitch;

    if (handoffTick !== null && current.tick < handoffTick) handoffTick = null;
    if (previous.flight.mode === 0 && current.tick - previous.tick === 1) handoffTick = current.tick;
    if (handoffTick === null) return result;
    const elapsed = current.tick - 1 + state.alpha - handoffTick;
    if (elapsed >= HANDOFF_TICKS) return result;
    const k = Math.min(1, Math.max(0, elapsed / HANDOFF_TICKS));
    const ease = 1 - k * k * (3 - 2 * k);

    // autopilotT is frozen in free flight, so the hand-off point is recoverable from any later tick.
    const frozenT = current.flight.autopilotT;
    trackPose(trackU(frozenT), poseA);
    sampleRing(path, frozenT, ring);
    sampleRing(path, frozenT + PATH_TANGENT_STEP, ringAhead);
    const ringYaw = Math.atan2(ringAhead.x - ring.x, ringAhead.z - ring.z) / TAU;
    const ringPitch = Math.atan2(ringAhead.y - ring.y, Math.hypot(ringAhead.x - ring.x, ringAhead.z - ring.z)) / TAU;

    result.x += (poseA.x - ring.x) * ease;
    result.y += (poseA.y - ring.y) * ease;
    result.z += (poseA.z - ring.z) * ease;
    result.yaw = wrapTurns(result.yaw + wrapTurns(poseA.yaw - ringYaw) * ease);
    result.pitch += (poseA.pitch - ringPitch) * ease;
    return result;
  }

  return { present, trackLength };
}
