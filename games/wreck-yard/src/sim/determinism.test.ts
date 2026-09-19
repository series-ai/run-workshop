import { assertDeterministic, assertLateJoinHydration, assertPresentationParity } from '@series-inc/rundot-syncplay/testing';
import { describe, expect, it } from 'vitest';
import { decodeYardInput, encodeYardInput, NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { createYardRuntime, yardRoomOptions } from './session';
import { projectYard, interpolateYard } from '../render/presentation';
import type { YardState } from './state';

const PLAYERS = 2;
const FRAMES = 15;

/** Slot 0 torches the gantry crossbar in bursts; slot 1 grabs and drops the ballast box. */
export function scriptedInput(slot: number, frame: number): YardInput {
  if (slot === 0) {
    const on = frame % 40 < 18;
    return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: on, ...quantizeRay([2.4 + (frame % 5) * 0.03, 8, 0.551], [0, -1, 0]) };
  }
  const holding = frame % 60 < 35;
  const lift = holding ? Math.min(1.5, (frame % 60) * 0.06) : 0;
  return { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: holding, ...quantizeRay([0.62, -0.38 + lift + 6, 1.301], [0, -1, 0]) };
}

describe('wreck yard determinism', () => {
  const room = yardRoomOptions(PLAYERS);

  it('replays identically under rollback for fuzzed inputs', () => {
    const result = assertDeterministic<YardState, YardInput>({
      runtimeFactory: () => createYardRuntime(room.runtimeIdentity, room.sessionConfigBytes),
      policy: { playerCount: PLAYERS, defaultInput: NEUTRAL_INPUT, checksumIntervalFrames: 1 },
      frames: FRAMES,
      seeds: [1],
      inputFuzz: (_random: unknown, slot: number, frame: number) => scriptedInput(slot % PLAYERS, frame),
    } as never);
    expect(result.ok).toBe(true);
    expect(result.framesChecked).toBeGreaterThanOrEqual(FRAMES);
  }, 120_000);

  it('presents the same frames offline and through the authority room', async () => {
    const proof = await assertPresentationParity({
      runnerConfig: {
        runtimeFactory: createYardRuntime,
        defaultInput: NEUTRAL_INPUT,
        encodeInput: encodeYardInput,
        decodeInput: decodeYardInput,
        presentation: { project: projectYard, interpolate: interpolateYard },
      },
      roomConfig: {
        playerCount: PLAYERS,
        seed: 7,
        hardToleranceTicks: 6,
        tickRateHz: 30,
        redundancyWindowTicks: 8,
        runtimeIdentity: room.runtimeIdentity,
        sessionConfigBytes: room.sessionConfigBytes,
        sessionConfigDigest: room.sessionConfigDigest,
        neutralInput: null,
      },
      offline: { identity: room.runtimeIdentity, sessionConfigBytes: room.sessionConfigBytes, playerCount: PLAYERS, localSlot: 0 },
      inputForFrame: scriptedInput,
      frames: 20,
      minComparedFrames: 5,
    });
    expect(proof.comparedFrames).toBeGreaterThanOrEqual(5);
  }, 120_000);

  it('hydrates a late joiner to the same checksum', () => {
    const proof = assertLateJoinHydration({
      roomConfig: {
        playerCount: PLAYERS,
        seed: 11,
        hardToleranceTicks: 6,
        tickRateHz: 30,
        redundancyWindowTicks: 8,
        snapshotCadenceTicks: 10,
        runtimeIdentity: room.runtimeIdentity,
        sessionConfigBytes: room.sessionConfigBytes,
        sessionConfigDigest: room.sessionConfigDigest,
        neutralInput: null,
      },
      clientOptions: (index) => ({
        runtimeFactory: createYardRuntime,
        defaultInput: NEUTRAL_INPUT,
        localInputForTick: (slot, tick) => scriptedInput((slot + index) % PLAYERS, tick),
        encodeInput: encodeYardInput,
        decodeInput: decodeYardInput,
      }),
      initialClientCount: 1,
      beforeJoinSteps: 20,
      afterJoinSteps: 10,
    });
    expect(proof.hydratedThrough).toBeGreaterThanOrEqual(10);
    expect(proof.frame).toBeGreaterThanOrEqual(20);
  }, 120_000);
});
