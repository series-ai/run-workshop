/**
 * @file session.ts — the Skyriver syncplay runner session: offline wiring, pulse input, presentation.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   File Roster — "src/sim/session.ts: createSyncplayRunner offline wiring, checksumMode:'per-tick',
 *     projection adapter, pause/resume".
 *   R2 — input reaches the sim only through step(inputs), with pulse semantics via localInputForTick;
 *     presentation events emit only from confirmed frames as DeterministicEventRecords with stable
 *     dedupeKeys (mode/boost edges only).
 *   R5 — chase-cam smoothing is a pure function of (previous projection, current projection, alpha)
 *     with explicit reset on restore/rollback; mode switches are replay-safe events.
 *   R6 — checksumMode: 'per-tick' for this session.
 *   Design "Input semantics" — localInputForTick(slot, tick) supplies per-tick pulses consumed
 *     exactly once; persistent state (the free-fly stick position) rides applyInput.
 *   Design "Webview lifecycle" — visibility hidden pauses the runner; resume must not burst.
 *   A6 — resume after 30 s backgrounded produces no catch-up burst (frame jumps <= 2).
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   dist/runner.d.ts            — SyncplayRunnerConfig { runtimeFactory, defaultInput, encodeInput,
 *                                 decodeInput, localInputForTick?, presentation, checksumMode?,
 *                                 maxOfflineStepsPerUpdate? }; SyncplayRunnerOfflineOptions
 *                                 { identity, sessionConfigBytes, playerCount, checksumMode? }.
 *   dist/runner.js:14           — maxOfflineStepsPerUpdate defaults to 8 and is the runner's own
 *                                 bounded-offline-stepping mechanism; dist/runner.js:936-938 caps the
 *                                 step count AND discards the excess accumulator, which is exactly
 *                                 the resume burst guard A6 asks for.
 *   dist/runner.js:918-926      — offlineInputFor: localInputForTick owns every local seat, and
 *                                 applyInput is only the fallback. That is why the pulse reader lives
 *                                 here and nothing calls applyInput for pulses.
 *   dist/runner.js:342-355      — present(): events dispatch once per *new* frame, so a stepped frame
 *                                 emits its edge events exactly once even though project() is called
 *                                 again for the same frame at the end of update().
 *   dist/runner.js:1121-1127    — getRenderState() applies presentation.interpolate at renderAlpha.
 *   dist/effects-adapter.js:43-70 — records dedupe on the game-supplied dedupeKey.
 *   core/runtime.d.ts:114-119   — KinetixRuntimeLease { runtime, dispose }: the borrowed-runtime shape.
 *
 * WHY decodeInput IS WRAPPED HERE (integration finding, verified)
 * --------------------------------------------------------------
 * createSyncplayRunner probes the codec on construction outside production builds
 * (dist/runner.js:20-26 -> dist/input-codec.js:154-191). One probe is
 * `{...neutralInput, syncplayProbeExtraField: 1}`, and the probe *requires* decodeInput to reject it.
 * T2's decodeInput (src/sim/input.ts) validates the five known fields and tolerates unknown ones, so
 * the raw codec fails the probe with SYNCPLAY_INPUT_CODEC_UNSAFE. Measured, not assumed: the raw
 * codec fails that probe and the wrapper below passes it. input.ts is a T2 file, so the fix lives
 * here as a thin strict-shape gate that delegates every value judgement to T2's decoder.
 */
import { createSyncplayRunner } from '@series-inc/rundot-syncplay';
import type {
  DeterministicEventRecord,
  SyncplayRunner,
  SyncplayRunnerStatus,
} from '@series-inc/rundot-syncplay';

