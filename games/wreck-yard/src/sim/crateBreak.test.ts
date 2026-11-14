import { describe, expect, it } from 'vitest';
import { FLOOR_Y, TICK_RATE } from './constants';
import { breakCrate, CRATE_BREAK, isBreakableCrate } from './crateBreak';
import { NEUTRAL_INPUT } from './input';
import { IDENTITY_QUAT } from './math';
import { physicsStateBodyById, replacePhysicsPose, setPhysicsBodyVelocity, voxelStats } from './physics';
import type { YardSim } from './sim';
import type { YardBody, YardState } from './state';
import { createCrateSpawns } from './storage';
import { testSim } from './testSim';

const crate = (): YardBody => createCrateSpawns('storage')[0]!.body;
const pose = { position: [0, 1, 0] as const, rotation: IDENTITY_QUAT, linearVelocity: [0, -0.3, 0] as const, angularVelocity: [0, 0, 0] as const };

function runTicks(sim: YardSim, ticks: number): YardState {
  let state = sim.state;
  for (let tick = 0; tick < ticks; tick += 1) state = sim.step([NEUTRAL_INPUT]);
  return state;
}

/** Drops the first returns crate from `height` (m) above the open floor at the yard centre. */
function dropCrate(sim: YardSim, height: number): string {
  const id = sim.state.bodies.find((body) => body.storageBay === 'returns' && isBreakableCrate(body))!.id;
  const speed = Math.sqrt(2 * 9.81 * height);
  sim.edit((physics) => replacePhysicsPose(physics, id, { x: 4, y: FLOOR_Y + 0.6, z: 8, vx: 0, vy: -speed / TICK_RATE, vz: 0 }));
  return id;
}

describe('fragile crate break', () => {
  it('splits a whole crate into four pieces that keep every voxel, the faces, the bay, and the material', () => {
    const source = crate();
    const result = breakCrate(source, pose, [3, 6, 9], 7, 40);
    expect(result.fragments).toHaveLength(4);
    expect(result.nextSerial).toBe(11);
    expect(result.fragments.reduce((sum, piece) => sum + voxelStats(piece.body.voxels).occupiedCount, 0)).toBe(source.voxels.length);
    for (const { body } of result.fragments) {
      expect(body).toMatchObject({ material: 'wood', storageBay: source.storageBay, crateFaces: source.crateFaces, motion: 'dynamic' });
      expect(body.renderModel).toBeUndefined();
      expect(body.dims.x).toBeGreaterThanOrEqual(CRATE_BREAK.minPieceVoxels);
      expect(body.dims.z).toBeGreaterThanOrEqual(CRATE_BREAK.minPieceVoxels);
      // A piece never breaks again, so one crate adds at most three bodies.
      expect(isBreakableCrate(body)).toBe(false);
    }
    expect(new Set(result.fragments.map((piece) => piece.body.id)).size).toBe(4);
  });

  it('refuses a body that is not a whole crate', () => {
    const piece = breakCrate(crate(), pose, [6, 6, 6], 0, 0).fragments[0]!.body;
    expect(() => breakCrate(piece, pose, [1, 1, 1], 0, 0)).toThrow('WRECK_YARD_CRATE_NOT_BREAKABLE');
  });

  it('breaks a crate that falls 5 m onto the floor, and counts it as a break', () => {
    const sim = testSim(1);
    const id = dropCrate(sim, 5);
    const early = runTicks(sim, 5);
    expect(early.contraptions.crateBreaks.map((entry) => entry.crateId)).toEqual([id]);
    const state = runTicks(sim, 10);
    expect(physicsStateBodyById(state.world, id)).toBeUndefined();
    expect(state.bodies.filter((body) => body.id.startsWith(`${id}-p`))).toHaveLength(4);
    expect(state.stats.fractures).toBe(1);
    // The break stays in the state for a few ticks, for the sound and the splinters.
    expect(state.contraptions.crateBreaks).toEqual([]);
  });

  it('keeps a crate whole after a 1 m fall', () => {
    const sim = testSim(1);
    const id = dropCrate(sim, 1);
    const state = runTicks(sim, 15);
    expect(physicsStateBodyById(state.world, id)).toBeDefined();
    expect(state.stats.fractures).toBe(0);
  });

  it('breaks at most CRATE_BREAK.maxPerTick crates in one tick when the whole stack is shoved hard', () => {
    const sim = testSim(1);
    runTicks(sim, 5);
    const bottom = sim.state.bodies.filter((body) => body.storageBay === 'storage').slice(0, 40).map((body) => body.id);
    sim.edit((physics) => { for (const id of bottom) setPhysicsBodyVelocity(physics, id, [0, 0, 12 / TICK_RATE]); });
    let before = sim.state.stats.fractures;
    let most = 0;
    for (let tick = 0; tick < 120; tick++) {
      const state = sim.step([NEUTRAL_INPUT]);
      most = Math.max(most, state.stats.fractures - before);
      before = state.stats.fractures;
    }
    expect(sim.state.stats.fractures).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(CRATE_BREAK.maxPerTick);
  });
});
