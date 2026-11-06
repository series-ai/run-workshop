import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT } from './input';
import { CHECKPOINT_BUDGET, NATIVE_CHECKPOINT_WINDOW } from './physics';
import { createYardRuntime, yardRoomOptions } from './session';
import { YardSim, type YardSave } from './sim';

interface NativeMemory {
  readonly liveSlots: bigint;
  readonly highWaterSlots: bigint;
  readonly retainedBytes: bigint;
  readonly liveWorlds: bigint;
  readonly imbalance: boolean;
}

// The package does not export this diagnostic. Keep this import in the test.
const diagnosticUrl = pathToFileURL(`${process.cwd()}/node_modules/@series-inc/rundot-syncplay/core/src/physics/world.mjs`).href;
const { nativePhysicsInstanceMemory }: { nativePhysicsInstanceMemory(): NativeMemory } = await import(/* @vite-ignore */ diagnosticUrl);

function expectEmptyNativeMemory(): void {
  const memory = nativePhysicsInstanceMemory();
  expect(memory.liveSlots).toBe(0n);
  expect(memory.liveWorlds).toBe(0n);
  expect(memory.retainedBytes).toBe(0n);
  expect(memory.imbalance).toBe(false);
}

describe('checkpoint storage against the native engine', () => {
  it('keeps 256 native save handles and replays old state without spilling the history', () => {
    const sim = YardSim.create(1);
    const saves: YardSave[] = [];
    try {
      sim.step([NEUTRAL_INPUT]);
      const oldest = sim.save();
      saves.push(oldest);
      const originalState = oldest.state;
      const originalChecksum = sim.checksumBytes(oldest);
      const originalLateJoin = sim.encode(oldest);
      for (let frame = 2; frame <= 256; frame++) {
        sim.step([NEUTRAL_INPUT]);
        const revision = sim.revision;
        saves.push(sim.save());
        expect(sim.revision).toBe(revision);
      }
      expect(saves).toHaveLength(256);
      expect(saves[0]).toBe(oldest);
      expect(oldest.state).toBe(originalState);
      expect(oldest.state.frame).toBe(1);
      expect(oldest.physics.kind).toBe('checkpoint');
      expect(saves.filter((save) => save.physics.kind === 'checkpoint')).toHaveLength(256);
      expect(saves.filter((save) => save.physics.kind === 'bytes')).toHaveLength(0);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(256n);
      expect(sim.checksumBytes(oldest)).toEqual(originalChecksum);
      expect(sim.encode(oldest)).toEqual(originalLateJoin);

      const tail = saves.at(-1)!;
      const expectedChecksum = sim.checksumBytes(tail);
      const expectedLateJoin = sim.encode(tail);
      sim.restore(oldest);
      expect(sim.state).toBe(originalState);
      for (let frame = 2; frame <= 256; frame++) sim.step([NEUTRAL_INPUT]);
      const replay = sim.save();
      saves.push(replay);
      expect(sim.checksumBytes(replay)).toEqual(expectedChecksum);
      expect(sim.encode(replay)).toEqual(expectedLateJoin);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(257n);
    } finally {
      for (const save of saves) sim.release(save);
      sim.dispose();
    }
    expectEmptyNativeMemory();
  });

  it('releases native storage in capture order after a rewind', () => {
    const sim = YardSim.create(1);
    const saves: YardSave[] = [];
    try {
      saves.push(sim.save());
      sim.step([NEUTRAL_INPUT]);
      for (let capture = 1; capture < NATIVE_CHECKPOINT_WINDOW; capture++) {
        saves.push(sim.save());
      }
      const first = saves[0]!;
      const second = saves[1]!;
      const originalChecksum = sim.checksumBytes(first);
      sim.restore(first);
      const revision = sim.revision;
      const rewound = sim.save();
      saves.push(rewound);
      expect(first.physics.kind).toBe('bytes');
      expect(second.physics.kind).toBe('checkpoint');
      expect(rewound.state.frame).toBe(0);
      expect(rewound.physics.kind).toBe('checkpoint');
      expect(sim.revision).toBe(revision);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(BigInt(NATIVE_CHECKPOINT_WINDOW));
      expect(sim.checksumBytes(first)).toEqual(originalChecksum);
      expect(sim.revision).toBe(revision);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(BigInt(NATIVE_CHECKPOINT_WINDOW));
      expect(nativePhysicsInstanceMemory().highWaterSlots)
        .toBeLessThanOrEqual(BigInt(NATIVE_CHECKPOINT_WINDOW + CHECKPOINT_BUDGET.importScratch));
      saves.push(sim.save());
      expect(second.physics.kind).toBe('bytes');
      expect(rewound.physics.kind).toBe('checkpoint');
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(BigInt(NATIVE_CHECKPOINT_WINDOW));
    } finally {
      for (const save of saves) sim.release(save);
      sim.dispose();
    }
    expectEmptyNativeMemory();
  });

  it('keeps the owned runtime batch and rollback contracts for 240 captures', async () => {
    const room = yardRoomOptions(1);
    const lease = createYardRuntime(room.runtimeIdentity, room.sessionConfigBytes);
    const runtime = lease.runtime;
    const checkpoints: unknown[] = [];
    try {
      const initial = runtime.capture();
      checkpoints.push(initial);
      const initialBytes = runtime.serializeCheckpoint(initial);
      const results = runtime.advance(Array.from({ length: 240 }, (_, offset) => ({
        frame: offset + 1, inputs: [NEUTRAL_INPUT], commands: [], checksum: offset === 0 || offset === 239,
      })));
      checkpoints.push(...results.map((result) => result.checkpoint));
      expect(results).toHaveLength(240);
      expect(runtime.currentFrame).toBe(240);
      expect(runtime.serializeCheckpoint(initial)).toEqual(initialBytes);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(241n);
      for (const [index, result] of results.entries()) expect(runtime.inspect(result.checkpoint).frame).toBe(index + 1);
      runtime.restore(initial);
      const replay = runtime.advance([{ frame: 1, inputs: [NEUTRAL_INPUT], commands: [], checksum: true }]);
      checkpoints.push(replay[0]!.checkpoint);
      expect(replay[0]!.checksum).toBe(results[0]!.checksum);
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(242n);
      expect(nativePhysicsInstanceMemory().highWaterSlots)
        .toBeLessThanOrEqual(BigInt(NATIVE_CHECKPOINT_WINDOW + CHECKPOINT_BUDGET.importScratch));
    } finally {
      for (const checkpoint of checkpoints) runtime.release(checkpoint);
      await lease.dispose();
    }
    expectEmptyNativeMemory();
  });

  it('releases native and byte saves once and disposes outstanding native saves', () => {
    const sim = YardSim.create(1);
    try {
      const saves = Array.from({ length: NATIVE_CHECKPOINT_WINDOW + 1 }, () => sim.save());
      const spilled = saves[0]!;
      const native = saves.at(-1)!;
      expect(spilled.physics.kind).toBe('bytes');
      expect(native.physics.kind).toBe('checkpoint');
      sim.release(spilled);
      expect(() => sim.release(spilled)).toThrow('WRECK_YARD_SAVE_RELEASED');
      expect(() => sim.restore(spilled)).toThrow('WRECK_YARD_SAVE_RELEASED');
      sim.release(native);
      expect(() => sim.release(native)).toThrow('WRECK_YARD_SAVE_RELEASED');
      expect(nativePhysicsInstanceMemory().liveSlots).toBe(BigInt(NATIVE_CHECKPOINT_WINDOW - 1));
      sim.dispose();
      sim.dispose();
      expect(() => sim.save()).toThrow('WRECK_YARD_SIM_DISPOSED');
    } finally {
      sim.dispose();
    }
    expectEmptyNativeMemory();
  });
});
