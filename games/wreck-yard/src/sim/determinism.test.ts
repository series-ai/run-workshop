import { canonicalStringify, createSyncplayRunner, type NetworkedSyncplayClient } from '@series-inc/rundot-syncplay/browser';
import { assertDeterministicAsync, assertLateJoinHydrationAsync, createSimulatedSyncplayMatch } from '@series-inc/rundot-syncplay/testing';
import { describe, expect, it } from 'vitest';
import { decodeYardInput, encodeYardInput, NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { createYardRuntime, yardRoomOptions } from './session';
import { projectYard, interpolateYard, type YardRender } from '../render/presentation';
import type { YardState } from './state';

const PLAYERS = 2;
const FRAMES = 15;

/** Slot 0 torches the gantry crossbar in bursts; slot 1 grabs and drops the ballast box. */
export function scriptedInput(slot: number, frame: number): YardInput {
  if (slot === 0) {
    const on = frame % 40 < 18;
    return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: on, ...quantizeRay([2.4 + (frame % 5) * 0.03, 4, 0.551], [0, -1, 0]) };
  }
  const holding = frame % 60 < 35;
  const lift = holding ? Math.min(1.5, (frame % 60) * 0.06) : 0;
  return { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: holding, ...quantizeRay([0.62, -0.38 + lift + 6, 1.301], [0, -1, 0]) };
}

describe('wreck yard determinism', () => {
  const room = yardRoomOptions(PLAYERS);

  it('replays identically under rollback for fuzzed inputs', async () => {
    const result = await assertDeterministicAsync<YardState, YardInput>({
      runtimeFactory: () => createYardRuntime(room.runtimeIdentity, room.sessionConfigBytes),
      policy: { playerCount: PLAYERS, defaultInput: NEUTRAL_INPUT, checksumIntervalFrames: 1 },
      frames: FRAMES,
      seeds: [1],
      inputFuzz: (_random: unknown, slot: number, frame: number) => scriptedInput(slot % PLAYERS, frame),
    } as never);
    expect(result.ok).toBe(true);
    expect(result.framesChecked).toBeGreaterThanOrEqual(FRAMES);
  }, 300_000);

  it('presents the same frames offline and through the authority room', async () => {
    const frames = 20;
    const offlineProjections = new Map<number, string>();
    const offline = createSyncplayRunner<YardState, YardInput, unknown, YardState, YardRender>({
      inputOwnership: room.inputOwnership,
      runtimeFactory: createYardRuntime,
      defaultInput: NEUTRAL_INPUT,
      encodeInput: encodeYardInput,
      decodeInput: decodeYardInput,
      presentation: {
        project: (state, context) => {
          offlineProjections.set(state.frame, canonicalStringify(state));
          return projectYard(state, context);
        },
        interpolate: interpolateYard,
      },
    });
    const match = createSimulatedSyncplayMatch({
      roomConfig: {
        ...room,
        playerCount: PLAYERS,
        seed: 7,
        hardToleranceTicks: 6,
        tickRateHz: 30,
        redundancyWindowTicks: 8,
        neutralInput: null,
      },
    });
    const clients: NetworkedSyncplayClient<YardState>[] = [];
    try {
      await offline.start({ mode: 'offline', identity: room.runtimeIdentity, sessionConfigBytes: room.sessionConfigBytes,
        playerCount: PLAYERS, localSlot: 0, botInputForTick: scriptedInput });
      for (let frame = 1; frame <= frames; frame += 1) {
        offline.applyInput(scriptedInput(0, frame));
        offline.update(1000 / 30);
        expect(offlineProjections.has(frame)).toBe(true);
      }
      for (let slot = 0; slot < PLAYERS; slot += 1) {
        const peer = match.connect(`parity-${slot}`, {
          inputOwnership: room.inputOwnership,
          runtimeFactory: createYardRuntime,
          defaultInput: NEUTRAL_INPUT,
          // Authority tick T produces state frame T + 1.
          localInputForTick: (_slot, tick) => scriptedInput(slot, tick + 1),
          encodeInput: encodeYardInput,
          decodeInput: decodeYardInput,
          confirmedPresentationBufferSize: frames + 8,
        });
        clients.push(peer.client);
      }
      await match.advanceAsync(frames + 8);
      await match.settleAsync();
      for (const client of clients) {
        let comparedFrames = 0;
        for (const entry of client.drainConfirmedPresentationFrames()) {
          const expected = offlineProjections.get(entry.frame);
          if (expected === undefined) continue;
          expect(canonicalStringify(entry.projection), `state frame ${entry.frame}`).toBe(expected);
          comparedFrames += 1;
        }
        expect(comparedFrames).toBeGreaterThanOrEqual(5);
      }
    } finally {
      const cleanup = await Promise.allSettled([
        Promise.resolve().then(() => offline.dispose()),
        ...clients.map((client) => Promise.resolve().then(() => client.dispose())),
      ]);
      const failures = cleanup.filter((result) => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Parity cleanup failed');
    }
  }, 500_000);

  it('hydrates a late joiner to the same checksum', async () => {
    const proof = await assertLateJoinHydrationAsync({
      roomConfig: {
        inputOwnership: room.inputOwnership,
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
        inputOwnership: room.inputOwnership,
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
