import { describe, expect, it } from 'vitest';
import { TANK, TICK_RATE } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { physicsStateBodyById, replacePhysicsPose, setPhysicsBodyVelocity } from './physics';
import type { YardSim } from './sim';
import type { YardState } from './state';
import { testSim } from './testSim';

function run(sim: YardSim, inputs: readonly YardInput[], frames: number): YardState {
  for (let i = 0; i < frames; i += 1) sim.step(inputs);
  return sim.state;
}

function rayAt(target: readonly [number, number, number]): Pick<YardInput, 'ox' | 'oy' | 'oz' | 'dx' | 'dy' | 'dz'> {
  const origin = [target[0], target[1] + 6, target[2] + 0.001] as const;
  return quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]);
}

/** Torch aim from 2 m above the target, inside TORCH_RANGE. */
function torchAt(target: readonly [number, number, number]): Pick<YardInput, 'ox' | 'oy' | 'oz' | 'dx' | 'dy' | 'dz'> {
  const origin = [target[0], target[1] + 2, target[2] + 0.001] as const;
  return quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]);
}

/**
 * Holds the torch while the aim point walks from `from` to `to` in `steps`
 * increments, pumping the simulation each step. Produces the same per-tick
 * swept contact the torch makes when a player drags across a face.
 */
function torchDrag(
  sim: YardSim,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  steps: number,
): YardState {
  let next = sim.state;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const target = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ] as const;
    const cut: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay([target[0], target[1], target[2] + 2], [0, 0, -1]) };
    next = run(sim, [cut], 4);
  }
  return next;
}