import { createSkyriverIdentity } from './identity';
import {
  SKYRIVER_NEUTRAL_INPUT,
  createSkyriverInputHelpers,
  decodeInput,
  encodeInput,
  quantizeAxis,
  type SkyriverInput,
  type SkyriverInputHelpers,
} from './input';
import type { SkyriverProjection } from './runtime';
import { createSkyriverRuntime } from './runtime';
import {
  SKYRIVER_TICK_RATE,
  type SkyriverCamera,
  type SkyriverFlight,
  type SkyriverMode,
  type SkyriverStartMode,
  type SkyriverState,
} from './systems';

/** Milliseconds per simulated tick. */
export const SKYRIVER_TICK_MS = 1000 / SKYRIVER_TICK_RATE;

/**
 * The runner's bound on offline steps per update() call (plan A6: "frame jumps <= 2").
 *
 * dist/runner.js:936-938 both caps the loop at this many steps and throws away the accumulator above
 * the cap, so a long stall or a mis-timed resume can never replay the missing wall-clock time.
 */
export const SKYRIVER_MAX_STEPS_PER_UPDATE = 2;

/** Delta clamp applied before update(), so the cap above is reached by design rather than by luck. */
export const SKYRIVER_MAX_DELTA_MS = SKYRIVER_MAX_STEPS_PER_UPDATE * SKYRIVER_TICK_MS;

/** HUD-facing event payloads. Mode and boost edges only (R2). */
export type SkyriverHudEvent =
  | { readonly kind: 'mode'; readonly mode: SkyriverMode; readonly tick: number }
  | { readonly kind: 'boost'; readonly edge: 'start' | 'end'; readonly tick: number };

/**
 * What the renderer reads each frame.
 *
 * It carries the two projections the frame sits between plus the alpha, because the chase cam is a
 * pure function of (previous projection, current projection, alpha) (R5) and must not keep its own
 * smoothing state. `flight` and `camera` are the interpolated values, for the HUD and the traffic
 * camera position.
 */
export interface SkyriverRenderState {
  /** Tick of `current`. */
  readonly tick: number;
  /** Interpolation fraction between `previous` and `current`. 0 on a discrete frame. */
  readonly alpha: number;
  readonly previous: SkyriverProjection;
  readonly current: SkyriverProjection;
  /** Interpolated shuttle state. Presentation only — never fed back into the sim. */
  readonly flight: SkyriverFlight;
  /** Interpolated orbit offsets. */
  readonly camera: SkyriverCamera;
  readonly localSlot: number;
  readonly status: SyncplayRunnerStatus;
}

export type SkyriverRunner = SyncplayRunner<SkyriverInput, SkyriverRenderState, SkyriverHudEvent>;

/** Everything main.ts and T6 need to drive one session. */
export interface SkyriverRunnerSession {
  readonly runner: SkyriverRunner;
  readonly seed: number;
  readonly startMode: SkyriverStartMode;
  /** Pointer-drag accumulator, drained once per tick by localInputForTick. */
  readonly input: SkyriverInputHelpers;

  /** Starts the offline session. Resolves once the runner is running. */
  start(): Promise<void>;
  /** Stops the session. The runner can be started again. */
  stop(): void;
  /** Releases the runner and its runtime lease. */
  dispose(): Promise<void>;

  /**
   * Advances the simulation. Clamps the delta to SKYRIVER_MAX_DELTA_MS and does nothing while
   * paused, so a backgrounded webview cannot accumulate wall-clock time to replay (A6).
   */
  update(deltaMs: number): void;

  /** Pause/resume for the webview lifecycle. Idempotent. */
  pause(): void;
  resume(): void;
  readonly paused: boolean;

