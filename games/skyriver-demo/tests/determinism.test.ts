/**
 * @file determinism.test.ts — A1/A2 acceptance for the Skyriver deterministic sim (plan T2).
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R2  — custom immutable-state runtime via createInstalledRuntimeAdapter, input only via step(inputs).
 *   R6  — checksumMode 'per-tick'; A1/A2 built on /testing assertDeterministic + assertReplayVerifies.
 *   A1  — two runtimes, same seed + input trace → identical per-tick checksum sequence (node, no WebGL).
 *   A2  — assertReplayVerifies against a recorded trace (exercises restore-resim + checkpoint hydration).
 *   Design "Runtime (P0 fix)" — bounded event history; state must not grow with ticks.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   dist/testing.d.ts            — assertDeterministic(SyncplaySynctestConfig), assertReplayVerifies(ReplayVerificationConfig).
 *   dist/synctest.d.ts           — SyncplaySynctestConfig { runtimeFactory(seed), policy, frames?, seeds?, inputFuzz? }.
 *   dist/replay.d.ts             — ReplayVerificationConfig { replay, runtimeFactory(identity, sessionConfigBytes), policy, decodeInput? }.
 *   dist/runtime-session.d.ts    — SyncplaySessionPolicy = Omit<RuntimeSessionConfig, 'runtime'>.
 *   dist/random.d.ts             — DeterministicRandom (root entry), used to build the recorded trace.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { DeterministicRandom, createSyncplaySession } from '@series-inc/rundot-syncplay';
import { assertDeterministic, assertReplayVerifies } from '@series-inc/rundot-syncplay/testing';
import { deriveCustomRuntimeIdentity, kinetixRuntimeModuleManifest } from '@series-inc/rundot-syncplay/core';
import type { SyncplaySessionPolicy } from '@series-inc/rundot-syncplay';

import {
  SKYRIVER_SIM_MODULE_PATHS,
  SKYRIVER_SIM_SOURCE_ROOT,
  createSkyriverIdentity,
  decodeSkyriverSessionConfig,
  skyriverIdentityOptions,
} from '../src/sim/identity';
import { SKYRIVER_RUNTIME_IDENTITY, SKYRIVER_SIM_MODULE_MANIFEST } from '../src/sim/module-manifest';
import {
  SKYRIVER_NEUTRAL_INPUT,
  type SkyriverInput,
  decodeInput,
  encodeInput,
  quantizeAxis,
} from '../src/sim/input';
import {
  CHASM_BOUNDS,
  MAX_EVENT_HISTORY,
  SKYRIVER_EVENT_BOOST_END,
  SKYRIVER_EVENT_BOOST_START,
  SKYRIVER_EVENT_MODE_CHANGE,
  SKYRIVER_TICK_RATE,
  type SkyriverState,
  advanceState,
  createInitialState,
  createSkyriverSimConfig,
} from '../src/sim/systems';
import {
  type SkyriverProjection,
  createSkyriverRuntime,
  decodeSkyriverState,
  encodeSkyriverState,
  skyriverChecksumBytes,
} from '../src/sim/runtime';

const TRACE_FRAMES = 120;
const TRACE_SEED = 1337;

type SkyriverRuntime = ReturnType<typeof createSkyriverRuntime>;

/** The recorded input trace: a pure function of a fixed seed, so every run replays it byte-for-byte. */
function buildInputTrace(seed: number, frames: number): readonly SkyriverInput[] {
  const random = new DeterministicRandom(seed).fork('skyriver.trace');
  const trace: SkyriverInput[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    trace.push(traceInput(random));
  }
  return Object.freeze(trace);
}

/** One trace frame. Axes land on the 0.01 input grid; pulses fire rarely, as a pilot's would. */
function traceInput(random: DeterministicRandom): SkyriverInput {
  return Object.freeze({
    throttle: quantizeAxis(random.nextInt(-100, 100) / 100),
    yawRate: quantizeAxis(random.nextInt(-100, 100) / 100),
    pitchRate: quantizeAxis(random.nextInt(-100, 100) / 100),
    boost: random.nextInt(0, 4) === 0,
    modeToggle: random.nextInt(0, 19) === 0,
  });
}