describe('stepYard', () => {
  it('advances the frame and keeps resting bodies near their spawn', () => {
    const state = run(testSim(1), [NEUTRAL_INPUT], 60);
    expect(state.frame).toBe(60);
    const steel = physicsStateBodyById(state.world, 'steel-case')!;
    expect(steel.y).toBeGreaterThan(-0.9);
    expect(steel.y).toBeLessThan(0.3);
  });

  it('keeps the full idle scene above the floor without impact damage', () => {
    const sim = testSim(1);
    const initial = sim.state;
    const state = run(sim, [NEUTRAL_INPUT], 120);
    expect(state.stats.fractures).toBe(0);
    expect(state.bodies.length).toBe(initial.bodies.length);
    for (const body of state.world.bodies) {
      if (body.kind === 'dynamic') expect(body.y, body.id).toBeGreaterThan(-.86);
    }
  });

  it('grabs, lifts, and throws the ballast box', () => {
    const sim = testSim(1);
    let state = run(sim, [NEUTRAL_INPUT], 30);
    const before = physicsStateBodyById(state.world, 'ballast-box')!;
    const hold: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([before.x, before.y, before.z]) };
    state = sim.step([hold]);
    expect(state.players[0]!.grab?.bodyId).toBe('ballast-box');
    const lift: YardInput = { ...hold, ...rayAt([before.x, before.y + 1.5, before.z]) };
    state = run(sim, [lift], 20);
    const lifted = physicsStateBodyById(state.world, 'ballast-box')!;
    expect(lifted.y).toBeGreaterThan(before.y + 0.3);
    state = sim.step([{ ...lift, pressed: false }]);
    expect(state.players[0]!.grab).toBeNull();
    expect(state.stats.throws).toBe(1);
  });

  it.each(['ground', 'airborne'] as const)('drops a moving held body without the desktop release boost (%s)', (location) => {
    const sim = testSim(1);
    const state = run(sim, [NEUTRAL_INPUT], 30);
    const body = physicsStateBodyById(state.world, 'ballast-box')!;
    let hold = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([body.x, body.y, body.z]) };
    sim.step([hold]);
    if (location === 'airborne') {
      hold = { ...hold, ...rayAt([body.x, body.y + 2, body.z]) };
      const lifted = run(sim, [hold], 45);
      expect(lifted.players[0]!.grab?.bodyId).toBe('ballast-box');
      expect(physicsStateBodyById(lifted.world, 'ballast-box')!.y).toBeGreaterThan(body.y + 1);
    }
    sim.edit((physics) => setPhysicsBodyVelocity(physics, 'ballast-box', [0.1, 0.02, 0]));
    const save = sim.save();
    try {
      const released = sim.step([{ ...hold, pressed: false }]);
      const boosted = physicsStateBodyById(released.world, 'ballast-box')!;
      sim.restore(save);
      const dropped = sim.step([{ ...hold, pressed: false, drop: true }]);
      expect(dropped.players[0]!.grab).toBeNull();
      const unboosted = physicsStateBodyById(dropped.world, 'ballast-box')!;
      const contact = sim.physics.world.latest().contacts.some((entry) => entry.type !== 'exit'
        && [entry.bodyKeyA, entry.bodyKeyB].includes('ballast-box'));
      expect(contact).toBe(location === 'ground');
      sim.restore({ ...save, state: { ...save.state, players: save.state.players.map((p) => ({ ...p, grab: null })) } });
      const free = sim.step([NEUTRAL_INPUT]);
      expect(unboosted).toEqual(physicsStateBodyById(free.world, 'ballast-box'));
      // A ground contact can stop both bodies. Compare the boost in free flight.
      if (location === 'airborne') expect(Math.abs(boosted.vx)).toBeGreaterThan(Math.abs(unboosted.vx));
      expect(unboosted.vx).toBeLessThanOrEqual(0.1);
    } finally { sim.release(save); }
  });

  // Offsets keep the path clear: the fixed gantry spans the space above the tank.
  it.each([
    ['ballast-box', 0],
    ['float-crate', 3.5],
  ] as const)('lifts %s to the hold point without a launch or overshoot', (id, dx) => {
    const sim = testSim(1);
    let state = run(sim, [NEUTRAL_INPUT], 30);
    const rest = physicsStateBodyById(state.world, id)!;
    const grab: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([rest.x, rest.y, rest.z]) };
    state = sim.step([grab]);
    const hold: YardInput = { ...grab, ...rayAt([rest.x + dx, rest.y + 1.5, rest.z]) };
    let peak = -Infinity;
    let fastest = 0;
    for (let i = 0; i < 45; i += 1) {
      state = sim.step([hold]);
      const body = physicsStateBodyById(state.world, id)!;
      peak = Math.max(peak, body.y);
      fastest = Math.max(fastest, Math.hypot(body.vx, body.vy, body.vz) * TICK_RATE);
    }
    expect(state.players[0]!.grab?.bodyId).toBe(id);
    expect(state.stats.fractures).toBe(0);
    const target = state.players[0]!.grab!.target[1];
    const settled = physicsStateBodyById(state.world, id)!.y;
    expect(Math.abs(settled - target)).toBeLessThan(0.1);
    expect(peak - settled).toBeLessThan(0.08);
    // m/s: a carried body moves no faster than a hard throw.
    expect(fastest).toBeLessThan(6.4);
  });

  it('drops a still-held box on release and lands it without a bounce', () => {
    const sim = testSim(1);
    let state = run(sim, [NEUTRAL_INPUT], 30);
    const rest = physicsStateBodyById(state.world, 'ballast-box')!;
    const grab: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([rest.x, rest.y, rest.z]) };
    state = sim.step([grab]);
    const hold: YardInput = { ...grab, ...rayAt([rest.x, rest.y + 2, rest.z]) };
    state = run(sim, [hold], 60);
    const held = physicsStateBodyById(state.world, 'ballast-box')!;
    let peak = -Infinity;
    let landed = false;
    let rebound = 0;
    for (let i = 0; i < 60; i += 1) {
      state = sim.step([{ ...hold, pressed: false }]);
      const box = physicsStateBodyById(state.world, 'ballast-box')!;
      peak = Math.max(peak, box.y);
      if (box.y < rest.y + 0.1) landed = true;
      if (landed) rebound = Math.max(rebound, box.vy * TICK_RATE);
    }
    expect(peak).toBeLessThanOrEqual(held.y + 0.005);
    expect(landed).toBe(true);
    expect(rebound).toBeLessThan(1);
  });

  it('torches the gantry into a fixed stump and a loose piece', () => {
    const sim = testSim(1);
    let state = run(sim, [NEUTRAL_INPUT], 5);
    const gantry = physicsStateBodyById(state.world, 'steel-gantry')!;
    const cut: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...torchAt([gantry.x - 0.72, gantry.y + 0.36, gantry.z]) };
    state = run(sim, [cut], 12);
    expect(state.stats.torchCuts).toBeGreaterThanOrEqual(1);
    const pieces = state.bodies.filter((b) => b.label === 'Steel Gantry');
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces.some((b) => b.motion === 'fixed' && b.id === 'steel-gantry')).toBe(true);
    expect(pieces.some((b) => b.motion === 'dynamic')).toBe(true);
    for (const piece of pieces) expect(physicsStateBodyById(state.world, piece.id)).toBeDefined();
  });

  it('splits a body with a torch stroke on either axis', () => {
    // Cut across the thin connector on each axis. Both strokes must detach it.
    const gantryPieces = (state: YardState) => state.bodies.filter((b) => b.label === 'Steel Gantry');
    const settle = (): YardSim => {
      const sim = testSim(1);
      run(sim, [NEUTRAL_INPUT], 5);
      return sim;
    };
    const gantry = physicsStateBodyById(settle().state.world, 'steel-gantry')!;

    // Use sub-cell samples across the connector on the front face.
    const vertical = torchDrag(
      settle(),
      [gantry.x - 0.72, gantry.y + 0.6, gantry.z],
      [gantry.x - 0.72, gantry.y + 0.1, gantry.z],
      16,
    );
    expect(gantryPieces(vertical).length).toBeGreaterThan(1);

    // Cross the same connector on the horizontal axis.
    const horizontal = torchDrag(
      settle(),
      [gantry.x - 1, gantry.y + 0.36, gantry.z],
      [gantry.x - 0.4, gantry.y + 0.36, gantry.z],
      16,
    );
    expect(gantryPieces(horizontal).length).toBeGreaterThan(1);
    expect(gantryPieces(horizontal).some((b) => b.motion === 'fixed')).toBe(true);
    expect(gantryPieces(horizontal).some((b) => b.motion === 'dynamic')).toBe(true);
  });

  it('does not split a body when the torch only grazes it', () => {
    // A held point on a thick body removes surface material but cannot sever it.
    // The cut registers. The remaining material must keep the body connected.
    const sim = testSim(1);
    let state = run(sim, [NEUTRAL_INPUT], 5);
    const pallet = physicsStateBodyById(state.world, 'timber-pallet')!;
    const graze: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...torchAt([pallet.x, pallet.y, pallet.z]) };
    state = run(sim, [graze], 8);
    expect(state.stats.torchCuts).toBeGreaterThanOrEqual(1);
    expect(state.bodies.filter((b) => b.label === 'Timber Pallet').length).toBe(1);
  });

  it('does not chip a body that slams into the floor or a wall', () => {
    // Only the torch and blasts change voxel shapes; a hit moves the body and nothing else.
    const sim = testSim(1);
    const before = sim.state;
    sim.edit((physics) => {
      replacePhysicsPose(physics, 'ballast-box', { x: -6, z: 3, y: 3.5, vy: -14 / TICK_RATE });
      replacePhysicsPose(physics, 'timber-pallet', { vx: 16 / TICK_RATE, vy: 2 / TICK_RATE });
    });
    const after = run(sim, [NEUTRAL_INPUT], 60);
    expect(after.stats.fractures).toBe(0);
    expect(after.bodies.map((body) => body.id)).toEqual(before.bodies.map((body) => body.id));
    for (const id of ['ballast-box', 'timber-pallet']) {
      expect(after.bodies.find((body) => body.id === id)!.voxels, id).toEqual(before.bodies.find((body) => body.id === id)!.voxels);
    }
  });

  it('keeps the float crate at the water surface', () => {
    const state = run(testSim(1), [NEUTRAL_INPUT], 240);
    const crate = physicsStateBodyById(state.world, 'float-crate')!;
    expect(crate.y).toBeGreaterThan(TANK.bottomY + 0.2);
    expect(crate.y).toBeLessThan(TANK.surfaceY + 0.4);
  });

  it('resets buoyancy force and falls under gravity when lifted out of the water', () => {
    // Submerge and settle the float crate in water, then pull it out into the air.
    // Previously, buoyancy forces persisted because setBodyForce was skipped when
    // submerged <= 0, causing the object to float in mid-air.
    const sim = testSim(1);
    run(sim, [NEUTRAL_INPUT], 30);
    sim.edit((physics) => replacePhysicsPose(physics, 'float-crate', { y: 2.5, vy: 0 }));
    const state = run(sim, [NEUTRAL_INPUT], 20);
    const crate = physicsStateBodyById(state.world, 'float-crate')!;
    expect(crate.vy).toBeLessThan(-0.05);
    expect(crate.y).toBeLessThan(2.4);
  });

  it('never mutates the previous state', () => {
    const sim = testSim(1);
    const state = sim.state;
    const frozenBodies = state.bodies;
    const frozenWorld = state.world;
    sim.step([NEUTRAL_INPUT]);
    expect(state.frame).toBe(0);
    expect(state.bodies).toBe(frozenBodies);
    expect(state.world).toBe(frozenWorld);
  });
});
