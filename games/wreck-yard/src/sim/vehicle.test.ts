import { describe, expect, it } from "vitest";
import { createInitialState } from "./presets";
import { stepYard } from "./step";
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
});
