/**
 * @file systems.ts — Skyriver flight, camera and event systems as pure transforms on frozen state.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Runtime (P0 fix)" — state is frozen {tick, flight, camera, eventSeq} objects; one tick
 *     produces a fresh frozen root with structural sharing, so the adapter can retain captures by
 *     reference (capturedStateIsDetached).
 *   Design "Sim ↔ render split" — shuttle pos/yaw/pitch/speed/mode/autopilotT/boostT and camera
 *     orbit angles are the whole of the simulated, checksummed state.
 *   Design "Input semantics" — per-tick pulses (orbit delta, boost edge, mode toggle) are consumed
 *     exactly once; the free-fly stick position rides the persistent axes.
 *   R2 — presentation events emit only on mode/boost edges, with stable dedupe keys.
 *
 * Determinism rules (plan Design, and the brief's constraints):
 *   - No wall-clock reads and no ambient entropy anywhere in this file.
 *   - Every angle goes through DeterministicMath's integer trig (sinTurns/cosTurns/atan2Signed),
 *     which is byte-identical across JS engines; IEEE-754 + - * / and sqrt are exact, so the rest
 *     of the kinematics is plain float math.
 *   - Every float that lands in state is quantized to the 1e-6 grid, so the binary checkpoint codec
 *     in runtime.ts is lossless and a hydrated state resimulates bit-identically.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   dist/index.d.ts    — root entry exports DeterministicRandom and createDeterministicMath.
 *   dist/math.d.ts     — DeterministicMath: fixed-point sinTurns/cosTurns/atan2Signed/wrapTurns.
 *   dist/random.d.ts   — DeterministicRandom: xorshift32 with fork(label) sub-streams.
 */
import { DeterministicRandom, createDeterministicMath } from '@series-inc/rundot-syncplay';

import type { SkyriverInput } from './input';

/** Simulation rate. Must stay one of KinetixRuntimeIdentity's tickRate literals (core/runtime.d.ts:9). */
export const SKYRIVER_TICK_RATE = 30;

/** Seconds per tick. One double constant, so every peer multiplies by the same bits. */
const DT = 1 / SKYRIVER_TICK_RATE;

/**
 * Fixed-point scale for the deterministic trig. One revolution == FIXED_SCALE, which gives
 * sub-millidegree angular resolution while staying far inside DeterministicMath's int32 range.
 */
const FIXED_SCALE = 1_000_000;

const math = createDeterministicMath(FIXED_SCALE);

/** State quantization grid (plan Design: "1e-6 quantization", mirroring the physics3d quantize rules). */
const STATE_QUANTUM = 1_000_000;

/** The flyable volume. Free flight clamps to it; the autopilot path is generated inside it. */
export const CHASM_BOUNDS = Object.freeze({
  minX: -400,
  maxX: 400,
  minY: 60,
  maxY: 2000,
  minZ: -400,
  maxZ: 400,
});

/** Bounded presentation-event tail. State size must not grow with tick count (plan Design, R6). */
export const MAX_EVENT_HISTORY = 64;

export const SKYRIVER_EVENT_MODE_CHANGE = 0;
export const SKYRIVER_EVENT_BOOST_START = 1;
export const SKYRIVER_EVENT_BOOST_END = 2;

export type SkyriverEventKind =
  | typeof SKYRIVER_EVENT_MODE_CHANGE
  | typeof SKYRIVER_EVENT_BOOST_START
  | typeof SKYRIVER_EVENT_BOOST_END;

/** 0 = autopilot (the shuttle flies the seeded path), 1 = free flight (the pilot steers). */
export type SkyriverMode = 0 | 1;

export const SKYRIVER_START_MODES = Object.freeze(['autopilot', 'freefly'] as const);
export type SkyriverStartMode = (typeof SKYRIVER_START_MODES)[number];

export interface SkyriverEvent {
  /** Monotonic id across the whole session; the stable half of the dedupe key. */
  readonly id: number;
  readonly tick: number;
  readonly kind: SkyriverEventKind;
  readonly value: number;
}

export interface SkyriverEventSeq {
  /** Total events emitted since tick 0. Survives the capped tail, so ids never repeat. */
  readonly emitted: number;
  /** The last MAX_EVENT_HISTORY events, oldest first. */
  readonly recent: readonly SkyriverEvent[];
}

