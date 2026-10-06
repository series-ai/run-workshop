/**
 * @file runtime.ts — the Skyriver simulation as an installed Kinetix runtime.
 *
 * Follows the canonical immutable-state composition
 * (node_modules/@series-inc/rundot-syncplay/core/examples/compositions/immutable-counter-runtime.mjs):
 * module-level mutable reference to a frozen root, a fresh frozen root per tick, capture by
 * reference via capturedStateIsDetached, a binary serialize/hydrate codec, and projectState.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Runtime (P0 fix)" — build directly on createInstalledRuntimeAdapter; captureState returns
 *     the frozen root (capturedStateIsDetached → O(1) capture with structural sharing);
 *     serialize/hydrateState are a fixed-layout DataView codec with 1e-6 quantization and no JSON in
 *     the hot path; projectState emits a compact render projection. createDeterministicFrameRuntime
 *     is deliberately not used.
 *   R2 — input reaches the sim only through step(inputs); there is no side channel.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   core/runtime.d.ts:169-174   — InstalledRuntimeAdapterBaseOptions { identity, sessionConfigBytes, step, decodeCommand? }.
 *   core/runtime.d.ts:216-225   — InstalledRuntimeAdapterLegacyCommonOptions { captureState, restoreState,
 *                                 frameOf, checksumBytes?, inspectState?, serializeState?, hydrateState?, projectState? }.
 *   core/runtime.d.ts:226-240   — capturedStateIsDetached lives on the legacy option union.
 *   core/runtime.d.ts:47-74     — KinetixRuntime, the ABI the session and runner consume.
 *
 * Two contracts from the adapter source shape this codec
 * (core/src/kinetix-runtime-adapter-utils.mjs):
 *   1. hydrateCheckpoint re-encodes the hydrated state and byte-compares it with the input
 *      (assertCanonicalStateBytes), so the codec must be exactly canonical.
 *   2. restoreSnapshot-then-resimulate must match the original run bit for bit, so the codec must be
 *      lossless rather than merely canonical. That is why every float in state already sits on the
 *      1e-6 grid (systems.ts quantize) instead of being rounded on the way out.
 */
import { createInstalledRuntimeAdapter } from '@series-inc/rundot-syncplay/core/runtime';
import type { KinetixRuntimeIdentity } from '@series-inc/rundot-syncplay/core/runtime';

import {
  SKYRIVER_DETERMINISTIC_VERSION,
  decodeSkyriverSessionConfig,
} from './identity';
import { type SkyriverInput, decodeInput } from './input';
import {
  MAX_EVENT_HISTORY,
  SKYRIVER_EVENT_BOOST_END,
  SKYRIVER_EVENT_BOOST_START,
  SKYRIVER_EVENT_MODE_CHANGE,
  SKYRIVER_TICK_RATE,
  type SkyriverCamera,
  type SkyriverEvent,
  type SkyriverEventKind,
  type SkyriverFlight,
  type SkyriverMode,
  type SkyriverState,
  advanceState,
  createInitialState,
  createSkyriverSimConfig,
  isQuantized,
} from './systems';

/** 'SKYR'. A checkpoint from another game, or another codec revision, must not decode as Skyriver. */
const CHECKPOINT_MAGIC = 0x534b5952;
const CHECKPOINT_VERSION = 1;

/** Fixed header: magic, version, mode, event count, frame, total events emitted, reserved. */
const HEADER_BYTES = 20;
const OFFSET_MAGIC = 0;
const OFFSET_VERSION = 4;
const OFFSET_MODE = 6;
const OFFSET_EVENT_COUNT = 7;
const OFFSET_FRAME = 8;
const OFFSET_EMITTED = 12;
const OFFSET_RESERVED = 16;

/** flight x,y,z,yaw,pitch,speed,autopilotT,boostT then camera orbitYaw,orbitPitch. */
const FLOAT_COUNT = 10;
const FLOAT_OFFSET = HEADER_BYTES;
const EVENT_OFFSET = FLOAT_OFFSET + FLOAT_COUNT * 8;
/** id, tick, kind as uint32s then the value as a double. */
const EVENT_BYTES = 20;

/** Big-endian throughout, matching the counter example's `view.setUint32(offset, value, false)`. */
const BIG_ENDIAN = false;

const UINT32_MAX = 0xffffffff;

export interface SkyriverProjection {
  readonly tick: number;
  readonly flight: SkyriverFlight;
  readonly camera: SkyriverCamera;
  /** Present only on the tick the flight mode flipped. */
  readonly modeChanged?: boolean;
  /** Present only on a boost edge. */
  readonly boostEdge?: 'start' | 'end';
}

export interface SkyriverRuntimeOptions {
  readonly identity: KinetixRuntimeIdentity;
  readonly sessionConfigBytes: Uint8Array;
}

function fail(code: string): never {
  throw new Error(code);
}

function isUint32(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= UINT32_MAX;
}

function isEventKind(value: number): value is SkyriverEventKind {
  return value === SKYRIVER_EVENT_MODE_CHANGE
    || value === SKYRIVER_EVENT_BOOST_START
    || value === SKYRIVER_EVENT_BOOST_END;
}

