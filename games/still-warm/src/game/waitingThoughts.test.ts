import { describe, it, expect } from "vitest";
import {
  WaitingThoughtPicker,
  defaultWaitingPicker,
  isStandAttempt,
  isPushCabinetAttempt,
  isRollAttempt,
} from "./waitingThoughts";
import { createInitialState } from "./model";

describe("WaitingThoughtPicker", () => {
  it("generates a thought with two distinct sentences and trailing pause tags", () => {
    const picker = new WaitingThoughtPicker();
    const thought = picker.pick();

    expect(thought.first).toBeTruthy();
    expect(thought.second).toBeTruthy();
    expect(thought.full).toContain("{{pause(2.2)}}");
    expect(thought.full).toContain("{{pause(2.5)}}");
    expect(thought.full.startsWith(thought.first.replace(/\.+$/, ""))).toBe(
      true,
    );
  });

  it("respects state availability filters (e.g. pinned vs unpinned, prone vs supine)", () => {
    const picker = new WaitingThoughtPicker();
    const pinnedState = createInitialState(); // stage: pinned, posture: prone

    // Generate several picks in pinned state
    const pinnedPicks = Array.from({ length: 15 }, () =>
      picker.pick(pinnedState),
    );
    for (const pick of pinnedPicks) {
      expect(pick.first).not.toContain("raw wound");
      expect(pick.first).not.toContain("Rotting beams");
      expect(pick.second).not.toContain("Webs drift");
    }

    // Change to supine state
    const supineState = {
      ...createInitialState(),
      stage: "exposed" as const,
      posture: "supine" as const,
    };
    picker.reset();
    const supinePicks = Array.from({ length: 15 }, () =>
      picker.pick(supineState).full,
    );
    for (const pick of pinnedPicks) {
      expect(pick.first).not.toContain("breath leaves a cold mist against the stone");
    }

    // Supine specific thoughts should appear
    expect(
      supinePicks.some(
        (p) =>
          p.includes("ceiling") ||
          p.includes("rafters") ||
          p.includes("air above me"),
      ),
    ).toBe(true);
  });

  it("delivers stage somatic guidance thoughts when tempo is peak", () => {
    const picker = new WaitingThoughtPicker();
    const pinnedState = createInitialState();
    const peakTempo = {
      stagnantTurns: 3,
      state: "peak" as const,
      lastStage: "pinned" as const,
    };

    const thought = picker.pick(pinnedState, peakTempo);
    expect(
      thought.full.includes("oak") ||
        thought.full.includes("spine") ||
        thought.full.includes("heave") ||
        thought.full.includes("wood"),
    ).toBe(true);
  });

  it("identifies player self-actions and natural command intents", () => {
    expect(isStandAttempt("I stand up")).toBe(true);
    expect(isStandAttempt("stand up")).toBe(true);
    expect(isStandAttempt("get up")).toBe(true);
    expect(isStandAttempt("I try to get up")).toBe(true);
    expect(isStandAttempt("walk")).toBe(true);
    expect(isStandAttempt("hello")).toBe(false);

    expect(isPushCabinetAttempt("push the cabinet off")).toBe(true);
    expect(isPushCabinetAttempt("push the cabinet")).toBe(true);
    expect(isPushCabinetAttempt("shove the wood")).toBe(true);
    expect(isPushCabinetAttempt("push it off me")).toBe(true);
    expect(isPushCabinetAttempt("get this off me")).toBe(true);
    expect(isPushCabinetAttempt("lift the debris")).toBe(true);
    expect(isPushCabinetAttempt("sing a song")).toBe(false);

    expect(isRollAttempt("roll over")).toBe(true);
    expect(isRollAttempt("I roll over")).toBe(true);
    expect(isRollAttempt("turn me over")).toBe(true);
    expect(isRollAttempt("roll onto my back")).toBe(true);
    expect(isRollAttempt("turn me onto my back")).toBe(true);
    expect(isRollAttempt("take the forceps")).toBe(false);
  });

  it("prioritizes somatic realization when player tries to stand up", () => {
    const picker = new WaitingThoughtPicker();
    const pinnedState = createInitialState();

    const thoughtPinned = picker.pick(pinnedState, undefined, "I stand up");
    expect(thoughtPinned.full.includes("agony") || thoughtPinned.full.includes("crushing")).toBe(true);
    expect(thoughtPinned.full).toContain("cannot");

    const unpinnedState = {
      ...pinnedState,
      stage: "exposed" as const,
      posture: "prone" as const,
    };
    const thoughtUnpinned = picker.pick(unpinnedState, undefined, "stand up");
    expect(thoughtUnpinned.full.includes("agony") || thoughtUnpinned.full.includes("tears")).toBe(true);
    expect(thoughtUnpinned.full.includes("cannot stand") || thoughtUnpinned.full.includes("unable to stand")).toBe(true);
  });

  it("prioritizes somatic realization when player commands pushing the cabinet", () => {
    const picker = new WaitingThoughtPicker();
    const pinnedState = createInitialState();

    const thought = picker.pick(pinnedState, undefined, "push the cabinet off");
    expect(
      thought.full.includes("oak") ||
        thought.full.includes("heave") ||
        thought.full.includes("weight"),
    ).toBe(true);
  });

  it("prioritizes somatic realization when player commands rolling over while pinned vs prone", () => {
    const picker = new WaitingThoughtPicker();
    const pinnedState = createInitialState();

    const thoughtPinned = picker.pick(pinnedState, undefined, "roll over");
    expect(
      thoughtPinned.full.includes("oak") ||
        thoughtPinned.full.includes("cabinet") ||
        thoughtPinned.full.includes("lifted"),
    ).toBe(true);

    const proneState = {
      ...pinnedState,
      stage: "exposed" as const,
      posture: "prone" as const,
    };
    const thoughtProne = picker.pick(proneState, undefined, "roll me over");
    expect(
      thoughtProne.full.includes("iron") ||
        thoughtProne.full.includes("flank") ||
        thoughtProne.full.includes("turn"),
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

describe("waiting thought visibility gating", () => {
  const base = createInitialState();

  it("excludes wall and ceiling descriptions unless the room is visible", () => {
    const SIGHT_ONLY = /shadows flicker along the damp stone wall|beams crisscross|Webs drift from the rafters|straining to see his hands/i;

    const dark = base; // pinned · prone · unlit
    const floor = { ...base, stage: "covered" as const }; // cabinet off, still prone
    const lit = {
      ...base,
      stage: "covered" as const,
      posture: "supine" as const,
      environment: { ...base.environment, lanternLit: true },
    };

    const picker = new WaitingThoughtPicker();
    for (let i = 0; i < 60; i++) {
      expect(picker.pick(dark).full).not.toMatch(SIGHT_ONLY);
      expect(picker.pick(floor).full).not.toMatch(SIGHT_ONLY);
    }
    // Under room light the descriptive thoughts may appear at least once.
    const litThoughts = Array.from({ length: 120 }, () => picker.pick(lit).full);
    expect(litThoughts.join(" ")).toMatch(SIGHT_ONLY);
  });
});