export interface SkyriverFlight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Heading in turns, wrapped to [-0.5, 0.5). */
  readonly yaw: number;
  /** Climb angle in turns, clamped to +-PITCH_LIMIT_TURNS. */
  readonly pitch: number;
  /** Metres per second, before the boost multiplier. */
  readonly speed: number;
  readonly mode: SkyriverMode;
  /** Arc-length parameter along the seeded autopilot path, in [0, PATH_WAYPOINTS). */
  readonly autopilotT: number;
  /** Seconds of boost held, 0 when released. Doubles as the boost-edge latch. */
  readonly boostT: number;
}

export interface SkyriverCamera {
  /** Orbit offset in turns, wrapped to [-0.5, 0.5). */
  readonly orbitYaw: number;
  /** Orbit elevation in turns, clamped to +-ORBIT_PITCH_LIMIT_TURNS. */
  readonly orbitPitch: number;
}

export interface SkyriverState {
  readonly tick: number;
  readonly flight: SkyriverFlight;
  readonly camera: SkyriverCamera;
  readonly eventSeq: SkyriverEventSeq;
}

/** The seeded autopilot path: a bounded, precomputed waypoint ring. No unbounded arrays. */
export interface SkyriverFlightPath {
  readonly count: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  /** Chord length of segment i → i+1, floored so the arc-length division is always safe. */
  readonly segmentLength: Float64Array;
}

/** Everything a tick needs besides the previous state. Derived once from the session config. */
export interface SkyriverSimConfig {
  readonly seed: number;
  readonly startMode: SkyriverMode;
  readonly path: SkyriverFlightPath;
}

const PATH_WAYPOINTS = 24;
const PATH_MIN_RADIUS_M = 150;
const PATH_RADIUS_SPAN_M = 120;
const PATH_MIN_ALTITUDE_M = 260;
const PATH_ALTITUDE_SPAN_M = 900;
/** Lookahead along the path used to read the tangent for yaw/pitch. */
const PATH_TANGENT_STEP = 0.02;

const SPEED_MIN_MPS = 40;
const SPEED_MAX_MPS = 260;
/** Fraction of the gap to the target speed closed per tick. */
const SPEED_LERP = 0.08;
const BOOST_MULTIPLIER = 1.8;
const BOOST_MAX_SECONDS = 3;

const YAW_TURNS_PER_SECOND = 0.12;
const PITCH_TURNS_PER_SECOND = 0.06;
const PITCH_LIMIT_TURNS = 0.15;

const ORBIT_YAW_TURNS_PER_SECOND = 0.2;
const ORBIT_PITCH_TURNS_PER_SECOND = 0.1;
const ORBIT_PITCH_LIMIT_TURNS = 0.2;
/** Per-tick decay of the orbit offset while the pilot is flying by hand. */
const ORBIT_DECAY = 0.9;

function fail(code: string): never {
  throw new Error(code);
}

/**
 * Snaps a float onto the 1e-6 state grid and collapses negative zero.
 *
 * Both halves matter for determinism: the grid makes the binary codec lossless, and folding -0 into
 * 0 keeps one canonical byte pattern per value, since -0 and 0 are numerically equal but hash apart.
 */
export function quantize(value: number): number {
  const scaled = Math.round(value * STATE_QUANTUM);
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
    fail('SKYRIVER_STATE_INVALID');
  }
  return scaled === 0 ? 0 : scaled / STATE_QUANTUM;
}

/** True when a value already sits exactly on the state grid. The codec's loud guard. */
export function isQuantized(value: number): boolean {
  return Number.isFinite(value) && quantize(value) === value;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Wraps turns into [-0.5, 0.5) — one canonical representation per heading. */
function wrapSignedTurns(turns: number): number {
  return turns - Math.round(turns);
}

function sinTurns(turns: number): number {
  return math.sinTurns(math.wrapTurns(Math.round(turns * FIXED_SCALE))) / FIXED_SCALE;
}

function cosTurns(turns: number): number {
  return math.cosTurns(math.wrapTurns(Math.round(turns * FIXED_SCALE))) / FIXED_SCALE;
}

/**
 * Signed turns of the direction (across, along), measured from +along towards +across.
 * Inputs are normalized first so the fixed-point conversion never approaches the int32 ceiling.
 */
function directionTurns(across: number, along: number): number {
  const length = Math.sqrt(across * across + along * along);
  if (length === 0) return 0;
  const fixedAcross = Math.round((across / length) * FIXED_SCALE);
  const fixedAlong = Math.round((along / length) * FIXED_SCALE);
  return math.atan2Signed(fixedAcross, fixedAlong) / FIXED_SCALE;
}

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) fail('SKYRIVER_SEED_INVALID');
}