/**
 * Encodes a state to its canonical bytes.
 *
 * Every field is validated on the way out: a non-finite or off-grid float here is a simulation bug
 * that would otherwise surface as an unexplainable checksum mismatch on a peer.
 */
export function encodeSkyriverState(state: SkyriverState): Uint8Array {
  const { tick, flight, camera, eventSeq } = state;
  if (!isUint32(tick)) fail('SKYRIVER_STATE_INVALID: tick');
  if (flight.mode !== 0 && flight.mode !== 1) fail('SKYRIVER_STATE_INVALID: mode');
  if (!isUint32(eventSeq.emitted)) fail('SKYRIVER_STATE_INVALID: emitted');
  if (eventSeq.recent.length > MAX_EVENT_HISTORY) fail('SKYRIVER_STATE_INVALID: event history overflow');

  const floats = [
    flight.x,
    flight.y,
    flight.z,
    flight.yaw,
    flight.pitch,
    flight.speed,
    flight.autopilotT,
    flight.boostT,
    camera.orbitYaw,
    camera.orbitPitch,
  ];
  for (const value of floats) {
    if (!isQuantized(value)) fail('SKYRIVER_STATE_INVALID: float is off the 1e-6 grid');
  }

  const bytes = new Uint8Array(EVENT_OFFSET + eventSeq.recent.length * EVENT_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(OFFSET_MAGIC, CHECKPOINT_MAGIC, BIG_ENDIAN);
  view.setUint16(OFFSET_VERSION, CHECKPOINT_VERSION, BIG_ENDIAN);
  view.setUint8(OFFSET_MODE, flight.mode);
  view.setUint8(OFFSET_EVENT_COUNT, eventSeq.recent.length);
  view.setUint32(OFFSET_FRAME, tick, BIG_ENDIAN);
  view.setUint32(OFFSET_EMITTED, eventSeq.emitted, BIG_ENDIAN);
  view.setUint32(OFFSET_RESERVED, 0, BIG_ENDIAN);

  for (let index = 0; index < FLOAT_COUNT; index += 1) {
    view.setFloat64(FLOAT_OFFSET + index * 8, floats[index]!, BIG_ENDIAN);
  }

  for (let index = 0; index < eventSeq.recent.length; index += 1) {
    const event = eventSeq.recent[index]!;
    if (!isUint32(event.id) || !isUint32(event.tick)) fail('SKYRIVER_STATE_INVALID: event counter');
    if (!isEventKind(event.kind)) fail('SKYRIVER_STATE_INVALID: event kind');
    if (!isQuantized(event.value)) fail('SKYRIVER_STATE_INVALID: event value');
    const base = EVENT_OFFSET + index * EVENT_BYTES;
    view.setUint32(base, event.id, BIG_ENDIAN);
    view.setUint32(base + 4, event.tick, BIG_ENDIAN);
    view.setUint32(base + 8, event.kind, BIG_ENDIAN);
    view.setFloat64(base + 12, event.value, BIG_ENDIAN);
  }

  return bytes;
}

/**
 * Decodes canonical bytes back to a frozen state.
 *
 * Rejects a wrong magic, a wrong codec version, a frame that disagrees with the caller, a truncated
 * or misaligned buffer, a non-zero reserved word, and any float that is not on the state grid.
 */
export function decodeSkyriverState(frame: number, bytes: Uint8Array): SkyriverState {
  if (bytes.byteLength < EVENT_OFFSET || (bytes.byteLength - EVENT_OFFSET) % EVENT_BYTES !== 0) {
    fail('SKYRIVER_CHECKPOINT_INVALID: length');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(OFFSET_MAGIC, BIG_ENDIAN) !== CHECKPOINT_MAGIC) {
    fail('SKYRIVER_CHECKPOINT_INVALID: magic');
  }
  if (view.getUint16(OFFSET_VERSION, BIG_ENDIAN) !== CHECKPOINT_VERSION) {
    fail('SKYRIVER_CHECKPOINT_INVALID: version');
  }
  if (view.getUint32(OFFSET_RESERVED, BIG_ENDIAN) !== 0) {
    fail('SKYRIVER_CHECKPOINT_INVALID: reserved');
  }

  const encodedFrame = view.getUint32(OFFSET_FRAME, BIG_ENDIAN);
  if (!isUint32(frame) || encodedFrame !== frame) fail('SKYRIVER_CHECKPOINT_FRAME_MISMATCH');

  const mode = view.getUint8(OFFSET_MODE);
  if (mode !== 0 && mode !== 1) fail('SKYRIVER_CHECKPOINT_INVALID: mode');
  const eventCount = view.getUint8(OFFSET_EVENT_COUNT);
  if (eventCount > MAX_EVENT_HISTORY
    || eventCount !== (bytes.byteLength - EVENT_OFFSET) / EVENT_BYTES) {
    fail('SKYRIVER_CHECKPOINT_INVALID: event count');
  }

  const floats: number[] = [];
  for (let index = 0; index < FLOAT_COUNT; index += 1) {
    const value = view.getFloat64(FLOAT_OFFSET + index * 8, BIG_ENDIAN);
    if (!isQuantized(value)) fail('SKYRIVER_CHECKPOINT_INVALID: float is off the 1e-6 grid');
    floats.push(value);
  }

  const recent: SkyriverEvent[] = [];
  for (let index = 0; index < eventCount; index += 1) {
    const base = EVENT_OFFSET + index * EVENT_BYTES;
    const kind = view.getUint32(base + 8, BIG_ENDIAN);
    if (!isEventKind(kind)) fail('SKYRIVER_CHECKPOINT_INVALID: event kind');
    const value = view.getFloat64(base + 12, BIG_ENDIAN);
    if (!isQuantized(value)) fail('SKYRIVER_CHECKPOINT_INVALID: event value');
    recent.push(Object.freeze({
      id: view.getUint32(base, BIG_ENDIAN),
      tick: view.getUint32(base + 4, BIG_ENDIAN),
      kind,
      value,
    }));
  }

  const flight: SkyriverFlight = Object.freeze({
    x: floats[0]!,
    y: floats[1]!,
    z: floats[2]!,
    yaw: floats[3]!,
    pitch: floats[4]!,
    speed: floats[5]!,
    mode: mode as SkyriverMode,
    autopilotT: floats[6]!,
    boostT: floats[7]!,
  });

  return Object.freeze({
    tick: encodedFrame,
    flight,
    camera: Object.freeze({ orbitYaw: floats[8]!, orbitPitch: floats[9]! }),
    eventSeq: Object.freeze({
      emitted: view.getUint32(OFFSET_EMITTED, BIG_ENDIAN),
      recent: Object.freeze(recent) as readonly SkyriverEvent[],
    }),
  });
}

/**
 * The checksum preimage: exactly the canonical checkpoint bytes.
 *
 * Using one encoding for both is what makes "serialize → hydrate preserves the checksum" a property
 * of the codec rather than a coincidence of two encoders agreeing.
 */
export function skyriverChecksumBytes(state: SkyriverState): Uint8Array {
  return encodeSkyriverState(state);
}

/**
 * The presentation projection. Pure, and it never mutates either argument: the renderer reads this,
 * and the adapter's project() hook may hand it internal roots that must stay frozen.
 */
export function projectSkyriverState(state: SkyriverState, previous: SkyriverState | null): SkyriverProjection {
  const modeChanged = previous !== null && previous.flight.mode !== state.flight.mode;
  const boostEdge = boostEdgeOf(state, previous);

  return Object.freeze({
    tick: state.tick,
    // Shared by reference: both branches are frozen, so the renderer cannot disturb the simulation.
    flight: state.flight,
    camera: state.camera,
    ...(modeChanged ? { modeChanged: true as const } : {}),
    ...(boostEdge !== null ? { boostEdge } : {}),
  });
}

function boostEdgeOf(state: SkyriverState, previous: SkyriverState | null): 'start' | 'end' | null {
  if (previous === null) return null;
  if (previous.flight.boostT === 0 && state.flight.boostT > 0) return 'start';
  if (previous.flight.boostT > 0 && state.flight.boostT === 0) return 'end';
  return null;
}

/**
 * Builds the Skyriver runtime for one session.
 *
 * The seed and start mode come from the session config bytes, so a replay or a peer rebuilds exactly
 * the same world from the same bytes.
 */
export function createSkyriverRuntime({ identity, sessionConfigBytes }: SkyriverRuntimeOptions) {
  // Own the bytes: the caller may reuse its buffer (the counter example copies for the same reason).
  const ownedConfigBytes = new Uint8Array(sessionConfigBytes);
  const sessionConfig = decodeSkyriverSessionConfig(ownedConfigBytes);

  if (identity.tickRate !== SKYRIVER_TICK_RATE) fail('SKYRIVER_IDENTITY_TICK_RATE_MISMATCH');
  if (identity.deterministicVersion !== SKYRIVER_DETERMINISTIC_VERSION) {
    fail('SKYRIVER_IDENTITY_VERSION_MISMATCH');
  }

  const simConfig = createSkyriverSimConfig(sessionConfig.seed, sessionConfig.startMode);
  let state = createInitialState(simConfig);

  return createInstalledRuntimeAdapter<SkyriverState, SkyriverInput, never, SkyriverProjection>({
    identity,
    sessionConfigBytes: ownedConfigBytes,
    captureState: () => state,
    restoreState: (restored) => { state = restored; },
    frameOf: (captured) => captured.tick,
    step: (inputs, commands) => {
      // The adapter rejects commands when decodeCommand is absent; this keeps the reason local.
      if (commands.length !== 0) fail('SKYRIVER_COMMANDS_UNSUPPORTED');
      state = advanceState(state, inputs.map((input) => decodeInput(input)), simConfig);
    },
    // Each tick produces a fresh frozen root, so a capture is retained by reference: O(1) capture
    // and the structural sharing a delta renderer depends on.
    capturedStateIsDetached: true,
    checksumBytes: skyriverChecksumBytes,
    serializeState: encodeSkyriverState,
    hydrateState: decodeSkyriverState,
    projectState: projectSkyriverState,
  });
}
