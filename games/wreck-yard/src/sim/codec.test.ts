import { describe, expect, it } from 'vitest';
import { decodeState, decodeVoxelRuns, encodeState, encodeVoxelRuns } from './codec';
import { NEUTRAL_INPUT, TOOL, quantizeRay } from './input';
import { createInitialState } from './presets';
import { stepYard } from './step';

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
    expect(encodeState(createInitialState(4)).byteLength).toBeLessThan(400_000);
  });

  it('round trips the initial state byte for byte', () => {
    const state = createInitialState(2);
    const bytes = encodeState(state);
    const decoded = decodeState(bytes);
    expect(decoded.frame).toBe(0);
    expect(decoded.bodies.map((b) => b.id)).toEqual(state.bodies.map((b) => b.id));
    expect(decoded.bodies[0]!.voxels).toBeInstanceOf(Uint8Array);
    expect(encodeState(decoded)).toEqual(bytes);
  });

  it('round trips a state after cuts and grabs', () => {
    let state = createInitialState(2);
    const torch = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay([2.4, 8, 0.551], [0, -1, 0]) };
    for (let i = 0; i < 12; i += 1) state = stepYard(state, [torch, NEUTRAL_INPUT]);
    const bytes = encodeState(state);
    expect(encodeState(decodeState(bytes))).toEqual(bytes);
    expect(decodeState(bytes).players[0]!.torch?.bodyId).toBe(state.players[0]!.torch?.bodyId);
  });

  it('replays 120 driving ticks after checkpoint restore with identical wheel and physics state', () => {
    let state = createInitialState(1);
    for (let i = 0; i < 20; i++) state = stepYard(state, [NEUTRAL_INPUT]);
    const car = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    state = { ...state, players: [{ ...state.players[0]!, x: car.x + 1.2, y: car.y + .5, z: car.z }] };
    state = stepYard(state, [{ ...NEUTRAL_INPUT, secondary: true }]);
    expect(state.players[0]!.ridingVehicle).toBe(true);
    for (let i = 0; i < 15; i++) state = stepYard(state, [{ ...NEUTRAL_INPUT, moveZ: 1 }]);
    const checkpoint = encodeState(state);
    let restored = decodeState(checkpoint);
    expect(restored.buggyWheels).toEqual(state.buggyWheels);
    for (let i = 0; i < 120; i++) {
      const input = { ...NEUTRAL_INPUT, moveZ: i < 90 ? 1 : 0, moveX: i > 65 && i < 85 ? .2 : 0 };
      state = stepYard(state, [input]);
      restored = stepYard(restored, [input]);
    }
    expect(state.buggyWheels?.some((w) => Math.abs(w.spinTurns) > 1)).toBe(true);
    expect(encodeState(restored)).toEqual(encodeState(state));
  });

  it('rejects bytes with a bad magic header', () => {
    expect(() => decodeState(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
  });
});
