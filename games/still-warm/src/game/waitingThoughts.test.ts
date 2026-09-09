import { describe, expect, it } from "vitest";
import {
  defaultWaitingPicker,
  WAITING_SET_1,
  WAITING_SET_2,
  WaitingThoughtPicker,
} from "./waitingThoughts";
import { createInitialState } from "./model";

describe("waiting thoughts procedural generator", () => {
  it("provides over one hundred procedural combinations between Set 1 and Set 2", () => {
    const totalPossible = WAITING_SET_1.length * WAITING_SET_2.length;
    expect(totalPossible).toBeGreaterThanOrEqual(100);
    expect(WAITING_SET_1).toContain("Your voice echoes in the darkness");
    expect(WAITING_SET_1).toContain("Your throat is coarse");
  });

  it("formats with ellipsis and trailing pauses to act as buffers at the end of both lines", () => {
    const picker = new WaitingThoughtPicker();
    const thought = picker.pick();

    expect(thought.full).toContain("...");
    expect(thought.full).toContain("{{pause(2.2)}}");
    expect(thought.full).toContain("{{pause(2.5)}}");
    expect(thought.full.startsWith(thought.first)).toBe(true);
    expect(thought.full.includes(thought.second)).toBe(true);
  });

  it("damp stone bites into your forehead is only available until flipped over (prone vs supine)", () => {
    const proneState = createInitialState();
    expect(proneState.posture).toBe("prone");

    const picker = new WaitingThoughtPicker();

    // Verify forehead/prone thoughts can appear when prone
    const pronePicks: string[] = [];
    for (let i = 0; i < 50; i++) {
      pronePicks.push(picker.pick(proneState).second);
    }
    expect(
      pronePicks.some((p) => p.includes("damp stone bites into your forehead")),
    ).toBe(true);

    // Now roll the patient over (flipped over to supine)
    const supineState = {
      ...proneState,
      posture: "supine" as const,
      stage: "covered" as const,
    };
    picker.reset();

    // In supine state, forehead against stone must NEVER appear
    const supinePicks: string[] = [];
    for (let i = 0; i < 100; i++) {
      const pick = picker.pick(supineState);
      supinePicks.push(pick.first);
      supinePicks.push(pick.second);
      expect(pick.second).not.toContain("damp stone bites into your forehead");
      expect(pick.second).not.toContain("cellar floor drains the warmth");
      expect(pick.first).not.toContain("breath leaves a cold mist against the stone");
    }

    // Supine specific thoughts should appear
    expect(
      supinePicks.some(
        (p) =>
          p.includes("ceiling") ||
          p.includes("rafters") ||
          p.includes("air above you"),
      ),
    ).toBe(true);
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
