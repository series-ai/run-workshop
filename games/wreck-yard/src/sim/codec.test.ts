import { describe, expect, it } from 'vitest';
import { decodeState, decodeVoxelRuns, encodeVoxelRuns } from './codec';
import { NEUTRAL_INPUT, TOOL, quantizeRay } from './input';
import { YardSim } from './sim';
import { patchPlayer, testSim } from './testSim';

/** The bytes of the sim's current state and world. */
function encodeLive(sim: YardSim): Uint8Array {
  const save = sim.save();
  try {
    return sim.encode(save);
  } finally {
    sim.release(save);
  }
}

describe('voxel runs', () => {
  it('round trips empty, uniform, mixed, and long runs', () => {
    const cases = [
      new Uint8Array(0),
      new Uint8Array(5).fill(7),
      Uint8Array.from([0, 1, 1, 2, 0, 0, 0, 255]),
      new Uint8Array(70_000).fill(3),
    ];
    for (const voxels of cases) expect(decodeVoxelRuns(encodeVoxelRuns(voxels), voxels.length)).toEqual(voxels);
    expect(encodeVoxelRuns(new Uint8Array(200).fill(9))).toEqual(Uint8Array.from([9, 0xc8, 0x01]));
  });

  it('rejects runs that do not fill the grid exactly', () => {
    expect(() => decodeVoxelRuns(Uint8Array.from([1, 4]), 5)).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
    expect(() => decodeVoxelRuns(Uint8Array.from([1, 6]), 5)).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
    expect(() => decodeVoxelRuns(Uint8Array.from([1, 0x80]), 5)).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
  });
});

describe('state codec', () => {
  it('keeps the full yard state small enough to checksum every tick and send to late joiners', () => {
    const sim = testSim(4);
    const save = sim.save();
    expect(sim.encode(save).byteLength).toBeLessThan(400_000);
    sim.release(save);
  });

  it('round trips the initial state byte for byte', () => {
    const sim = testSim(2);
    const save = sim.save();
    const state = save.state;
    const bytes = sim.encode(save);
    const decoded = YardSim.decode(bytes);
    expect(decoded.state.frame).toBe(0);
    expect(decoded.state.bodies.map((b) => b.id)).toEqual(state.bodies.map((b) => b.id));
    expect(decoded.state.bodies[0]!.voxels).toBeInstanceOf(Uint8Array);
    expect(sim.encode(decoded)).toEqual(bytes);
    sim.release(save);
  });

  it('round trips a state after cuts and grabs', () => {
    const sim = testSim(2);
    const torch = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay([2.4, 4, 0.551], [0, -1, 0]) };
    for (let i = 0; i < 12; i += 1) sim.step([torch, NEUTRAL_INPUT]);
    const save = sim.save();
    const bytes = sim.encode(save);
    expect(sim.encode(YardSim.decode(bytes))).toEqual(bytes);
    expect(YardSim.decode(bytes).state.players[0]!.torch?.bodyId).toBe(sim.state.players[0]!.torch?.bodyId);
    sim.release(save);
  });

  it('replays 120 driving ticks after checkpoint restore with identical wheel and physics state', () => {
    const sim = testSim(1);
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL_INPUT]);
    const car = sim.state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    patchPlayer(sim, { x: car.x + 1.2, y: car.y + .5, z: car.z });
    sim.step([{ ...NEUTRAL_INPUT, secondary: true }]);
    expect(sim.state.players[0]!.ridingVehicle).toBe(true);
    for (let i = 0; i < 15; i++) sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }]);
    const save = sim.save();
    const checkpoint = sim.encode(save);
    sim.release(save);
    const restored = testSim(1);
    restored.restore(YardSim.decode(checkpoint));
    expect(restored.state.buggyWheels).toEqual(sim.state.buggyWheels);
    for (let i = 0; i < 120; i++) {
      const input = { ...NEUTRAL_INPUT, moveZ: i < 90 ? 1 : 0, moveX: i > 65 && i < 85 ? .2 : 0 };
      sim.step([input]);
      restored.step([input]);
    }
    expect(sim.state.buggyWheels?.some((w) => Math.abs(w.spinTurns) > 1)).toBe(true);
    expect(encodeLive(restored)).toEqual(encodeLive(sim));
  });

  it('rejects bytes with a bad magic header', () => {
    expect(() => decodeState(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
  });
});
