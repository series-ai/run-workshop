import { CAGE_PANELS } from './cage';
import { SHELL_BOXES } from './shell';
import { describe, expect, it } from 'vitest';
import { makeEmptyVoxelField, stampBox } from 'voxel-kit';
import { VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { bodyMass, cookCenteredCollider, makePhysicsBody, physicsBodyById, readWorldState, removePhysicsBody, voxelStats } from './physics';
import type { YardBody } from './state';
import { YardSim } from './sim';
import { initialState, testSim } from './testSim';

describe('cookCenteredCollider', () => {
  it('centers a solid 2x1x1 volume on the body origin', () => {
    const dims = { x: 2, y: 1, z: 1 };
    const voxels = new Uint8Array([1, 1]);
    const shape = cookCenteredCollider(voxels, dims);
    expect(shape.children).toHaveLength(1);
    expect(shape.children[0]!.offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(shape.children[0]!.shape).toEqual({ type: 'box', halfX: VOXEL_SIZE, halfY: VOXEL_SIZE * 0.5, halfZ: VOXEL_SIZE * 0.5 });
  });
});

describe('voxelStats and bodyMass', () => {
  it('counts occupied voxels once and caches by array identity', () => {
    const dims = { x: 4, y: 4, z: 4 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 3);
    const a = voxelStats(voxels, dims);
    expect(a.occupiedCount).toBe(8);
    expect(voxelStats(voxels, dims)).toBe(a);
    const body: YardBody = { id: 'b', label: 'b', material: 'steel', dims, voxels, motion: 'dynamic', buoyancy: 0, anchorFaces: [], impactCooldownUntil: 0, heat: null };
    expect(bodyMass(body)).toBeCloseTo(8 * VOXEL_SIZE ** 3 * 1.5, 9);
  });
});

describe('createInitialYard', () => {
  it('spawns playground bodies, a physics body per yard body, and the shell', () => {
    const state = initialState(2);
    expect(state.bodies.length).toBeGreaterThanOrEqual(5);
    expect(state.players).toHaveLength(2);
    for (const body of state.bodies) {
      const physics = state.world.bodies.find((p) => p.id === body.id);
      expect(physics?.kind).toBe(body.motion === 'fixed' ? 'static' : 'dynamic');
    }
    expect(state.world.bodies.filter((b) => b.id.startsWith('shell:'))).toHaveLength(SHELL_BOXES.length + CAGE_PANELS.length);
    expect(state.world.bodies.some((b) => b.id === 'shell:floor')).toBe(true);
  });

  it('makes a static physics body without orientation', () => {
    const body: YardBody = { id: 'g', label: 'g', material: 'wood', dims: { x: 1, y: 1, z: 1 }, voxels: new Uint8Array([2]), motion: 'fixed', buoyancy: 0, anchorFaces: ['-x'], impactCooldownUntil: 0, heat: null };
    const physics = makePhysicsBody(body, { position: [1, 2, 3], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
    expect(physics.body.kind).toBe('static');
    expect(physics.body.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });
});

describe('readWorldState', () => {
  it('matches a per-body motion read for every body, moving, sleeping, static, and after a removal', () => {
    const sim = testSim(2);
    for (let i = 0; i < 40; i += 1) sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }, NEUTRAL_INPUT]);
    const scrap = sim.state.bodies.find((body) => body.id.startsWith('scrap-'))!;
    sim.edit((physics) => removePhysicsBody(physics, scrap.id));
    sim.step([NEUTRAL_INPUT, NEUTRAL_INPUT]);
    const state = readWorldState(sim.physics);
    expect(state.bodies.map((body) => body.id)).toEqual([...sim.physics.bodyIds.keys()].sort());
    expect(new Set(state.bodies.map((body) => body.kind))).toEqual(new Set(['static', 'dynamic', 'kinematic']));
    for (const body of state.bodies) {
      // The SDK gives counters in the batch output, separate from readMotion.
      const { teleportCounter, ...motion } = body;
      expect(Number.isInteger(teleportCounter), body.id).toBe(true);
      expect(teleportCounter, body.id).toBeGreaterThanOrEqual(0);
      expect(motion, body.id).toEqual(physicsBodyById(sim.physics, body.id));
    }
  });
});

describe('body keys', () => {
  const unkeyed = (sim: YardSim) => [...sim.physics.bodyIds].filter(([name, id]) => sim.physics.world.resolveKey(name)?.id !== id).map(([name]) => name);

  it('gives every body its yard name as its Syncplay key, after a torch cut, and after a checkpoint round trip', () => {
    const sim = testSim(1);
    expect(unkeyed(sim)).toEqual([]);
    for (let i = 0; i < 5; i += 1) sim.step([NEUTRAL_INPUT]);
    const gantry = physicsBodyById(sim.physics, 'steel-gantry')!;
    const target = [gantry.x - 0.72, gantry.y + 0.36, gantry.z] as const;
    const origin = [target[0], target[1] + 2, target[2] + 0.001] as const;
    const cut = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]) };
    for (let i = 0; i < 12; i += 1) sim.step([cut]);
    expect(sim.state.bodies.filter((body) => body.label === 'Steel Gantry').length).toBeGreaterThan(1);
    expect(unkeyed(sim)).toEqual([]);
    const save = sim.save();
    const bytes = sim.encode(save);
    sim.release(save);
    const restored = testSim(1);
    restored.restore(YardSim.decode(bytes));
    expect(unkeyed(restored)).toEqual([]);
  });
});