  /** Queues a pointer or stick drag, in pixels. Consumed on the next tick. */
  queueOrbitDelta(deltaXPixels: number, deltaYPixels: number): void;
  /**
   * Queues one mode toggle. Strictly a per-tick pulse: it fires on exactly one tick however many
   * frames pass before that tick runs, and repeat-last prediction cannot re-fire it.
   */
  queueModeToggle(): void;
  /** Boost is a held level, not a pulse: the sim derives both edges from it (input.ts). */
  setBoost(held: boolean): void;
  readonly boostHeld: boolean;
  /** Held throttle demand in [-1, 1]. Quantized on the way in. */
  setThrottle(level: number): void;
  /** Held steering axes in [-1, 1], for keyboard/stick input that is not a drag. */
  setSteerAxes(yawRate: number, pitchRate: number): void;
  /** Drops every queued pulse and held axis. For a pointer cancel, a blur, or a pause. */
  resetInput(): void;
  /** The input that will be handed to the next tick, without consuming it. For the HUD and probes. */
  peekInput(): SkyriverInput;
}

export interface SkyriverSessionOptions {
  /** Starting quality is presentation-only; the seed and start mode are session config. */
  readonly seed: number;
  readonly startMode: SkyriverStartMode;
}

function fail(code: string): never {
  throw new Error(code);
}

/** The exact wire fields. An unknown key is a codec error, not a value to ignore (see file header). */
const INPUT_WIRE_KEYS: readonly string[] = Object.freeze([
  'throttle',
  'yawRate',
  'pitchRate',
  'boost',
  'modeToggle',
]);

/**
 * Strict-shape gate in front of T2's decoder.
 *
 * Rejects an object carrying a field this codec does not define, then delegates every value decision
 * to src/sim/input.ts. A canonical null still maps to the neutral input, as the codec contract
 * requires.
 */
export function decodeSkyriverInputStrict(value: unknown): SkyriverInput {
  if (value !== null && value !== undefined) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      fail('SKYRIVER_INPUT_INVALID: expected a plain object');
    }
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (!INPUT_WIRE_KEYS.includes(key)) fail(`SKYRIVER_INPUT_INVALID: unknown field ${key}`);
    }
  }
  return decodeInput(value);
}

