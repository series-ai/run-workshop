import { describe, expect, it } from 'vitest';
import { FLOOR_Y, PLAYER_RADIUS, SCORCH_MATERIAL, TICK_RATE } from './constants';
import { BUTTONS } from './contraptions';
import { BLAST, blastDirection, blastFalloff, damageDrum, EXPLOSION_SHOW_TICKS, FUEL_DRUM, hitDamage } from './fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { physicsStateBodyById, replacePhysicsPose } from './physics';
import type { YardSim } from './sim';
import type { FuelDrumState, YardState } from './state';
import { patchPlayer, patchState, testSim } from './testSim';

const voxelCount = (state: YardState, id: string) => state.bodies.find((body) => body.id === id)!.voxels.reduce((sum, value) => sum + (value !== 0 ? 1 : 0), 0);
const drumState = (sim: YardSim, id: string): FuelDrumState | undefined => sim.state.contraptions.drums.find((drum) => drum.bodyId === id);
const steps = (sim: YardSim, ticks: number, input: YardInput = NEUTRAL_INPUT) => {
  for (let tick = 0; tick < ticks; tick += 1) sim.step([input]);
};

/** Presses the dropper button and waits for the drum to come down the belt and land. */
function dropDrum(sim: YardSim): string {
  const button = BUTTONS.find((entry) => entry.id === 'dropper')!;
  patchPlayer(sim, { x: button.base[0] + 1.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
  sim.step([{ ...NEUTRAL_INPUT, use: true }]);
  const id = sim.state.contraptions.drums.at(-1)!.bodyId;
  steps(sim, 180);
  return id;
}

/** Open floor east of the player spawns, clear of props. */
const OPEN: readonly [number, number] = [6, 11];

function placeBody(sim: YardSim, id: string, x: number, z: number, lift = 0.6): void {
  sim.edit((physics) => replacePhysicsPose(physics, id, { x, y: FLOOR_Y + lift, z, vx: 0, vy: 0, vz: 0 }));
}

function placeDrum(sim: YardSim, at: readonly [number, number] = OPEN): string {
  const id = dropDrum(sim);
  placeBody(sim, id, at[0], at[1]);
  steps(sim, 20);
  return id;
}

/** Lights the drum through its state, so it goes off on the next tick. */
function lightNow(sim: YardSim, id: string): void {
  patchState(sim, (state) => ({
    ...state,
    contraptions: {
      ...state.contraptions,
      drums: state.contraptions.drums.map((drum) => (drum.bodyId === id ? { ...drum, damage: FUEL_DRUM.maxDamage, detonateAt: state.frame + 1 } : drum)),
    },
  }));
}

const speedOf = (state: YardState, id: string) => {
  const body = physicsStateBodyById(state.world, id)!;
  return Math.hypot(body.vx, body.vy, body.vz) * TICK_RATE;
};

describe('blast rules', () => {
  it('falls off from 1 at the center to 0 at the radius', () => {
    expect(blastFalloff(0)).toBe(1);
    expect(blastFalloff(BLAST.radius)).toBe(0);
    expect(blastFalloff(BLAST.radius + 3)).toBe(0);
    expect(blastFalloff(1)).toBeGreaterThan(blastFalloff(3));
  });

  it('points away from the blast and up', () => {
    const [x, y, z] = blastDirection([0, 0, 0], [3, 0, 0]);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBe(0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });

  it('lights a drum at full damage, and a lit drum keeps its earlier fuse', () => {
    const drum: FuelDrumState = { bodyId: 'd', damage: 90, detonateAt: null };
    expect(damageDrum(drum, 5, 100)).toEqual({ bodyId: 'd', damage: 95, detonateAt: null });
    const lit = damageDrum(drum, 20, 100);
    expect(lit).toEqual({ bodyId: 'd', damage: FUEL_DRUM.maxDamage, detonateAt: 100 + FUEL_DRUM.fuseTicks });
    expect(damageDrum(lit, 50, 110, FUEL_DRUM.chainFuseTicks).detonateAt).toBe(110 + FUEL_DRUM.chainFuseTicks);
    expect(damageDrum(lit, 50, 140, FUEL_DRUM.chainFuseTicks).detonateAt).toBe(100 + FUEL_DRUM.fuseTicks);
    expect(hitDamage(FUEL_DRUM.minHitSpeed - 0.1)).toBe(0);
  });
});

describe('fuel drums', () => {
  it('the dropper drops a fuel drum that lands whole and unharmed', () => {
    const sim = testSim();
    const id = dropDrum(sim);
    expect(id.startsWith(FUEL_DRUM.idPrefix)).toBe(true);
    expect(sim.state.bodies.find((body) => body.id === id)?.label).toBe(FUEL_DRUM.label);
    expect(physicsStateBodyById(sim.state.world, id)!.y).toBeLessThan(FLOOR_Y + 1.5);
    expect(drumState(sim, id)).toEqual({ bodyId: id, damage: 0, detonateAt: null });
  });

  it('a hard hit dents the drum and damages it, but does not break it apart', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    const before = voxelCount(sim.state, id);
    const bodies = sim.state.bodies.length;
    placeBody(sim, id, OPEN[0], OPEN[1], 2.5);
    sim.edit((physics) => replacePhysicsPose(physics, id, { vy: -9 / TICK_RATE }));
    steps(sim, 20);
    expect(drumState(sim, id)!.damage).toBeGreaterThan(0);
    expect(voxelCount(sim.state, id)).toBeLessThan(before);
    expect(sim.state.bodies.length).toBe(bodies);
  });

  it('the torch heats a drum instead of cutting it, and enough heat lights it', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    const bodies = sim.state.bodies.length;
    const drum = physicsStateBodyById(sim.state.world, id)!;
    const origin = [drum.x, drum.y + 2, drum.z + 0.001] as const;
    const torch = { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay(origin, [0, -1, -0.0005]) };
    steps(sim, 10, torch);
    expect(drumState(sim, id)!.damage).toBeGreaterThan(0);
    expect(drumState(sim, id)!.detonateAt).toBeNull();
    expect(sim.state.bodies.length).toBe(bodies);
    steps(sim, 40, torch);
    expect(drumState(sim, id)!.detonateAt).not.toBeNull();
  });

  it('three punts light a drum, and it goes off after its fuse', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    for (let punt = 0; punt < 3; punt += 1) {
      const drum = physicsStateBodyById(sim.state.world, id)!;
      patchPlayer(sim, { x: drum.x, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: drum.z + 4, vx: 0, vy: 0, vz: 0 });
      const eye = [drum.x, drum.y + 0.3, drum.z + 3.5] as const;
      sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.hand, secondary: true, ...quantizeRay(eye, [0, -0.05, -1]) }]);
      steps(sim, punt < 2 ? 12 : 1);
    }
    const lit = drumState(sim, id)!;
    expect(lit.detonateAt).not.toBeNull();
    steps(sim, lit.detonateAt! - sim.state.frame);
    expect(sim.state.bodies.some((body) => body.id === id)).toBe(false);
    expect(drumState(sim, id)).toBeUndefined();
    expect(sim.state.contraptions.explosions.at(-1)).toMatchObject({ radius: BLAST.radius, frame: lit.detonateAt });
    expect(sim.state.stats.explosions).toBe(1);
    steps(sim, EXPLOSION_SHOW_TICKS + 1);
    expect(sim.state.contraptions.explosions).toHaveLength(0);
  });

  it('the blast pushes bodies harder the closer they are, and not past its radius', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    // Three identical drums from the yard, at 1.5 m, 3.5 m, and 8 m.
    placeBody(sim, 'hazard-drum-1', OPEN[0], OPEN[1] + 1.5);
    placeBody(sim, 'hazard-drum-2', OPEN[0] + 3.5, OPEN[1]);
    placeBody(sim, 'deck-drum-1', OPEN[0] - 8, OPEN[1]);
    steps(sim, 20);
    lightNow(sim, id);
    steps(sim, 2);
    const near = speedOf(sim.state, 'hazard-drum-1');
    const mid = speedOf(sim.state, 'hazard-drum-2');
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(1);
    expect(speedOf(sim.state, 'deck-drum-1')).toBeLessThan(0.2);
    const pushed = physicsStateBodyById(sim.state.world, 'hazard-drum-2')!;
    expect(pushed.vx).toBeGreaterThan(0);
    expect(pushed.vy).toBeGreaterThan(0);
  });

  it('a blast breaks a body next to it and leaves the break hot', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    placeBody(sim, 'timber-pallet', OPEN[0] + 1.2, OPEN[1]);
    steps(sim, 20);
    const before = sim.state.stats.fractures;
    lightNow(sim, id);
    steps(sim, 3);
    expect(sim.state.stats.fractures).toBeGreaterThan(before);
    const pieces = sim.state.bodies.filter((body) => body.label === 'Timber Pallet');
    expect(pieces.some((body) => typeof body.heat?.frame === 'number' && body.voxels.includes(SCORCH_MATERIAL))).toBe(true);
  });

  it('the blast throws a nearby player away from it', () => {
    const sim = testSim();
    const id = placeDrum(sim);
    // The drum can roll after it lands. Put the player 2 m from where the drum stopped, not from OPEN.
    const drum = physicsStateBodyById(sim.state.world, id)!;
    patchPlayer(sim, { x: drum.x - 2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: drum.z, vx: 0, vy: 0, vz: 0 });
    steps(sim, 3);
    lightNow(sim, id);
    const before = sim.state.players[0]!;
    sim.step([NEUTRAL_INPUT]);
    const player = sim.state.players[0]!;
    expect(player.vx).toBeLessThan(0);
    expect(player.vy).toBeGreaterThan(0);
    // Thrown, not nudged: more than a meter in half a second.
    steps(sim, 15);
    expect(before.x - sim.state.players[0]!.x).toBeGreaterThan(1);
  });

  it('a blast lights a drum next to it, which goes off soon after', () => {
    const sim = testSim();
    const first = placeDrum(sim);
    const second = dropDrum(sim);
    placeBody(sim, second, OPEN[0] + 1.2, OPEN[1]);
    steps(sim, 20);
    lightNow(sim, first);
    sim.step([NEUTRAL_INPUT]);
    const chained = drumState(sim, second)!;
    expect(chained.detonateAt).not.toBeNull();
    expect(chained.detonateAt! - sim.state.frame).toBeLessThanOrEqual(FUEL_DRUM.chainFuseTicks);
    steps(sim, FUEL_DRUM.chainFuseTicks + 1);
    expect(drumState(sim, second)).toBeUndefined();
    expect(sim.state.stats.explosions).toBe(2);
  });
});
