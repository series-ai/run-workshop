/**
 * @file identity.ts — Skyriver runtime identity and canonical session-config bytes.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Identity & session config (P0 fix)" — identity = deriveCustomRuntimeIdentity({tickRate: 30,
 *     inputSchema, stateSchema, runtimeModules: kinetixRuntimeModuleManifest('src/sim', [...]),
 *     deterministicVersion: 'syncplay-' + pinnedVersion + '-skyriver-' + simRev}); session-config
 *     schema {seed: int32, startMode: enum} encoded with encodeKinetixSessionConfig; the seed drives
 *     every derive* function so a peer or replay reproduces the same city and traffic.
 *   R2 — seed + options travel in canonical session-config bytes.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   core/runtime.d.ts:323          — encodeKinetixSessionConfig(schema, value): Uint8Array.
 *   core/index.d.ts:174            — decodeKinetixSessionConfig(schema, bytes).
 *   core/index.d.ts:200-225        — CustomRuntimeIdentityOptions + deriveCustomRuntimeIdentity.
 *   core/index.d.ts:165-168        — kinetixRuntimeModuleManifest(sourceRoot, relativePaths).
 *   core/runtime.d.ts:6-14         — KinetixRuntimeIdentity.
 *
 * WHY THE IDENTITY IS A BUILD-TIME ARTIFACT (deviation from the plan's literal wording)
 * ------------------------------------------------------------------------------------
 * The plan reads as though deriveCustomRuntimeIdentity runs wherever the session starts. It cannot:
 *   - core/src/kinetix-product-contract.mjs:1 imports createHash from 'node:crypto', so
 *     deriveCustomRuntimeIdentity is node-only — unavailable in an Android WebView, not merely
 *     awkward to bundle.
 *   - core/src/kinetix-source-snapshot.mjs:1 imports readFileSync, so kinetixRuntimeModuleManifest
 *     is a node-only build helper (its own doc comment says so).
 *   - Only '@series-inc/rundot-syncplay/core/runtime' is free of node builtins; the
 *     '@series-inc/rundot-syncplay/core' barrel is not.
 * So the identity is derived once in node, committed as plain data in ./module-manifest.ts, and
 * read from there at runtime. tests/determinism.test.ts re-derives it from the sim sources on every
 * run and fails if the committed artifact drifts, which keeps the identity genuinely source-bound.
 * Everything this file imports is browser-safe.
 */
import {
  decodeKinetixSessionConfig,
  encodeKinetixSessionConfig,
} from '@series-inc/rundot-syncplay/core/runtime';
import type { KinetixRuntimeIdentity } from '@series-inc/rundot-syncplay/core/runtime';

import { SKYRIVER_RUNTIME_IDENTITY } from './module-manifest';
import { SKYRIVER_START_MODES, SKYRIVER_TICK_RATE, type SkyriverStartMode } from './systems';

/**
 * The pinned syncplay version folded with this sim's revision. Bump the trailing revision whenever a
 * sim change must refuse to share a session with the previous build.
 */
export const SKYRIVER_DETERMINISTIC_VERSION = 'syncplay-6.0.0-rc.33-skyriver-1';

/** Source root and module list that bind the identity to this sim's bytes. */
export const SKYRIVER_SIM_SOURCE_ROOT = 'src/sim';

/**
 * The hashed sim modules, strictly ascending by path as the manifest normalizer requires
 * (core/src/kinetix-source-snapshot.mjs normalizeKinetixRuntimeModuleManifest).
 *
 * module-manifest.ts is deliberately absent: it *holds* the digests, so hashing it would make every
 * regeneration change its own input.
 */
export const SKYRIVER_SIM_MODULE_PATHS: readonly string[] = Object.freeze([
  'derive.ts',
  'identity.ts',
  'input.ts',
  'runtime.ts',
  'systems.ts',
]);

/** Session-config schema. Enum values must stay sorted ascending (the schema normalizer enforces it). */
export const SKYRIVER_SESSION_SCHEMA = {
  id: 'skyriver-session/v1',
  version: 1,
  maxBytes: 256,
  fields: {
    // A uint32 seed: DeterministicRandom coerces its seed with `>>> 0`, so this is the range that
    // actually selects distinct worlds.
    seed: { type: 'integer', min: 0, max: 0xffffffff },
    startMode: { type: 'enum', values: SKYRIVER_START_MODES },
  },
} as const;

/**
 * Input contract, hashed into inputSchemaId. Descriptive data only — it documents the wire shape and
 * makes an input change produce a different identity.
 */
