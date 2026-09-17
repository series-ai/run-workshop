import { describe, expect, it } from 'vitest';
import { TANK, TICK_RATE } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { createInitialState } from './presets';
import { physicsStateBodyById, replacePhysicsPose } from './physics';
import type { YardState } from './state';
import { stepYard } from './step';

function run(state: YardState, inputs: readonly YardInput[], frames: number): YardState {
  let next = state;
  for (let i = 0; i < frames; i += 1) next = stepYard(next, inputs);
  return next;
}

function rayAt(target: readonly [number, number, number]): Pick<YardInput, 'ox' | 'oy' | 'oz' | 'dx' | 'dy' | 'dz'> {
  const origin = [target[0], target[1] + 6, target[2] + 0.001] as const;
  return quantizeRay(origin, [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]]);
}

/**
 * Holds the torch while the aim point walks from `from` to `to` in `steps`
 * increments, pumping the simulation each step. Produces the same per-tick
 * swept contact the torch makes when a player drags across a face.
 */
function torchDrag(
  state: YardState,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  steps: number,
): YardState {
  let next = state;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const target = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ] as const;
    const cut: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...rayAt(target) };
    next = run(next, [cut], 4);
  }
  return next;
}

describe('stepYard', () => {
  it('advances the frame and keeps resting bodies near their spawn', () => {
    const state = run(createInitialState(1), [NEUTRAL_INPUT], 60);
    expect(state.frame).toBe(60);
    const steel = physicsStateBodyById(state.world, 'steel-case')!;
    expect(steel.y).toBeGreaterThan(-0.9);
    expect(steel.y).toBeLessThan(0.3);
  });

  it('grabs, lifts, and throws the ballast box', () => {
    let state = run(createInitialState(1), [NEUTRAL_INPUT], 30);
    const before = physicsStateBodyById(state.world, 'ballast-box')!;
    const hold: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...rayAt([before.x, before.y, before.z]) };
    state = stepYard(state, [hold]);
    expect(state.players[0]!.grab?.bodyId).toBe('ballast-box');
    const lift: YardInput = { ...hold, ...rayAt([before.x, before.y + 1.5, before.z]) };
    state = run(state, [lift], 20);
    const lifted = physicsStateBodyById(state.world, 'ballast-box')!;
    expect(lifted.y).toBeGreaterThan(before.y + 0.3);
    state = stepYard(state, [{ ...lift, pressed: false }]);
    expect(state.players[0]!.grab).toBeNull();
    expect(state.stats.throws).toBe(1);
  });

  it('torches the gantry into a fixed stump and a loose piece', () => {
    let state = run(createInitialState(1), [NEUTRAL_INPUT], 5);
    const gantry = physicsStateBodyById(state.world, 'steel-gantry')!;
    const cut: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...rayAt([gantry.x + 0.2, gantry.y + 0.2, gantry.z]) };
    state = run(state, [cut], 12);
    expect(state.stats.torchCuts).toBeGreaterThanOrEqual(1);
    const pieces = state.bodies.filter((b) => b.label === 'Steel Gantry');
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces.some((b) => b.motion === 'fixed' && b.id === 'steel-gantry')).toBe(true);
    expect(pieces.some((b) => b.motion === 'dynamic')).toBe(true);
    for (const piece of pieces) expect(physicsStateBodyById(state.world, piece.id)).toBeDefined();
  });

  it('splits a body with a torch stroke on either axis', () => {
    // The reported bug: a vertical stroke broke a piece off the gantry and the
    // same stroke horizontally did not. Both must separate it now.
    const gantryPieces = (state: YardState) => state.bodies.filter((b) => b.label === 'Steel Gantry');
    const settle = () => run(createInitialState(1), [NEUTRAL_INPUT], 5);
    const gantry = physicsStateBodyById(settle().world, 'steel-gantry')!;

    // Vertical stroke down the gantry's front, spanning past both edges.
    const vertical = torchDrag(
      settle(),
      [gantry.x, gantry.y + 1.3, gantry.z],
      [gantry.x, gantry.y - 1.3, gantry.z],
      16,
    );
    expect(gantryPieces(vertical).length).toBeGreaterThan(1);

    // Horizontal stroke across the same face, spanning past both edges.
    const horizontal = torchDrag(
      settle(),
      [gantry.x - 1.3, gantry.y, gantry.z],
      [gantry.x + 1.3, gantry.y, gantry.z],
      16,
    );
    expect(gantryPieces(horizontal).length).toBeGreaterThan(1);
    expect(gantryPieces(horizontal).some((b) => b.motion === 'fixed')).toBe(true);
    expect(gantryPieces(horizontal).some((b) => b.motion === 'dynamic')).toBe(true);
  });

  it('does not split a body when the torch only grazes it', () => {
    // A held point on a thick body removes surface material but cannot sever it.
    // The cut registers; the body stays whole. This is the behaviour the
    // through cut replaces, and it must not regress into a fabricated split.
    let state = run(createInitialState(1), [NEUTRAL_INPUT], 5);
    const pallet = physicsStateBodyById(state.world, 'timber-pallet')!;
    const graze: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...rayAt([pallet.x, pallet.y, pallet.z]) };
    state = run(state, [graze], 8);
    expect(state.stats.torchCuts).toBeGreaterThanOrEqual(1);
    expect(state.bodies.filter((b) => b.label === 'Timber Pallet').length).toBe(1);
  });

  it('fractures a body that slams into the floor', () => {
    const state = createInitialState(1);
    const fast = { ...state, world: replacePhysicsPose(state.world, 'ballast-box', { y: 3.5, vy: -9 / TICK_RATE }) };
    const after = run(fast, [NEUTRAL_INPUT], 40);
    expect(after.stats.fractures).toBeGreaterThanOrEqual(1);
    expect(after.bodies.filter((b) => b.label === 'Ballast Box').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps the float crate at the water surface', () => {
    const state = run(createInitialState(1), [NEUTRAL_INPUT], 240);
    const crate = physicsStateBodyById(state.world, 'float-crate')!;
    expect(crate.y).toBeGreaterThan(TANK.bottomY + 0.2);
    expect(crate.y).toBeLessThan(TANK.surfaceY + 0.4);
  });

  it('resets buoyancy force and falls under gravity when lifted out of the water', () => {
    // Submerge and settle the float crate in water, then pull it out into the air.
    // Previously, buoyancy forces persisted because setBodyForce was skipped when
    // submerged <= 0, causing the object to float in mid-air.
    let state = run(createInitialState(1), [NEUTRAL_INPUT], 30);
    const inAir = replacePhysicsPose(state.world, 'float-crate', { y: 2.5, vy: 0 });
    state = run({ ...state, world: inAir }, [NEUTRAL_INPUT], 20);
    const crate = physicsStateBodyById(state.world, 'float-crate')!;
    expect(crate.vy).toBeLessThan(-0.05);
    expect(crate.y).toBeLessThan(2.4);
  });

  it('never mutates the previous state', () => {
    const state = createInitialState(1);
    const frozenBodies = state.bodies;
    const frozenWorld = state.world;
    stepYard(state, [NEUTRAL_INPUT]);
    expect(state.frame).toBe(0);
    expect(state.bodies).toBe(frozenBodies);
    expect(state.world).toBe(frozenWorld);
  });
});