/**
 * Builds the seeded autopilot ring: PATH_WAYPOINTS waypoints on a varying radius and altitude,
 * entirely inside the chasm volume. Bounded by construction — the sim never grows this set.
 */
export function deriveFlightPath(seed: number): SkyriverFlightPath {
  assertSeed(seed);
  const random = new DeterministicRandom(seed).fork('skyriver.path');
  const x = new Float64Array(PATH_WAYPOINTS);
  const y = new Float64Array(PATH_WAYPOINTS);
  const z = new Float64Array(PATH_WAYPOINTS);

  for (let index = 0; index < PATH_WAYPOINTS; index += 1) {
    const turns = index / PATH_WAYPOINTS;
    const radius = PATH_MIN_RADIUS_M + random.nextInt(0, PATH_RADIUS_SPAN_M);
    const altitude = PATH_MIN_ALTITUDE_M + random.nextInt(0, PATH_ALTITUDE_SPAN_M);
    x[index] = quantize(radius * sinTurns(turns));
    z[index] = quantize(radius * cosTurns(turns));
    y[index] = quantize(altitude);
  }

  const segmentLength = new Float64Array(PATH_WAYPOINTS);
  for (let index = 0; index < PATH_WAYPOINTS; index += 1) {
    const next = (index + 1) % PATH_WAYPOINTS;
    const dx = x[next]! - x[index]!;
    const dy = y[next]! - y[index]!;
    const dz = z[next]! - z[index]!;
    // Floored at 1 m: a degenerate segment must not divide the arc-length advance by ~0.
    segmentLength[index] = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  return Object.freeze({ count: PATH_WAYPOINTS, x, y, z, segmentLength });
}

export function startModeToMode(startMode: SkyriverStartMode): SkyriverMode {
  if (startMode === 'autopilot') return 0;
  if (startMode === 'freefly') return 1;
  return fail('SKYRIVER_START_MODE_INVALID');
}

export function createSkyriverSimConfig(seed: number, startMode: SkyriverStartMode): SkyriverSimConfig {
  assertSeed(seed);
  return Object.freeze({ seed, startMode: startModeToMode(startMode), path: deriveFlightPath(seed) });
}

/** Catmull-Rom through the four control points around the loop position, as plain float math. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

interface PathSample {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function wrapPathT(t: number, count: number): number {
  const wrapped = t % count;
  return wrapped < 0 ? wrapped + count : wrapped;
}

function samplePath(path: SkyriverFlightPath, t: number): PathSample {
  const count = path.count;
  const wrapped = wrapPathT(t, count);
  const index = Math.floor(wrapped);
  const local = wrapped - index;
  const i0 = (index - 1 + count) % count;
  const i1 = index % count;
  const i2 = (index + 1) % count;
  const i3 = (index + 2) % count;
  return {
    x: catmullRom(path.x[i0]!, path.x[i1]!, path.x[i2]!, path.x[i3]!, local),
    y: catmullRom(path.y[i0]!, path.y[i1]!, path.y[i2]!, path.y[i3]!, local),
    z: catmullRom(path.z[i0]!, path.z[i1]!, path.z[i2]!, path.z[i3]!, local),
  };
}

/** Index of the waypoint nearest a point. Ties resolve to the lowest index, so it stays pure. */
function nearestWaypoint(path: SkyriverFlightPath, x: number, y: number, z: number): number {
  let best = 0;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.count; index += 1) {
    const dx = path.x[index]! - x;
    const dy = path.y[index]! - y;
    const dz = path.z[index]! - z;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = index;
    }
  }
  return best;
}