export const SKYRIVER_INPUT_SCHEMA = {
  id: 'skyriver-input/v1',
  axisQuantum: 0.01,
  fields: {
    throttle: { type: 'quantized-axis', min: -1, max: 1 },
    yawRate: { type: 'quantized-axis', min: -1, max: 1 },
    pitchRate: { type: 'quantized-axis', min: -1, max: 1 },
    boost: { type: 'boolean', semantics: 'held-level' },
    modeToggle: { type: 'boolean', semantics: 'per-tick-pulse' },
  },
} as const;

/** State contract, hashed into stateSchemaId. Mirrors the frozen state shape in systems.ts. */
export const SKYRIVER_STATE_SCHEMA = {
  id: 'skyriver-state/v1',
  quantum: 0.000001,
  checkpointCodec: 'skyriver-binary/v1',
  fields: {
    tick: { type: 'uint32' },
    flight: {
      type: 'object',
      fields: {
        x: 'f64',
        y: 'f64',
        z: 'f64',
        yaw: 'f64-turns',
        pitch: 'f64-turns',
        speed: 'f64-mps',
        mode: 'uint8-enum',
        autopilotT: 'f64',
        boostT: 'f64-seconds',
      },
    },
    camera: { type: 'object', fields: { orbitYaw: 'f64-turns', orbitPitch: 'f64-turns' } },
    eventSeq: { type: 'object', fields: { emitted: 'uint32', recent: 'bounded-event-list-64' } },
  },
} as const;

/**
 * The exact options the identity is derived from. Kept here so the committed artifact and the node
 * verification in tests/determinism.test.ts cannot disagree about anything but the module digests.
 *
 * `runtimeModules` is injected because computing it needs node's filesystem.
 */
export function skyriverIdentityOptions(
  runtimeModules: ReadonlyArray<{ readonly path: string; readonly digest: string }>,
) {
  return {
    tickRate: SKYRIVER_TICK_RATE,
    inputSchema: SKYRIVER_INPUT_SCHEMA,
    stateSchema: SKYRIVER_STATE_SCHEMA,
    runtimeModules,
    deterministicVersion: SKYRIVER_DETERMINISTIC_VERSION,
    sessionConfigSchema: SKYRIVER_SESSION_SCHEMA,
  } as const;
}

export interface SkyriverSessionConfig {
  readonly seed: number;
  readonly startMode: SkyriverStartMode;
}

export interface SkyriverIdentityBundle {
  readonly identity: KinetixRuntimeIdentity;
  readonly sessionConfigBytes: Uint8Array;
}

function fail(code: string): never {
  throw new Error(code);
}

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) fail('SKYRIVER_SEED_INVALID');
}

/**
 * Builds the pair a session needs: the source-bound runtime identity and the canonical session
 * config bytes carrying this world's seed and start mode.
 *
 * Seed and start mode are session config, not identity, so every peer on the same build shares one
 * identity and still agrees on which world it is simulating.
 */
export function createSkyriverIdentity(seed: number, startMode: SkyriverStartMode): SkyriverIdentityBundle {
  assertSeed(seed);
  if (!SKYRIVER_START_MODES.includes(startMode)) fail('SKYRIVER_START_MODE_INVALID');

  return Object.freeze({
    identity: SKYRIVER_RUNTIME_IDENTITY,
    sessionConfigBytes: encodeKinetixSessionConfig(SKYRIVER_SESSION_SCHEMA, { seed, startMode }),
  });
}

/** Reads a session's seed and start mode back out of its canonical bytes. */
export function decodeSkyriverSessionConfig(sessionConfigBytes: Uint8Array): SkyriverSessionConfig {
  const decoded = decodeKinetixSessionConfig(SKYRIVER_SESSION_SCHEMA, sessionConfigBytes);
  const seed = decoded.seed;
  const startMode = decoded.startMode;
  // The decoder validates against the schema; these guards narrow the types and would catch a
  // schema/code mismatch loudly rather than letting `undefined` reach the sim.
  if (typeof seed !== 'number') fail('SKYRIVER_SESSION_CONFIG_INVALID: seed');
  assertSeed(seed);
  if (typeof startMode !== 'string' || !SKYRIVER_START_MODES.includes(startMode as SkyriverStartMode)) {
    fail('SKYRIVER_SESSION_CONFIG_INVALID: startMode');
  }
  return Object.freeze({ seed, startMode: startMode as SkyriverStartMode });
}