function policyFor(playerCount = 1): SyncplaySessionPolicy<SkyriverState, SkyriverInput, unknown, SkyriverProjection> {
  return {
    playerCount,
    defaultInput: SKYRIVER_NEUTRAL_INPUT,
    // R6: offline sessions default to 'events-only' (dist/runner.js) — determinism acceptance needs every tick.
    checksumMode: 'per-tick',
  };
}

function runtimeForSeed(seed: number): SkyriverRuntime {
  return createSkyriverRuntime(createSkyriverIdentity(seed, 'autopilot'));
}

/** Drives one session over the trace and returns the per-tick checksum sequence. */
function runTrace(runtime: SkyriverRuntime, trace: readonly SkyriverInput[]): {
  readonly checksums: readonly string[];
  readonly session: ReturnType<typeof createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>>;
} {
  const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
    runtime,
    { ...policyFor(), checksumIntervalFrames: 1 },
  );
  const checksums: string[] = [];
  for (const input of trace) {
    session.setInput(0, input);
    session.stepFrames(1);
    checksums.push(session.computeRecordedChecksum(session.currentFrame));
  }
  return { checksums, session };
}

describe('skyriver identity and session config (T2, plan Design "Identity & session config")', () => {
  it('derives a stable 30 Hz identity and round-trips the session config', () => {
    const first = createSkyriverIdentity(7, 'freefly');
    const second = createSkyriverIdentity(7, 'freefly');

    expect(first.identity.tickRate).toBe(SKYRIVER_TICK_RATE);
    expect(first.identity).toStrictEqual(second.identity);
    expect([...first.sessionConfigBytes]).toStrictEqual([...second.sessionConfigBytes]);
    expect(decodeSkyriverSessionConfig(first.sessionConfigBytes)).toStrictEqual({ seed: 7, startMode: 'freefly' });
    // The adapter rejects a state-report identity; the custom transfer path must not set the domain.
    expect(first.identity.stateDigestDomain).toBeUndefined();
  });

  it('folds seed and startMode into the config bytes, and the sim sources into the identity', () => {
    const base = createSkyriverIdentity(7, 'autopilot');
    const otherSeed = createSkyriverIdentity(8, 'autopilot');
    const otherMode = createSkyriverIdentity(7, 'freefly');

    expect([...otherSeed.sessionConfigBytes]).not.toStrictEqual([...base.sessionConfigBytes]);
    expect([...otherMode.sessionConfigBytes]).not.toStrictEqual([...base.sessionConfigBytes]);
    // Seed and mode are session config, not identity: peers on the same build share one identity.
    expect(otherSeed.identity).toStrictEqual(base.identity);
    expect(otherMode.identity).toStrictEqual(base.identity);
    expect(base.identity.engineIdentityHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('keeps the committed identity artifact equal to one derived from the sim sources now', () => {
    // Source-bound identity, verified rather than assumed. Both helpers are node-only
    // (core/src/kinetix-source-snapshot.mjs reads files; core/src/kinetix-product-contract.mjs
    // imports node:crypto), so the browser reads the committed artifact in
    // src/sim/module-manifest.ts and this test is the gate that keeps the two in step.
    // Regenerate with: npx vite-node tests/generate-identity.ts
    const simRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', SKYRIVER_SIM_SOURCE_ROOT);
    const computed = kinetixRuntimeModuleManifest(simRoot, [...SKYRIVER_SIM_MODULE_PATHS]);

    expect(computed).toStrictEqual([...SKYRIVER_SIM_MODULE_MANIFEST]);
    expect(deriveCustomRuntimeIdentity(skyriverIdentityOptions(computed)))
      .toStrictEqual({ ...SKYRIVER_RUNTIME_IDENTITY });
    // The runtime refuses a session whose identity is not this build's.
    expect(createSkyriverIdentity(1, 'autopilot').identity).toStrictEqual({ ...SKYRIVER_RUNTIME_IDENTITY });
  });

  it('keeps wall-clock and ambient entropy out of the sim sources', () => {
    const simRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', SKYRIVER_SIM_SOURCE_ROOT);
    const forbidden = [
      ['Math', 'random'].join('.'),
      ['Date', 'now'].join('.'),
      ['performance', 'now'].join('.'),
      'new Date(',
    ];

    for (const path of [...SKYRIVER_SIM_MODULE_PATHS, 'module-manifest.ts']) {
      const source = readFileSync(join(simRoot, path), 'utf8');
      for (const needle of forbidden) {
        expect(source, `${path} must not use ${needle}`).not.toContain(needle);
      }
    }
  });
});

describe('skyriver determinism acceptance (A1/A2)', () => {
  it('A1: assertDeterministic passes straight, rollback, hydration and replay phases', () => {
    // dist/synctest.js drives four phases per seed: straight run, per-frame hydration from
    // exported snapshot bytes, restore-resim rollback, and a replay of the exported file.
    const result = assertDeterministic<SkyriverState, SkyriverInput, unknown, SkyriverProjection>({
      runtimeFactory: (seed) => runtimeForSeed(seed),
      policy: policyFor(),
      frames: TRACE_FRAMES,
      seeds: [TRACE_SEED, 0x5eed],
      inputFuzz: (random) => traceInput(random),
    });

    expect(result.firstDivergence).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.seedsRun).toBe(2);
    expect(result.framesChecked).toBe(TRACE_FRAMES * 2);
  });

  it('A1: two runtimes with the same seed and trace produce an identical checksum sequence', () => {
    const trace = buildInputTrace(TRACE_SEED, TRACE_FRAMES);
    const left = runTrace(runtimeForSeed(TRACE_SEED), trace);
    const right = runTrace(runtimeForSeed(TRACE_SEED), trace);

    expect(left.checksums).toHaveLength(TRACE_FRAMES);
    expect(left.checksums.every((checksum) => /^[0-9a-f]{64}$/u.test(checksum))).toBe(true);
    expect(right.checksums).toStrictEqual(left.checksums);
    // A trace that never moved the sim would make the comparison vacuous.
    expect(new Set(left.checksums).size).toBe(TRACE_FRAMES);

    left.session.dispose();
    right.session.dispose();
  });

  it('A1: a different world seed diverges, so the checksum is actually seed-bound', () => {
    const trace = buildInputTrace(TRACE_SEED, TRACE_FRAMES);
    const base = runTrace(runtimeForSeed(TRACE_SEED), trace);
    const other = runTrace(runtimeForSeed(TRACE_SEED + 1), trace);

    expect(other.checksums).not.toStrictEqual(base.checksums);

    base.session.dispose();
    other.session.dispose();
  });

  it('A2: assertReplayVerifies re-verifies the recorded trace on a fresh runtime', () => {
    const trace = buildInputTrace(TRACE_SEED, TRACE_FRAMES);
    const recorded = runTrace(runtimeForSeed(TRACE_SEED), trace);
    const replay = recorded.session.exportReplay();
    recorded.session.dispose();

    expect(replay.inputFrames).toHaveLength(TRACE_FRAMES);
    expect(replay.checksums).toHaveLength(TRACE_FRAMES);

    const result = assertReplayVerifies<SkyriverState, SkyriverInput, unknown, SkyriverProjection>({
      replay,
      // dist/replay.d.ts: the factory receives the replay's own identity + config bytes.
      runtimeFactory: (identity, sessionConfigBytes) => createSkyriverRuntime({ identity, sessionConfigBytes }),
      policy: { ...policyFor(), checksumIntervalFrames: 1 },
      decodeInput: (recordedInput) => decodeInput(recordedInput),
      throwOnMismatch: true,
    });

    expect(result.mismatches).toBe(0);
    expect(result.firstMismatch).toBeUndefined();
    expect(result.frames).toBe(TRACE_FRAMES);
    expect(result.finalChecksum).toBe(recorded.checksums[TRACE_FRAMES - 1]);
  });

  it('A2: a replay whose recorded checksum was tampered with fails loudly', () => {
    const trace = buildInputTrace(TRACE_SEED, 12);
    const recorded = runTrace(runtimeForSeed(TRACE_SEED), trace);
    const replay = recorded.session.exportReplay();
    recorded.session.dispose();

    const tampered = {
      ...replay,
      checksums: replay.checksums.map((entry, index) => (index === 5 ? { ...entry, checksum: 'f'.repeat(64) } : entry)),
    };

    expect(() => assertReplayVerifies<SkyriverState, SkyriverInput, unknown, SkyriverProjection>({
      replay: tampered,
      runtimeFactory: (identity, sessionConfigBytes) => createSkyriverRuntime({ identity, sessionConfigBytes }),
      policy: { ...policyFor(), checksumIntervalFrames: 1 },
      decodeInput: (recordedInput) => decodeInput(recordedInput),
      throwOnMismatch: true,
    })).toThrow();
  });
});

describe('skyriver checkpoint codec', () => {
  it('round-trips serialize → hydrate and preserves the checksum bytes exactly', () => {
    // Every field must be exercised, so the state is built to have a non-zero value in each one:
    // boost held (boostT > 0), orbit pushed off centre, and a populated event tail. A field the
    // codec silently dropped would otherwise round-trip by luck whenever its value happened to be 0.
    const config = createSkyriverSimConfig(TRACE_SEED, 'freefly');
    let state = createInitialState(config);
    for (let tick = 0; tick < 40; tick += 1) {
      state = advanceState(state, [{
        throttle: 0.75,
        yawRate: -0.33,
        pitchRate: 0.21,
        boost: true,
        modeToggle: tick % 7 === 0,
      }], config);
    }

    expect(state.flight.boostT).toBeGreaterThan(0);
    expect(state.camera.orbitYaw === 0 && state.camera.orbitPitch === 0).toBe(false);
    expect(state.eventSeq.recent.length).toBeGreaterThan(0);
    expect(state.eventSeq.emitted).toBeGreaterThan(0);

    const bytes = encodeSkyriverState(state);
    const hydrated = decodeSkyriverState(state.tick, bytes);

    expect(hydrated).toStrictEqual(state);
    expect([...encodeSkyriverState(hydrated)]).toStrictEqual([...bytes]);
    expect([...skyriverChecksumBytes(hydrated)]).toStrictEqual([...skyriverChecksumBytes(state)]);
    // A hydrated state must resimulate identically, not merely re-encode identically.
    const neutral = [SKYRIVER_NEUTRAL_INPUT];
    expect(encodeSkyriverState(advanceState(hydrated, neutral, config)))
      .toStrictEqual(encodeSkyriverState(advanceState(state, neutral, config)));
  });

  it('round-trips through the runtime checkpoint codec with an identical checksum', () => {
    const trace = buildInputTrace(TRACE_SEED, 25);
    const runtime = runtimeForSeed(TRACE_SEED);
    const run = runTrace(runtime, trace);
    const frame = run.session.currentFrame;

    const bytes = run.session.getSnapshotBytes(frame);
    const rehydrated = runtimeForSeed(TRACE_SEED);
    const checkpoint = rehydrated.hydrateCheckpoint(frame, bytes);

    expect(rehydrated.checksum(checkpoint)).toBe(run.session.computeRecordedChecksum(frame));

    run.session.dispose();
  });

  it('rejects a wrong magic tag and a wrong frame', () => {
    const { identity, sessionConfigBytes } = createSkyriverIdentity(3, 'autopilot');
    const runtime = createSkyriverRuntime({ identity, sessionConfigBytes });
    const bytes = runtime.serializeCheckpoint(runtime.capture());

    const wrongMagic = bytes.slice();
    wrongMagic[0] = (wrongMagic[0]! ^ 0xff) & 0xff;
    expect(() => decodeSkyriverState(0, wrongMagic)).toThrow(/SKYRIVER_CHECKPOINT_INVALID/u);
    expect(() => decodeSkyriverState(9, bytes)).toThrow(/SKYRIVER_CHECKPOINT_FRAME_MISMATCH/u);
    expect(() => decodeSkyriverState(0, bytes.slice(0, 11))).toThrow(/SKYRIVER_CHECKPOINT_INVALID/u);
  });
});

describe('skyriver sim semantics', () => {
  it('starts at tick 0 in the configured start mode', () => {
    const autopilot = createSkyriverRuntime(createSkyriverIdentity(11, 'autopilot'));
    const freefly = createSkyriverRuntime(createSkyriverIdentity(11, 'freefly'));

    const autopilotState = autopilot.inspect(autopilot.capture());
    expect(autopilotState.tick).toBe(0);
    expect(autopilotState.flight.mode).toBe(0);
    expect(freefly.inspect(freefly.capture()).flight.mode).toBe(1);
  });

  it('produces a fresh frozen root per tick, so captures can be retained by reference', () => {
    // capturedStateIsDetached: true means the adapter keeps captured roots without cloning
    // (core/src/kinetix-runtime-adapter-utils.mjs "retainable"), which only holds if every
    // root is frozen and never mutated. The session's getState()/inspect() hand back
    // structured clones, so this invariant is asserted against the pure systems layer.
    const config = createSkyriverSimConfig(11, 'freefly');
    const first = createInitialState(config);
    const second = advanceState(first, [{ ...SKYRIVER_NEUTRAL_INPUT, throttle: 1 }], config);

    for (const state of [first, second]) {
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.flight)).toBe(true);
      expect(Object.isFrozen(state.camera)).toBe(true);
      expect(Object.isFrozen(state.eventSeq)).toBe(true);
      expect(Object.isFrozen(state.eventSeq.recent)).toBe(true);
    }
    expect(second).not.toBe(first);
    expect(second.flight).not.toBe(first.flight);
    expect(second.tick).toBe(1);
    // Structural sharing: an untouched branch is reused rather than rebuilt.
    expect(second.eventSeq).toBe(first.eventSeq);
  });

  it('consumes a mode toggle exactly once and emits one event per edge', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(11, 'autopilot'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      { ...policyFor(), checksumIntervalFrames: 1 },
    );

    // Hold the toggle for three consecutive ticks: a pulse is per-tick, so the mode flips three times.
    for (let tick = 0; tick < 3; tick += 1) {
      session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, modeToggle: true });
      session.stepFrames(1);
    }
    const toggled = session.getState();
    expect(toggled.flight.mode).toBe(1);
    expect(toggled.eventSeq.emitted).toBe(3);
    expect(toggled.eventSeq.recent.filter((event) => event.kind === SKYRIVER_EVENT_MODE_CHANGE)).toHaveLength(3);

    // Neutral ticks are silent: events come only from edges.
    session.setInput(0, SKYRIVER_NEUTRAL_INPUT);
    session.stepFrames(5);
    expect(session.getState().eventSeq.emitted).toBe(3);
    expect(session.getState().flight.mode).toBe(1);

    session.dispose();
  });

  it('emits exactly one boost edge for a held boost and one for its release', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(11, 'freefly'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      { ...policyFor(), checksumIntervalFrames: 1 },
    );

    session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, boost: true });
    session.stepFrames(10);
    const held = session.getState();
    expect(held.eventSeq.recent.filter((event) => event.kind === SKYRIVER_EVENT_BOOST_START)).toHaveLength(1);
    expect(held.flight.boostT).toBeGreaterThan(0);

    session.setInput(0, SKYRIVER_NEUTRAL_INPUT);
    session.stepFrames(4);
    const released = session.getState();
    expect(released.eventSeq.recent.filter((event) => event.kind === SKYRIVER_EVENT_BOOST_START)).toHaveLength(1);
    expect(released.eventSeq.recent.filter((event) => event.kind === SKYRIVER_EVENT_BOOST_END)).toHaveLength(1);
    expect(released.flight.boostT).toBe(0);

    session.dispose();
  });

  it('boost raises the distance covered over the same number of ticks', () => {
    const distance = (boost: boolean): number => {
      const runtime = createSkyriverRuntime(createSkyriverIdentity(11, 'freefly'));
      const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
        runtime,
        { ...policyFor(), checksumIntervalFrames: 1 },
      );
      const start = session.getState().flight;
      session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, throttle: 1, boost });
      session.stepFrames(30);
      const end = session.getState().flight;
      session.dispose();
      return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    };

    expect(distance(true)).toBeGreaterThan(distance(false));
  });

  it('clamps free flight to the chasm volume', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(11, 'freefly'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      { ...policyFor(), checksumIntervalFrames: 1 },
    );

    // Full throttle, hard climb, hard turn — 40 s of it, which would otherwise leave the volume.
    session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, throttle: 1, pitchRate: 1, yawRate: 0.37, boost: true });
    for (let tick = 0; tick < SKYRIVER_TICK_RATE * 40; tick += 1) {
      session.stepFrames(1);
      const { x, y, z } = session.getState().flight;
      expect(x).toBeGreaterThanOrEqual(CHASM_BOUNDS.minX);
      expect(x).toBeLessThanOrEqual(CHASM_BOUNDS.maxX);
      expect(y).toBeGreaterThanOrEqual(CHASM_BOUNDS.minY);
      expect(y).toBeLessThanOrEqual(CHASM_BOUNDS.maxY);
      expect(z).toBeGreaterThanOrEqual(CHASM_BOUNDS.minZ);
      expect(z).toBeLessThanOrEqual(CHASM_BOUNDS.maxZ);
    }

    session.dispose();
  });

  it('keeps autopilot inside the chasm volume over a long run', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(2024, 'autopilot'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      { ...policyFor(), checksumIntervalFrames: 1 },
    );

    session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, throttle: 1 });
    for (let tick = 0; tick < SKYRIVER_TICK_RATE * 60; tick += 1) {
      session.stepFrames(1);
    }
    const flight = session.getState().flight;
    expect(flight.x).toBeGreaterThanOrEqual(CHASM_BOUNDS.minX);
    expect(flight.x).toBeLessThanOrEqual(CHASM_BOUNDS.maxX);
    expect(flight.y).toBeGreaterThanOrEqual(CHASM_BOUNDS.minY);
    expect(flight.y).toBeLessThanOrEqual(CHASM_BOUNDS.maxY);
    expect(flight.z).toBeGreaterThanOrEqual(CHASM_BOUNDS.minZ);
    expect(flight.z).toBeLessThanOrEqual(CHASM_BOUNDS.maxZ);
    // Autopilot must actually fly the path, not sit still.
    expect(flight.autopilotT).toBeGreaterThan(0);

    session.dispose();
  });

  it('rejects an input that is off the 0.01 quantization grid', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(11, 'freefly'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      { ...policyFor(), checksumIntervalFrames: 1 },
    );

    session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, throttle: 0.123456 });
    expect(() => session.stepFrames(1)).toThrow();

    session.dispose();
  });

  it('bounds the state: event history and checkpoint size stay flat over a 10-minute run', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(99, 'freefly'));
    const session = createSyncplaySession<SkyriverState, SkyriverInput, unknown, SkyriverProjection>(
      runtime,
      // 'events-only' keeps the 10-minute run cheap; this test measures size, not checksums.
      { playerCount: 1, defaultInput: SKYRIVER_NEUTRAL_INPUT, checksumMode: 'events-only' },
    );

    const ticks = SKYRIVER_TICK_RATE * 60 * 10;
    let sizeAfterWarmup = 0;
    for (let tick = 0; tick < ticks; tick += 1) {
      // Toggle and boost on every other tick: the maximum event pressure the sim can produce.
      session.setInput(0, { ...SKYRIVER_NEUTRAL_INPUT, throttle: 1, modeToggle: tick % 2 === 0, boost: tick % 4 < 2 });
      session.stepFrames(1);
      if (tick === SKYRIVER_TICK_RATE * 60) {
        sizeAfterWarmup = encodeSkyriverState(session.getState()).byteLength;
      }
    }

    const finalState = session.getState();
    expect(finalState.tick).toBe(ticks);
    expect(finalState.eventSeq.recent.length).toBeLessThanOrEqual(MAX_EVENT_HISTORY);
    expect(finalState.eventSeq.emitted).toBeGreaterThan(MAX_EVENT_HISTORY);
    expect(encodeSkyriverState(finalState).byteLength).toBe(sizeAfterWarmup);

    session.dispose();
  }, 60_000);
});