export function createInitialState(config: SkyriverSimConfig): SkyriverState {
  const start = samplePath(config.path, 0);
  const ahead = samplePath(config.path, PATH_TANGENT_STEP);
  const dx = ahead.x - start.x;
  const dy = ahead.y - start.y;
  const dz = ahead.z - start.z;

  return Object.freeze({
    tick: 0,
    flight: Object.freeze({
      x: quantize(start.x),
      y: quantize(clamp(start.y, CHASM_BOUNDS.minY, CHASM_BOUNDS.maxY)),
      z: quantize(start.z),
      yaw: quantize(wrapSignedTurns(directionTurns(dx, dz))),
      pitch: quantize(clamp(directionTurns(dy, Math.sqrt(dx * dx + dz * dz)), -PITCH_LIMIT_TURNS, PITCH_LIMIT_TURNS)),
      speed: quantize(SPEED_MIN_MPS),
      mode: config.startMode,
      autopilotT: 0,
      boostT: 0,
    }),
    camera: Object.freeze({ orbitYaw: 0, orbitPitch: 0 }),
    eventSeq: Object.freeze({ emitted: 0, recent: Object.freeze([]) as readonly SkyriverEvent[] }),
  });
}

/** Collects the tick's edge events, then folds them into the bounded tail in one pass. */
function appendEvents(
  previous: SkyriverEventSeq,
  tick: number,
  pending: readonly { readonly kind: SkyriverEventKind; readonly value: number }[],
): SkyriverEventSeq {
  if (pending.length === 0) return previous;

  const recent = [...previous.recent];
  let emitted = previous.emitted;
  for (const entry of pending) {
    recent.push(Object.freeze({ id: emitted, tick, kind: entry.kind, value: quantize(entry.value) }));
    emitted += 1;
  }
  // The tail is the bound that keeps checkpoint bytes flat over a ten-minute run.
  const tail = recent.length > MAX_EVENT_HISTORY ? recent.slice(recent.length - MAX_EVENT_HISTORY) : recent;
  return Object.freeze({ emitted, recent: Object.freeze(tail) as readonly SkyriverEvent[] });
}

/** The stable dedupe key the presentation layer feeds to DeterministicEventRecords (R2). */
export function skyriverEventDedupeKey(event: SkyriverEvent): string {
  return `skyriver:${event.kind}:${event.id}`;
}

/**
 * Advances one 30 Hz tick and returns a fresh frozen root.
 *
 * Slot 0 is the pilot: v1 is single-seat (the plan's non-goals exclude networked rooms), and
 * reading exactly one slot keeps "a mode toggle is consumed exactly once" unambiguous.
 */
