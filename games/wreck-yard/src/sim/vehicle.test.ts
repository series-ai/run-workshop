import { describe, expect, it } from "vitest";
import { TICK_RATE } from "./constants";
import { rotate, type Quat, type Vec3 } from "./math";
import { replacePhysicsPose, fullPhysicsBodyById, physicsStateBodyById, bodyMass } from "./physics";
import { BUGGY_WHEELS, stepBuggy } from "./vehicle";
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
    const { wheels } = stepBuggy(physics, { ...NEUTRAL_INPUT, moveZ: 1, moveX: 1 })!;
    const after = fullPhysicsBodyById(physics, 'vehicle-chassis')!;
    expect(wheels.every((w) => !w.grounded)).toBe(true);
    expect(after.linearVelocity).toEqual(before.linearVelocity);
    expect(after.angularVelocity).toEqual(before.angularVelocity);
  });

  it('does not fling light scrap under its wheels, parked or driving off', () => {
    // The scrap pose moves by k * 10 µm (k = 0 to 23): the outcome is chaotic,
    // and one pose passed while 9 of these 24 stopped (rc.63, rc.64 candidate).
    const failures: string[] = [];
    for (let k = 0; k < 24; k++) {
      const shift = k * 0.00001;
      const sim = testSim(1);
      let state = sim.state;
      for (let i = 0; i < 20; i++) state = sim.step([NEUTRAL_INPUT]);
      const car = physicsStateBodyById(state.world, 'vehicle-chassis')!;
      const carAt: Vec3 = [car.x, car.y, car.z];
      const carRotation: Quat = [car.orientation.x, car.orientation.y, car.orientation.z, car.orientation.w];
      // The lightest loose scrap, one piece under each wheel (0.1 to 0.33 kg).
      const scrap = state.bodies.filter((body) => body.id.startsWith('scrap-') && body.motion === 'dynamic')
        .sort((a, b) => bodyMass(a) - bodyMass(b)).slice(0, BUGGY_WHEELS.length);
      expect(bodyMass(scrap[0]!)).toBeLessThan(0.15);
      sim.edit((physics) => {
        for (const [index, wheel] of BUGGY_WHEELS.entries()) {
          const [x, , z] = rotate([wheel.localAnchor.x, wheel.localAnchor.y, wheel.localAnchor.z], carRotation).map((v, axis) => v + carAt[axis]!);
          replacePhysicsPose(physics, scrap[index]!.id, { x: x + shift, y: car.y - 0.55, z: z + shift, vx: 0, vy: 0, vz: 0 });
        }
      });
      patchPlayer(sim, { x: car.x + 1.2, y: car.y + .5, z: car.z });
      state = sim.step([{ ...NEUTRAL_INPUT, use: true }]);
      expect(state.players[0]!.ridingVehicle).toBe(true);
      const peak = new Map(scrap.map((body) => [body.id, 0]));
      for (let i = 0; i < 120; i++) {
        // Parked with the brake on for 1.5 s, then full throttle off the scrap.
        state = sim.step([{ ...NEUTRAL_INPUT, moveZ: i < 45 ? 0 : 1 }]);
        for (const body of scrap) {
          const view = physicsStateBodyById(state.world, body.id)!;
          peak.set(body.id, Math.max(peak.get(body.id)!, Math.hypot(view.vx, view.vy, view.vz) * TICK_RATE));
        }
      }
      const travel = physicsStateBodyById(state.world, 'vehicle-chassis')!.z - car.z;
      if (!(travel > 3)) failures.push(`k=${k}: the buggy moved ${travel.toFixed(3)} m`);
      for (const [id, speed] of peak) if (!(speed < 12)) failures.push(`k=${k}: ${id} reached ${speed.toFixed(2)} m/s`);
      sim.dispose();
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