describe('skyriver projection (presentation contract)', () => {
  it('projects tick, flight and camera without mutating state, and flags edges', () => {
    const runtime = createSkyriverRuntime(createSkyriverIdentity(5, 'autopilot'));
    const before = runtime.capture();
    const beforeChecksum = runtime.checksum(before);

    const advanced = runtime.advance([
      { frame: 1, inputs: [{ ...SKYRIVER_NEUTRAL_INPUT, modeToggle: true, boost: true }], commands: [], checksum: true },
    ]);
    const after = advanced[0]!.checkpoint;

    expect(runtime.project).toBeTypeOf('function');
    const full = runtime.project!(after);
    const delta = runtime.project!(after, before);

    expect(full.tick).toBe(1);
    expect(Object.isFrozen(full)).toBe(true);
    expect(full.modeChanged).toBeUndefined();
    expect(delta.modeChanged).toBe(true);
    expect(delta.boostEdge).toBe('start');
    // Projection must not disturb the simulation it read.
    expect(runtime.checksum(before)).toBe(beforeChecksum);
  });
});

describe('skyriver input codec', () => {
  it('maps a canonical null to the neutral input and round-trips a plain object', () => {
    expect(decodeInput(null)).toStrictEqual(SKYRIVER_NEUTRAL_INPUT);
    expect(decodeInput(undefined)).toStrictEqual(SKYRIVER_NEUTRAL_INPUT);

    const input: SkyriverInput = {
      throttle: 0.42,
      yawRate: -0.07,
      pitchRate: 0.99,
      boost: true,
      modeToggle: false,
    };
    expect(decodeInput(encodeInput(input))).toStrictEqual(input);
    expect(Object.getPrototypeOf(encodeInput(input))).toBe(Object.prototype);
  });

  it('quantizes to the 0.01 grid idempotently and clamps out-of-range axes', () => {
    for (let step = -100; step <= 100; step += 1) {
      const value = quantizeAxis(step / 100);
      expect(quantizeAxis(value)).toBe(value);
    }
    expect(quantizeAxis(0.123456)).toBe(0.12);
    expect(quantizeAxis(5)).toBe(1);
    expect(quantizeAxis(-5)).toBe(-1);
    expect(Object.is(quantizeAxis(-0.001), 0)).toBe(true);
  });

  it('rejects a malformed input loudly', () => {
    expect(() => decodeInput({ ...SKYRIVER_NEUTRAL_INPUT, throttle: Number.NaN })).toThrow(/SKYRIVER_INPUT_INVALID/u);
    expect(() => decodeInput({ ...SKYRIVER_NEUTRAL_INPUT, boost: 1 })).toThrow(/SKYRIVER_INPUT_INVALID/u);
    expect(() => decodeInput({ ...SKYRIVER_NEUTRAL_INPUT, throttle: 0.005 })).toThrow(/SKYRIVER_INPUT_INVALID/u);
    expect(() => decodeInput([])).toThrow(/SKYRIVER_INPUT_INVALID/u);
  });
});
