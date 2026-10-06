/**
 * @file input.ts — Skyriver input shape, codec and local sampling helpers.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Input semantics" — localInputForTick(slot, tick) supplies per-tick pulses (orbit delta,
 *     boost edge, mode toggle) consumed exactly once; the persistent free-fly stick position rides
 *     applyInput. Neutral-substitute mapping per the codec contract.
 *   R2 — input reaches the sim only through step(inputs); there is no side channel.
 *   File Roster — "src/sim/input.ts: Input codec + touch/keyboard → per-tick pulses".
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   dist/runner.d.ts            — SyncplayRunnerConfig { defaultInput, encodeInput, decodeInput,
 *                                 localInputForTick, presentation, checksumMode }. Full runner
 *                                 wiring is T5; this file supplies the pieces it consumes.
 *   dist/runtime-session.d.ts   — RuntimeSessionConfig.defaultInput is the neutral substitute the
 *                                 session fills unset slots with.
 *
 * Axes are quantized to 0.01 steps at the edge of the system. A pointer or key sampler can produce
 * any float; the sim accepts only grid values, so an un-quantized axis fails loudly here instead of
 * desyncing a peer later.
 */

/** Quantization step for every analogue axis (plan: "each quantized to 0.01 steps"). */
const AXIS_QUANTUM = 100;

export interface SkyriverInput {
  /** Throttle demand in [-1, 1]; -1 is the cruise floor and +1 the ceiling. */
  readonly throttle: number;
  /** Yaw demand in [-1, 1]. Steers in free flight, orbits the chase camera on autopilot. */
  readonly yawRate: number;
  /** Pitch demand in [-1, 1]. Same split as yawRate. */
  readonly pitchRate: number;
  /** Held level, not a pulse: the sim derives both boost edges from it. */
  readonly boost: boolean;
  /** Single-tick pulse: one true flips the flight mode exactly once. */
  readonly modeToggle: boolean;
}

/** The neutral substitute: hands off the controls and leaves the shuttle on autopilot. */
export const SKYRIVER_NEUTRAL_INPUT: SkyriverInput = Object.freeze({
  throttle: 0,
  yawRate: 0,
  pitchRate: 0,
  boost: false,
  modeToggle: false,
});

function fail(code: string): never {
  throw new Error(code);
}

/**
 * Clamps an axis to [-1, 1] and snaps it onto the 0.01 grid.
 *
 * Math.round absorbs the binary representation error of a hundredth, which makes this idempotent:
 * quantizeAxis(quantizeAxis(v)) === quantizeAxis(v) for every finite v. -0 folds into 0 so each
 * axis value has exactly one canonical encoding.
 */
export function quantizeAxis(value: number): number {
  if (!Number.isFinite(value)) fail('SKYRIVER_INPUT_INVALID: axis must be finite');
  const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
  const steps = Math.round(clamped * AXIS_QUANTUM);
  return steps === 0 ? 0 : steps / AXIS_QUANTUM;
}

function isAxis(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= -1 && value <= 1 && quantizeAxis(value) === value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The wire shape: a plain object, which is what the session canonicalizes and records. */
export type SkyriverInputWire = {
  readonly throttle: number;
  readonly yawRate: number;
  readonly pitchRate: number;
  readonly boost: boolean;
  readonly modeToggle: boolean;
};

export function encodeInput(input: SkyriverInput): SkyriverInputWire {
  return {
    throttle: quantizeAxis(input.throttle),
    yawRate: quantizeAxis(input.yawRate),
    pitchRate: quantizeAxis(input.pitchRate),
    boost: input.boost === true,
    modeToggle: input.modeToggle === true,
  };
}

/**
 * Validates a recorded or received input.
 *
 * A canonical null (or an absent slot) maps to the neutral input, which is the codec contract's
 * neutral-substitute rule. Anything else that is not already on the axis grid is rejected rather
 * than silently rounded: rounding here would hide the exact drift the checksums exist to catch.
 */
export function decodeInput(value: unknown): SkyriverInput {
  if (value === null || value === undefined) return SKYRIVER_NEUTRAL_INPUT;
  if (!isPlainObject(value)) fail('SKYRIVER_INPUT_INVALID: expected a plain object');

  // Strict shape: the syncplay runner's codec probe (validateSyncplayInputCodec, dist/input-codec)
  // requires decodeInput to reject an object carrying unknown fields rather than tolerate them,
  // and step() decoding should fail closed the same way. The five keys below are the entire wire
  // form — an extra key is a codec mismatch, never a value to ignore.
  const KNOWN_KEYS = ['throttle', 'yawRate', 'pitchRate', 'boost', 'modeToggle'] as const;
  for (const key of Object.keys(value)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      fail(`SKYRIVER_INPUT_INVALID: unknown field "${key}"`);
    }
  }

  const { throttle, yawRate, pitchRate, boost, modeToggle } = value;
  if (!isAxis(throttle) || !isAxis(yawRate) || !isAxis(pitchRate)) {
    fail('SKYRIVER_INPUT_INVALID: axes must be on the 0.01 grid within [-1, 1]');
  }
  if (typeof boost !== 'boolean' || typeof modeToggle !== 'boolean') {
    fail('SKYRIVER_INPUT_INVALID: boost and modeToggle must be booleans');
  }

  return Object.freeze({ throttle, yawRate, pitchRate, boost, modeToggle });
}

/** Accumulated pointer or key state, drained once per tick into a quantized input. */
export interface SkyriverOrbitPulse {
  readonly yawRate: number;
  readonly pitchRate: number;
}

export interface SkyriverInputHelpers {
  /**
   * Converts an accumulated pointer drag into a quantized orbit pulse and clears the accumulator,
   * so a drag is consumed exactly once no matter how many pointer events produced it.
   */
  sampleOrbitPulse(): SkyriverOrbitPulse;
  /** Adds a pointer or stick delta in pixels. Called from the event handlers T5 installs. */
  addPointerDelta(deltaXPixels: number, deltaYPixels: number): void;
  /** Drops any pending drag, for a pointer cancel or a lost window focus. */
  reset(): void;
}

/** Pixels of drag that correspond to a full-scale axis deflection. */
const ORBIT_PIXELS_PER_FULL_AXIS = 180;

/**
 * Local-input sampling state. This lives outside the simulation on purpose: it is per-device and
 * must never reach the checksum. T5 wires it into the runner's localInputForTick.
 */
export function createSkyriverInputHelpers(): SkyriverInputHelpers {
  let pendingX = 0;
  let pendingY = 0;

  return {
    addPointerDelta(deltaXPixels: number, deltaYPixels: number): void {
      if (!Number.isFinite(deltaXPixels) || !Number.isFinite(deltaYPixels)) {
        fail('SKYRIVER_INPUT_INVALID: pointer delta must be finite');
      }
      pendingX += deltaXPixels;
      pendingY += deltaYPixels;
    },
    sampleOrbitPulse(): SkyriverOrbitPulse {
      const pulse: SkyriverOrbitPulse = {
        yawRate: quantizeAxis(pendingX / ORBIT_PIXELS_PER_FULL_AXIS),
        pitchRate: quantizeAxis(-pendingY / ORBIT_PIXELS_PER_FULL_AXIS),
      };
      pendingX = 0;
      pendingY = 0;
      return pulse;
    },
    reset(): void {
      pendingX = 0;
      pendingY = 0;
    },
  };
}
