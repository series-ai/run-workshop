import { describe, expect, it } from "vitest";
import { replacePhysicsPose, fullPhysicsBodyById } from "./physics";
import { stepBuggy } from "./vehicle";
import { NEUTRAL_INPUT, type YardInput } from "./input";
import { patchPlayer, testSim } from "./testSim";

describe("vehicle driving", () => {
  it("mounts buggy when near, drives with WASD, and dismounts with jump", () => {
    const sim = testSim(1);
    let state = sim.state;
    const buggy = state.world.bodies.find((b) => b.id === "vehicle-chassis")!;
    expect(buggy).toBeDefined();

    patchPlayer(sim, { x: buggy.x + 1.2, y: buggy.y + 0.5, z: buggy.z, ridingVehicle: false });

    const mountInput: YardInput = {
      ...NEUTRAL_INPUT,
      use: true,
    };
    state = sim.step([mountInput]);
    expect(state.players[0]?.ridingVehicle).toBe(true);

    const driveInput: YardInput = {
      ...NEUTRAL_INPUT,
      moveZ: 1,
    };
    for (let i = 0; i < 10; i++) {
      state = sim.step([driveInput]);
    }
    expect(state.players[0]?.ridingVehicle).toBe(true);
    const movedBuggy = state.world.bodies.find((b) => b.id === "vehicle-chassis")!;
    expect(Math.abs(state.players[0]!.x - movedBuggy.x)).toBeLessThan(0.15);
    expect(Math.abs(state.players[0]!.z - movedBuggy.z)).toBeLessThan(0.15);

    const jumpInput: YardInput = {
      ...NEUTRAL_INPUT,
      jetpack: true,
    };
    state = sim.step([jumpInput]);
    expect(state.players[0]?.ridingVehicle).toBe(false);
  });
  it('drives up the ramp, becomes airborne, lands, and stops', () => {
    const sim = testSim(1);
    let state = sim.state;
    for (let i = 0; i < 20; i++) state = sim.step([NEUTRAL_INPUT]);
    const car = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    patchPlayer(sim, { x: car.x + 1.2, y: car.y + .5, z: car.z });
    state = sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    expect(state.players[0]!.ridingVehicle).toBe(true);
    let airborne = false;
    let landed = false;
    for (let i = 0; i < 150; i++) {
      state = sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }]);
      const body = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
      if (body.z > 2 && body.y > .7 && state.buggyWheels?.every((w) => !w.grounded)) airborne = true;
      if (airborne && state.buggyWheels?.some((w) => w.grounded)) landed = true;
    }
    expect(airborne).toBe(true);
    expect(landed).toBe(true);
    expect(state.world.bodies.find((b) => b.id === 'vehicle-chassis')!.z).toBeGreaterThan(car.z + 8);
    for (let i = 0; i < 90; i++) state = sim.step([NEUTRAL_INPUT]);
    const stopped = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    expect(Math.hypot(stopped.vx, stopped.vz)).toBeLessThan(.03);
  });

  it('does not apply tire forces or erase angular momentum in the air', () => {
    const sim = testSim(1);
    sim.edit((physics) => replacePhysicsPose(physics, 'vehicle-chassis', { y: 10, vx: .1, vy: .2, vz: .3 }));
    const physics = sim.physics;
    const before = fullPhysicsBodyById(physics, 'vehicle-chassis')!;
    const wheels = stepBuggy(physics, { ...NEUTRAL_INPUT, moveZ: 1, moveX: 1 });
    const after = fullPhysicsBodyById(physics, 'vehicle-chassis')!;
    expect(wheels.every((w) => !w.grounded)).toBe(true);
    expect(after.linearVelocity).toEqual(before.linearVelocity);
    expect(after.angularVelocity).toEqual(before.angularVelocity);
  });

});
