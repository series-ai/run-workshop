import { describe, expect, it } from "vitest";
import { LookInput } from "./look";

describe("patient look input", () => {
  it("ignores movement while paused or entering speech", () => {
    const look = new LookInput();
    look.move(200, 200);
    expect([look.yaw, look.pitch]).toEqual([0, -0.32]);
    look.enabled = true;
    look.move(100, -100);
    const direction = [look.yaw, look.pitch];
    look.enabled = false;
    look.move(300, 300);
    expect([look.yaw, look.pitch]).toEqual(direction);
  });

  it("limits neck movement and ignores invalid host deltas", () => {
    const look = new LookInput();
    look.enabled = true;
    look.move(10000, -10000);
    expect([look.yaw, look.pitch]).toEqual([-1.7, 0.9]);
    look.move(NaN, Infinity);
    expect([look.yaw, look.pitch]).toEqual([-1.7, 0.9]);
    look.move(-20000, 20000);
    expect([look.yaw, look.pitch]).toEqual([1.7, -1.1]);
  });

  it("starts each operation looking down without sharing camera state", () => {
    const first = new LookInput();
    const second = new LookInput();
    first.enabled = true;
    first.move(100, -200);
    expect([second.yaw, second.pitch]).toEqual([0, -0.32]);
    first.reset();
    expect([first.yaw, first.pitch]).toEqual([0, -0.32]);
  });
});
