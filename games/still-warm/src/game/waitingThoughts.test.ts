import { describe, expect, it } from "vitest";
import {
  defaultWaitingPicker,
  WAITING_SET_1,
  WAITING_SET_2,
  WaitingThoughtPicker,
} from "./waitingThoughts";

describe("waiting thoughts procedural generator", () => {
  it("provides over one hundred procedural combinations between Set 1 and Set 2", () => {
    const totalPossible = WAITING_SET_1.length * WAITING_SET_2.length;
    expect(totalPossible).toBeGreaterThanOrEqual(100);
    expect(WAITING_SET_1).toContain("Your voice echoes in the darkness");
    expect(WAITING_SET_1).toContain("Your throat is coarse");
  });

  it("formats with ellipsis and pause marker to slow down before revealing the second thought", () => {
    const picker = new WaitingThoughtPicker();
    const thought = picker.pick();

    expect(thought.full).toContain("...");
    expect(thought.full).toContain("{{pause(");
    expect(thought.full.startsWith(thought.first)).toBe(true);
    expect(thought.full.endsWith(thought.second)).toBe(true);
  });

  it("does not immediately repeat the same primary thought across consecutive picks", () => {
    const picker = new WaitingThoughtPicker();
    const picks = Array.from({ length: 5 }, () => picker.pick());
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i].first).not.toBe(picks[i - 1].first);
    }
  });

  it("avoids semantic keyword collisions between the first and second thought", () => {
    const picker = new WaitingThoughtPicker();
    for (let i = 0; i < 30; i++) {
      const { first, second } = picker.pick();
      if (first.includes("throat")) {
        expect(second.toLowerCase()).not.toContain("throat");
      }
      if (first.includes("stone")) {
        expect(second.toLowerCase()).not.toContain("stone");
      }
    }
  });

  it("defaultWaitingPicker singleton returns valid waiting thoughts", () => {
    const thought = defaultWaitingPicker.pick();
    expect(thought.first).toBeTruthy();
    expect(thought.second).toBeTruthy();
    expect(thought.full).toContain("...");
  });
});