/** Shortest-arc interpolation for an angle in turns, wrapped to [-0.5, 0.5). */
function lerpTurns(from: number, to: number, alpha: number): number {
  let delta = to - from;
  // One wrap is enough: both inputs are already wrapped into a single turn by the sim.
  if (delta > 0.5) delta -= 1;
  else if (delta < -0.5) delta += 1;
  const value = from + delta * alpha;
  if (value >= 0.5) return value - 1;
  if (value < -0.5) return value + 1;
  return value;
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/**
 * Interpolates two projections. Pure: no persistent smoothing state, so a restore or a replay cannot
 * carry a stale value across the seam (plan P2-13, R5).
 *
 * Only consecutive ticks interpolate. A gap — a rollback, a hydration, a bounded-step catch-up that
 * dropped a frame — snaps to the current projection instead of sweeping across a discontinuity.
 */
export function interpolateSkyriverFlight(
  previous: SkyriverProjection,
  current: SkyriverProjection,
  alpha: number,
): { readonly flight: SkyriverFlight; readonly camera: SkyriverCamera; readonly alpha: number } {
  const clampedAlpha = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha;
  if (current.tick - previous.tick !== 1 || clampedAlpha === 0) {
    return { flight: current.flight, camera: current.camera, alpha: 0 };
  }

  const from = previous.flight;
  const to = current.flight;
  return {
    alpha: clampedAlpha,
    flight: {
      x: lerp(from.x, to.x, clampedAlpha),
      y: lerp(from.y, to.y, clampedAlpha),
      z: lerp(from.z, to.z, clampedAlpha),
      yaw: lerpTurns(from.yaw, to.yaw, clampedAlpha),
      pitch: lerp(from.pitch, to.pitch, clampedAlpha),
      speed: lerp(from.speed, to.speed, clampedAlpha),
      // Discrete fields take the current tick's value: half a mode is not a state.
      mode: to.mode,
      autopilotT: to.autopilotT,
      boostT: lerp(from.boostT, to.boostT, clampedAlpha),
    },
    camera: {
      orbitYaw: lerpTurns(previous.camera.orbitYaw, current.camera.orbitYaw, clampedAlpha),
      orbitPitch: lerp(previous.camera.orbitPitch, current.camera.orbitPitch, clampedAlpha),
    },
  };
}

/**
 * The HUD's event records.
 *
 * dedupeKey is (kind, tick): stable across a re-simulation of the same tick, which is what makes a
 * rollback re-emit nothing (R2, A5 "each toggle emits exactly one deduped event").
 */
export function skyriverPresentationEvents(
  projection: SkyriverProjection,
): readonly DeterministicEventRecord<SkyriverHudEvent>[] {
  const records: DeterministicEventRecord<SkyriverHudEvent>[] = [];

  if (projection.modeChanged === true) {
    records.push({
      eventId: 'skyriver.mode',
      frame: projection.tick,
      sequence: records.length,
      payload: { kind: 'mode', mode: projection.flight.mode, tick: projection.tick },
      predictionState: 'confirmed',
      dedupeKey: `skyriver:mode:${projection.tick}`,
      notHashedKeys: [],
    });
  }

  if (projection.boostEdge !== undefined) {
    records.push({
      eventId: 'skyriver.boost',
      frame: projection.tick,
      sequence: records.length,
      payload: { kind: 'boost', edge: projection.boostEdge, tick: projection.tick },
      predictionState: 'confirmed',
      dedupeKey: `skyriver:boost:${projection.boostEdge}:${projection.tick}`,
      notHashedKeys: [],
    });
  }

  return records;
}

/**
 * Builds a single-player offline Skyriver session.
 *
 * The runtime is handed over as a borrowed lease (core/runtime.d.ts:114-119) whose dispose() is a
 * no-op: the adapter owns no resource that outlives the runner, and a borrowed lease keeps the
 * runner from assuming an ownership contract this sim does not need.
 */
export function createSkyriverRunnerSession(
  seed: number,
  startMode: SkyriverStartMode,
): SkyriverRunnerSession {
  const { identity, sessionConfigBytes } = createSkyriverIdentity(seed, startMode);
  const input = createSkyriverInputHelpers();

  // Pulse and held state. Per-device, never checksummed (input.ts).
  let pendingModeToggles = 0;
  let boostHeld = false;
  let throttle = 0;
  let steerYaw = 0;
  let steerPitch = 0;
  let paused = false;
  let started = false;

  /**
   * One tick's input. Called once per simulated local frame (dist/runner.js:918-926), so draining
   * here is what makes a pulse fire exactly once: the runner never re-reads a consumed value, and
   * repeat-last prediction has nothing to repeat.
   */
  function takeTickInput(): SkyriverInput {
    const orbit = input.sampleOrbitPulse();
    const modeToggle = pendingModeToggles > 0;
    if (modeToggle) pendingModeToggles -= 1;

    // A drag and a held key share the axis; the drag wins when both are live, because a drag is an
    // explicit per-tick demand while a held key is a background level.
    const yawRate = orbit.yawRate !== 0 ? orbit.yawRate : steerYaw;
    const pitchRate = orbit.pitchRate !== 0 ? orbit.pitchRate : steerPitch;

    return {
      throttle,
      yawRate,
      pitchRate,
      boost: boostHeld,
      modeToggle,
    };
  }

  const runner: SkyriverRunner = createSyncplayRunner<
    SkyriverState,
    SkyriverInput,
    unknown,
    SkyriverProjection,
    SkyriverRenderState,
    SkyriverHudEvent
  >({
    checksumMode: 'per-tick',
    maxOfflineStepsPerUpdate: SKYRIVER_MAX_STEPS_PER_UPDATE,
    runtimeFactory: (runtimeIdentity, runtimeConfigBytes) => ({
      runtime: createSkyriverRuntime({
        identity: runtimeIdentity,
        sessionConfigBytes: runtimeConfigBytes,
      }),
      // Borrowed: the adapter holds only frozen JS state, so there is nothing to release.
      dispose: () => undefined,
    }),
    defaultInput: SKYRIVER_NEUTRAL_INPUT,
    encodeInput,
    decodeInput: decodeSkyriverInputStrict,
    localInputForTick: () => takeTickInput(),
    presentation: {
      // Pass-through: the projection is already the compact render contract (runtime.ts).
      project: (projection, context) => ({
        tick: projection.tick,
        alpha: 0,
        previous: projection,
        current: projection,
        flight: projection.flight,
        camera: projection.camera,
        localSlot: context.localSlot,
        status: context.status,
      }),
      interpolate: (previous, current, alpha) => {
        const blended = interpolateSkyriverFlight(previous.current, current.current, alpha);
        return {
          tick: current.tick,
          alpha: blended.alpha,
          previous: previous.current,
          current: current.current,
          flight: blended.flight,
          camera: blended.camera,
          localSlot: current.localSlot,
          status: current.status,
        };
      },
      events: skyriverPresentationEvents,
    },
  });

  function resetInput(): void {
    input.reset();
    pendingModeToggles = 0;
    boostHeld = false;
    throttle = 0;
    steerYaw = 0;
    steerPitch = 0;
  }

  return {
    runner,
    seed,
    startMode,
    input,

    async start(): Promise<void> {
      if (started) fail('SKYRIVER_SESSION_ALREADY_STARTED');
      started = true;
      paused = false;
      await runner.start({
        mode: 'offline',
        identity,
        sessionConfigBytes,
        playerCount: 1,
        localSlot: 0,
        // Set on both the config and the start options: offline sessions otherwise default to
        // 'events-only' (dist/runner.js validateOfflineOptions), and R6 requires per-tick.
        checksumMode: 'per-tick',
        maxCatchUpFrames: SKYRIVER_MAX_STEPS_PER_UPDATE,
      });
    },

    stop(): void {
      runner.stop();
      started = false;
      paused = false;
      resetInput();
    },

    async dispose(): Promise<void> {
      resetInput();
      started = false;
      await runner.dispose();
    },

    update(deltaMs: number): void {
      if (paused) return;
      if (!Number.isFinite(deltaMs) || deltaMs < 0) fail('SKYRIVER_SESSION_DELTA_INVALID');
      runner.update(deltaMs > SKYRIVER_MAX_DELTA_MS ? SKYRIVER_MAX_DELTA_MS : deltaMs);
    },

    pause(): void {
      if (paused) return;
      paused = true;
      // Releasing held controls is the honest pause: the pilot is not touching anything while the
      // webview is hidden, and a held boost must not resume as still-held.
      resetInput();
    },

    resume(): void {
      if (!paused) return;
      paused = false;
      // No accumulator to clear: update() was never called while paused, so no wall-clock time was
      // banked. The delta clamp plus maxOfflineStepsPerUpdate bound the first frame to 2 ticks.
    },

    get paused(): boolean {
      return paused;
    },

    queueOrbitDelta(deltaXPixels: number, deltaYPixels: number): void {
      if (paused) return;
      input.addPointerDelta(deltaXPixels, deltaYPixels);
    },

    queueModeToggle(): void {
      if (paused) return;
      pendingModeToggles += 1;
    },

    setBoost(held: boolean): void {
      boostHeld = paused ? false : held === true;
    },

    get boostHeld(): boolean {
      return boostHeld;
    },

    setThrottle(level: number): void {
      throttle = quantizeAxis(level);
    },

    setSteerAxes(yawRate: number, pitchRate: number): void {
      steerYaw = quantizeAxis(yawRate);
      steerPitch = quantizeAxis(pitchRate);
    },

    resetInput,

    peekInput(): SkyriverInput {
      return {
        throttle,
        yawRate: steerYaw,
        pitchRate: steerPitch,
        boost: boostHeld,
        modeToggle: pendingModeToggles > 0,
      };
    },
  };
}