export function advanceState(
  state: SkyriverState,
  inputs: readonly SkyriverInput[],
  config: SkyriverSimConfig,
): SkyriverState {
  const input = inputs[0];
  if (input === undefined) fail('SKYRIVER_INPUT_MISSING');

  const tick = state.tick + 1;
  const flight = state.flight;
  const pending: { readonly kind: SkyriverEventKind; readonly value: number }[] = [];

  // Mode: the toggle is a per-tick pulse, so one tick flips the mode at most once.
  let mode: SkyriverMode = flight.mode;
  let autopilotT = flight.autopilotT;
  if (input.modeToggle) {
    mode = mode === 0 ? 1 : 0;
    if (mode === 0) {
      // Re-anchor onto the path so the hand-off does not teleport the shuttle across the chasm.
      autopilotT = nearestWaypoint(config.path, flight.x, flight.y, flight.z);
    }
    pending.push({ kind: SKYRIVER_EVENT_MODE_CHANGE, value: mode });
  }

  // Boost: boostT is both the fuel clock and the edge latch, so no extra "was held" flag is needed.
  let boostT: number;
  if (input.boost) {
    boostT = Math.min(flight.boostT + DT, BOOST_MAX_SECONDS);
    if (flight.boostT === 0) pending.push({ kind: SKYRIVER_EVENT_BOOST_START, value: flight.speed });
  } else {
    boostT = 0;
    if (flight.boostT > 0) pending.push({ kind: SKYRIVER_EVENT_BOOST_END, value: flight.boostT });
  }
  const boosting = input.boost && boostT > 0;

  // Speed: throttle maps [-1, 1] onto the cruise band, approached at a fixed rate per tick.
  const targetSpeed = SPEED_MIN_MPS + ((input.throttle + 1) / 2) * (SPEED_MAX_MPS - SPEED_MIN_MPS);
  const speed = clamp(flight.speed + (targetSpeed - flight.speed) * SPEED_LERP, SPEED_MIN_MPS, SPEED_MAX_MPS);
  const effectiveSpeed = boosting ? speed * BOOST_MULTIPLIER : speed;

  let x: number;
  let y: number;
  let z: number;
  let yaw: number;
  let pitch: number;
  let orbitYaw = state.camera.orbitYaw;
  let orbitPitch = state.camera.orbitPitch;

  if (mode === 0) {
    // Autopilot: ride the seeded path; the axes orbit the chase camera instead of steering.
    const index = Math.floor(wrapPathT(autopilotT, config.path.count));
    const advance = (effectiveSpeed * DT) / config.path.segmentLength[index]!;
    autopilotT = wrapPathT(autopilotT + advance, config.path.count);

    const here = samplePath(config.path, autopilotT);
    const ahead = samplePath(config.path, autopilotT + PATH_TANGENT_STEP);
    const dx = ahead.x - here.x;
    const dy = ahead.y - here.y;
    const dz = ahead.z - here.z;
    x = here.x;
    y = here.y;
    z = here.z;
    yaw = wrapSignedTurns(directionTurns(dx, dz));
    pitch = clamp(directionTurns(dy, Math.sqrt(dx * dx + dz * dz)), -PITCH_LIMIT_TURNS, PITCH_LIMIT_TURNS);

    orbitYaw = wrapSignedTurns(orbitYaw + input.yawRate * ORBIT_YAW_TURNS_PER_SECOND * DT);
    orbitPitch = clamp(
      orbitPitch + input.pitchRate * ORBIT_PITCH_TURNS_PER_SECOND * DT,
      -ORBIT_PITCH_LIMIT_TURNS,
      ORBIT_PITCH_LIMIT_TURNS,
    );
  } else {
    // Free flight: the axes steer the craft, and the orbit offset relaxes back behind it.
    yaw = wrapSignedTurns(flight.yaw + input.yawRate * YAW_TURNS_PER_SECOND * DT);
    pitch = clamp(
      flight.pitch + input.pitchRate * PITCH_TURNS_PER_SECOND * DT,
      -PITCH_LIMIT_TURNS,
      PITCH_LIMIT_TURNS,
    );

    const cosPitch = cosTurns(pitch);
    const forwardX = sinTurns(yaw) * cosPitch;
    const forwardY = sinTurns(pitch);
    const forwardZ = cosTurns(yaw) * cosPitch;
    const step = effectiveSpeed * DT;
    x = clamp(flight.x + forwardX * step, CHASM_BOUNDS.minX, CHASM_BOUNDS.maxX);
    y = clamp(flight.y + forwardY * step, CHASM_BOUNDS.minY, CHASM_BOUNDS.maxY);
    z = clamp(flight.z + forwardZ * step, CHASM_BOUNDS.minZ, CHASM_BOUNDS.maxZ);

    orbitYaw = wrapSignedTurns(orbitYaw * ORBIT_DECAY);
    orbitPitch = orbitPitch * ORBIT_DECAY;
  }

  const nextFlight: SkyriverFlight = Object.freeze({
    // The autopilot sample can overshoot its control ring slightly, so both modes clamp.
    x: quantize(clamp(x, CHASM_BOUNDS.minX, CHASM_BOUNDS.maxX)),
    y: quantize(clamp(y, CHASM_BOUNDS.minY, CHASM_BOUNDS.maxY)),
    z: quantize(clamp(z, CHASM_BOUNDS.minZ, CHASM_BOUNDS.maxZ)),
    yaw: quantize(yaw),
    pitch: quantize(pitch),
    speed: quantize(speed),
    mode,
    autopilotT: quantize(autopilotT),
    boostT: quantize(boostT),
  });

  const nextCamera: SkyriverCamera = Object.freeze({
    orbitYaw: quantize(orbitYaw),
    orbitPitch: quantize(orbitPitch),
  });

  return Object.freeze({
    tick,
    flight: nextFlight,
    // Structural sharing: an edge-free tick reuses the previous camera and event branches.
    camera: sameCamera(state.camera, nextCamera) ? state.camera : nextCamera,
    eventSeq: appendEvents(state.eventSeq, tick, pending),
  });
}

function sameCamera(left: SkyriverCamera, right: SkyriverCamera): boolean {
  return left.orbitYaw === right.orbitYaw && left.orbitPitch === right.orbitPitch;
}
