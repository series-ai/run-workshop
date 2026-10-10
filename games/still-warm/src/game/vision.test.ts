import { describe, expect, it } from "vitest";
import { createInitialState } from "./model";
import { resolveVision, visionOf, type VisionInput } from "./vision";

function input(overrides: Partial<VisionInput> = {}): VisionInput {
  return {
    posture: "prone",
    stage: "pinned",
    lamp: "away",
    candleLit: false,
    lanternLit: false,
    fire: 0,
    ...overrides,
  };
}

describe("resolveVision", () => {
  it("is dark while pinned face down under the cabinet, lit or not", () => {
    expect(resolveVision(input())).toBe("dark");
    expect(resolveVision(input({ fire: 12 }))).toBe("dark");
    expect(resolveVision(input({ lanternLit: true }))).toBe("dark");
  });

  it("shows only the floor once the cabinet is off but he is still face down", () => {
    expect(resolveVision(input({ stage: "covered" }))).toBe("floor");
    expect(resolveVision(input({ stage: "exposed" }))).toBe("floor");
    expect(resolveVision(input({ stage: "dressed" }))).toBe("floor");
  });

  it("shows the room only when supine under light", () => {
    expect(resolveVision(input({ posture: "supine", lanternLit: true }))).toBe(
      "room",
    );
    expect(resolveVision(input({ posture: "supine", candleLit: true }))).toBe(
      "room",
    );
    expect(resolveVision(input({ posture: "supine", lamp: "wound" }))).toBe(
      "room",
    );
  });

  it("is dark when supine without any light", () => {
    expect(resolveVision(input({ posture: "supine" }))).toBe("dark");
  });

  it("derives the same answer from a real game state", () => {
    const base = createInitialState();
    expect(visionOf(base)).toBe("dark");
    expect(visionOf({ ...base, stage: "covered" })).toBe("floor");
    expect(
      visionOf({
        ...base,
        posture: "supine",
        environment: { ...base.environment, lanternLit: true },
      }),
    ).toBe("room");
  });
});
