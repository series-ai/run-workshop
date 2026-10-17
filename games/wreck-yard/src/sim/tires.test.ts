import { meters, metersPerSecond, radiansPerSecond, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { describe, expect, it } from 'vitest';
import { FLOOR_Y } from './constants';
import { fractureBody } from './fracture';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { bodyLinearDamping, physicsBodyHandle, readBodyInput, physicsStateBodyById, replacePhysicsPose } from './physics';
import type { YardSim } from './sim';
import type { YardState } from './state';
import { patchState, testSim } from './testSim';

const TIRES = [0, 1, 2, 3, 4].map((index) => `loose-tire-${index}`);

function runTicks(sim: YardSim, ticks: number): YardState {
  let state = sim.state;
  for (let tick = 0; tick < ticks; tick += 1) state = sim.step([NEUTRAL_INPUT]);
  return state;
}

describe('loose tires', () => {
  it('stand in a stack of five rubber tires, each on a cylinder collider', () => {
    const sim = testSim(1);
    const state = runTicks(sim, 60);
    const heights = TIRES.map((id) => physicsStateBodyById(state.world, id)!.y - FLOOR_Y);
    heights.forEach((height, index) => expect(height).toBeCloseTo(0.16 + index * 0.318, 1));
    for (const id of TIRES) expect(state.bodies.find((body) => body.id === id)).toMatchObject({ material: 'rubber', collider: 'cylinder' });
  });

  it('roll more than 8 m on the tread from a 5 m/s push, and stay upright', () => {
    const sim = testSim(1);
    const q = Math.SQRT1_2;
    // On its edge: a quarter turn about x puts the axis along z. It rolls along +x.
    sim.edit((physics) => {
      const handle = physicsBodyHandle(physics, 'loose-tire-4');
      physics.world.edit((edit) => edit.replaceBody(handle, {
        ...readBodyInput(physics, handle),
        position: vec3(meters, 0, FLOOR_Y + 0.53, 14),
        orientation: { x: q, y: 0, z: 0, w: q },
        linearVelocity: vec3(metersPerSecond, 5, 0, 0),
        angularVelocity: vec3(radiansPerSecond, 0, 0, -5 / 0.52),
        sleeping: false,
      }));
    });
    const state = runTicks(sim, 90);
    const tire = physicsStateBodyById(state.world, 'loose-tire-4')!;
    expect(tire.x).toBeGreaterThan(8);
    expect(tire.y - FLOOR_Y).toBeCloseTo(0.52, 1);
  });

  it('bounce back up more than 0.5 m from a 3 m drop', () => {
    const sim = testSim(1);
    sim.edit((physics) => replacePhysicsPose(physics, 'loose-tire-4', { x: 0, y: FLOOR_Y + 3, z: 14, vx: 0, vy: 0, vz: 0 }));
    let top = 0;
    let rising = false;
    let previous = 0;
    for (let tick = 0; tick < 60; tick++) {
      const tire = physicsStateBodyById(sim.step([NEUTRAL_INPUT]).world, 'loose-tire-4')!;
      if (tire.vy > 0 && previous <= 0) rising = true;
      if (rising) top = Math.max(top, tire.y - FLOOR_Y);
      previous = tire.vy;
    }
    expect(top).toBeGreaterThan(0.5);
  });

  it('take the gravity gun: a tire grabs like any loose body', () => {
    const sim = testSim(1);
    runTicks(sim, 30);
    const top = physicsStateBodyById(sim.state.world, 'loose-tire-4')!;
    const eye: [number, number, number] = [top.x, top.y + 6, top.z + 0.001];
    const state = sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay(eye, [0, -1, -0.0001]) }]);
    expect(state.players[0]!.grab?.bodyId).toBe('loose-tire-4');
  });

  it('lose the cylinder collider when the torch cuts one: the pieces use voxel colliders', () => {
    const sim = testSim(1);
    const tire = sim.state.bodies.find((body) => body.id === 'loose-tire-0')!;
    const result = fractureBody(tire, { position: [0, 1, 0], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] }, {
      // A vertical cut through the whole ring at x = 6 splits it in two.
      start: [6, -1, -1], end: [6, 5, -1], through: [6, -1, 14], throughEnd: [6, 5, 14], radius: 1, worldPoint: [0, 1, 0], impulseBoost: 0,
    }, 0, 0);
    expect(result.fragments.length).toBeGreaterThan(1);
    for (const fragment of result.fragments) expect(fragment.body.collider).toBeUndefined();
  });

  it('get their low damping back after a catapult flight', () => {
    const sim = testSim(1);
    // A catapult flight sets linear damping to 0 until `until`, then the sim gives the body its damping back.
    sim.edit((physics) => {
      const handle = physicsBodyHandle(physics, 'loose-tire-4');
      physics.world.edit((edit) => edit.replaceBody(handle, { ...readBodyInput(physics, handle), linearDamping: 0 }));
    });
    patchState(sim, (state) => ({ ...state, contraptions: { ...state.contraptions, ballistic: [{ bodyId: 'loose-tire-4', until: state.frame }] } }));
    runTicks(sim, 2);
    let damping = 0;
    sim.edit((physics) => { damping = physics.world.readBody(physicsBodyHandle(physics, 'loose-tire-4')).linearDamping; });
    expect(damping).toBe(bodyLinearDamping(sim.state.bodies.find((body) => body.id === 'loose-tire-4')!));
    expect(damping).toBeGreaterThan(0.99);
  });
});
