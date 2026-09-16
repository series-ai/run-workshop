import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from './codec';
import { NEUTRAL_INPUT, TOOL, quantizeRay } from './input';
import { createInitialState } from './presets';
import { stepYard } from './step';

describe('state codec', () => {
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

  it('rejects bytes with a bad magic header', () => {
    expect(() => decodeState(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow('WRECK_YARD_STATE_BYTES_INVALID');
  });
});
