import { describe, expect, it } from "vitest";
import { createInitialState } from "./presets";
import { stepYard } from "./step";
import { openWorld, replacePhysicsPose, fullPhysicsBodyById } from "./physics";
import { stepBuggy } from "./vehicle";
import { NEUTRAL_INPUT, type YardInput } from "./input";

describe("vehicle driving", () => {
  it("mounts buggy when near, drives with WASD, and dismounts with jump", () => {
    let state = createInitialState(1);
    const buggy = state.world.bodies.find((b) => b.id === "vehicle-chassis")!;
    expect(buggy).toBeDefined();

    state = {
      ...state,
      players: [
        {
          ...state.players[0]!,
          x: buggy.x + 1.2,
          y: buggy.y + 0.5,
          z: buggy.z,
          ridingVehicle: false,
        },
      ],
    };

    const mountInput: YardInput = {
      ...NEUTRAL_INPUT,
      secondary: true,
    };
    state = stepYard(state, [mountInput]);
    expect(state.players[0]?.ridingVehicle).toBe(true);

    const driveInput: YardInput = {
      ...NEUTRAL_INPUT,
      moveZ: 1,
    };
    for (let i = 0; i < 10; i++) {
      state = stepYard(state, [driveInput]);
    }
    expect(state.players[0]?.ridingVehicle).toBe(true);
    const movedBuggy = state.world.bodies.find((b) => b.id === "vehicle-chassis")!;
    expect(Math.abs(state.players[0]!.x - movedBuggy.x)).toBeLessThan(0.15);
    expect(Math.abs(state.players[0]!.z - movedBuggy.z)).toBeLessThan(0.15);

    const jumpInput: YardInput = {
      ...NEUTRAL_INPUT,
      jetpack: true,
    };
    state = stepYard(state, [jumpInput]);
    expect(state.players[0]?.ridingVehicle).toBe(false);
  });
  it('drives up the ramp, becomes airborne, lands, and stops', () => {
    let state = createInitialState(1);
    for (let i = 0; i < 20; i++) state = stepYard(state, [NEUTRAL_INPUT]);
    const car = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    state = { ...state, players: [{ ...state.players[0]!, x: car.x + 1.2, y: car.y + .5, z: car.z }] };
    state = stepYard(state, [{ ...NEUTRAL_INPUT, secondary: true }]);
    expect(state.players[0]!.ridingVehicle).toBe(true);
    let airborne = false;
    let landed = false;
    for (let i = 0; i < 150; i++) {
      state = stepYard(state, [{ ...NEUTRAL_INPUT, moveZ: 1 }]);
      const body = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
      if (body.z > 2 && body.y > .7 && state.buggyWheels?.every((w) => !w.grounded)) airborne = true;
      if (airborne && state.buggyWheels?.some((w) => w.grounded)) landed = true;
    }
    expect(airborne).toBe(true);
    expect(landed).toBe(true);
    expect(state.world.bodies.find((b) => b.id === 'vehicle-chassis')!.z).toBeGreaterThan(car.z + 8);
    for (let i = 0; i < 90; i++) state = stepYard(state, [NEUTRAL_INPUT]);
    const stopped = state.world.bodies.find((b) => b.id === 'vehicle-chassis')!;
    expect(Math.hypot(stopped.vx, stopped.vz)).toBeLessThan(.03);
  });

  it('does not apply tire forces or erase angular momentum in the air', () => {
    const state = createInitialState(1);
    const physics = openWorld(replacePhysicsPose(state.world, 'vehicle-chassis', { y: 10, vx: .1, vy: .2, vz: .3 }));
    try {
      const before = fullPhysicsBodyById(physics, 'vehicle-chassis')!;
      const wheels = stepBuggy(physics, { ...NEUTRAL_INPUT, moveZ: 1, moveX: 1 });
      const after = fullPhysicsBodyById(physics, 'vehicle-chassis')!;
      expect(wheels.every((w) => !w.grounded)).toBe(true);
      expect(after.linearVelocity).toEqual(before.linearVelocity);
      expect(after.angularVelocity).toEqual(before.angularVelocity);
    } finally { physics.world.dispose(); }
  });

});
