import { describe, expect, it } from 'vitest';
import { BURNT_MATERIAL, FLOOR_Y, HEAT, SCORCH_MATERIAL, TICK_RATE } from './constants';
import { coolVoxels } from './heat';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { halfExtents, physicsStateBodyById, replacePhysicsPose } from './physics';
import type { YardBody } from './state';
import { testSim } from './testSim';

const count = (voxels: Uint8Array, code: number) => voxels.reduce((sum, value) => sum + (value === code ? 1 : 0), 0);
const occupied = (voxels: Uint8Array) => voxels.reduce((sum, value) => sum + (value !== 0 ? 1 : 0), 0);

describe('coolVoxels', () => {
  it('turns hot voxels into burnt ones and keeps every other voxel', () => {
    expect(coolVoxels(Uint8Array.from([0, SCORCH_MATERIAL, 16, SCORCH_MATERIAL, 27]))).toEqual(Uint8Array.from([0, BURNT_MATERIAL, 16, BURNT_MATERIAL, 27]));
  });
});

describe('torch heat', () => {
  it('leaves the cut hot, then the hot voxels cool to burnt without a change of shape', () => {
    const sim = testSim(1);
    for (let i = 0; i < 5; i += 1) sim.step([NEUTRAL_INPUT]);
    const gantry = physicsStateBodyById(sim.state.world, 'steel-gantry')!;
    const target = [gantry.x - 0.72, gantry.y + 0.36, gantry.z] as const;
    const origin = [target[0], target[1] + 2, target[2] + 0.001] as const;
    const cut: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]) };
    for (let i = 0; i < 12; i += 1) sim.step([cut]);
    const lastCut = sim.state.frame;
    const pieces = (): YardBody[] => sim.state.bodies.filter((body) => body.label === 'Steel Gantry');
    expect(pieces().length).toBeGreaterThanOrEqual(2);
    const hot = pieces().filter((body) => body.heat !== null);
    expect(hot.length).toBeGreaterThanOrEqual(1);
    for (const body of hot) {
      expect(body.heat!.frame).toBeGreaterThan(lastCut - 12);
      expect(count(body.voxels, SCORCH_MATERIAL), body.id).toBeGreaterThan(0);
    }
    const shapes = new Map(pieces().map((body) => [body.id, occupied(body.voxels)]));

    // Still hot just before the cooling time ends.
    const coolTicks = Math.round(HEAT.burntSeconds * TICK_RATE);
    for (let i = 0; i < coolTicks - 13; i += 1) sim.step([NEUTRAL_INPUT]);
    expect(pieces().some((body) => count(body.voxels, SCORCH_MATERIAL) > 0)).toBe(true);
    for (let i = 0; i < 14; i += 1) sim.step([NEUTRAL_INPUT]);
    for (const body of pieces()) {
      expect(body.heat, body.id).toBeNull();
      expect(count(body.voxels, SCORCH_MATERIAL), body.id).toBe(0);
      expect(occupied(body.voxels), body.id).toBe(shapes.get(body.id));
    }
    expect(pieces().some((body) => count(body.voxels, BURNT_MATERIAL) > 0)).toBe(true);
  });

  it('stays hot while the flame plays on the floor right beside it (a torch through a hole)', () => {
    const sim = testSim(1);
    const half = halfExtents(sim.state.bodies.find((body) => body.id === 'timber-pallet')!.dims);
    // Open floor east of the player spawns, clear of props.
    sim.edit((physics) => replacePhysicsPose(physics, 'timber-pallet', { x: 6, y: FLOOR_Y + half[1] + 0.05, z: 11, vx: 0, vy: 0, vz: 0 }));
    for (let i = 0; i < 30; i += 1) sim.step([NEUTRAL_INPUT]);
    const pallet = physicsStateBodyById(sim.state.world, 'timber-pallet')!;
    const torchAt = (target: readonly [number, number, number]): YardInput => {
      const origin = [target[0], target[1] + 1.2, target[2] + 0.001] as const;
      return { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]) };
    };
    // Heat the top face near the +x edge, then play the flame on the floor just past that edge.
    for (let i = 0; i < 6; i += 1) sim.step([torchAt([pallet.x + half[0] - 0.1, pallet.y + half[1], pallet.z])]);
    const hot = () => sim.state.bodies.filter((body) => body.label === 'Timber Pallet' && body.heat !== null);
    expect(hot().length).toBeGreaterThan(0);
    const beside = torchAt([pallet.x + half[0] + 0.1, FLOOR_Y, pallet.z]);
    for (let i = 0; i < 60; i += 1) sim.step([beside]);
    expect(sim.state.players[0]!.feedback?.result).toBe('scorch');
    expect(Math.max(...hot().map((body) => body.heat!.frame))).toBeGreaterThanOrEqual(sim.state.frame - 1);
  });
});
