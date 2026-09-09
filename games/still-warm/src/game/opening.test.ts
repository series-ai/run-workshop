import { describe, expect, it, vi } from "vitest";
import { compileText, LETTERS_PER_SECOND } from "../text";
import {
  openingAt,
  openingClickSeconds,
  OPENING_DURATION,
  openingTickSeconds,
} from "./opening";
import { createInitialState } from "./model";
import { GameStore } from "./store";
import {
  applyAction,
  observeStatus,
  tickPatient,
  validateAction,
} from "./transitions";

function liftThenRoll() {
  const initial = createInitialState();
  const ready = {
    ...initial,
    phase: "playing" as const,
    disposition: { ...initial.disposition, trust: 50, confidence: 30 },
  };
  const announcedLift = applyAction(ready, {
    kind: "signal_intent",
    contact: { kind: "lift_debris", style: "gentle" },
  });
  expect(announcedLift.ok).toBe(true);
  if (!announcedLift.ok) throw new Error(announcedLift.reason);
  const lifted = applyAction(announcedLift.state, {
    kind: "lift_debris",
    style: "gentle",
  });
  expect(lifted.ok).toBe(true);
  if (!lifted.ok) throw new Error(lifted.reason);
  const announcedRoll = applyAction(lifted.state, {
    kind: "signal_intent",
    contact: { kind: "roll_patient", style: "gentle" },
  });
  expect(announcedRoll.ok).toBe(true);
  if (!announcedRoll.ok) throw new Error(announcedRoll.reason);
  const rolled = applyAction(announcedRoll.state, {
    kind: "roll_patient",
    style: "gentle",
  });
  expect(rolled.ok).toBe(true);
  if (!rolled.ok) throw new Error(rolled.reason);
  return rolled.state;
}

describe("Dark opening", () => {
  it("starts face down in the dark with the cabinet on his back", () => {
    expect(OPENING_DURATION).toBe(32);
    expect(openingAt(0).eyes).toBe(0);
    expect(openingAt(0).narration).toBe(
      "Pitch black. Cold stone against my face.",
    );
    expect(openingAt(6).narration).toBe("I try to move.{{pause(0.250)}}.{{pause(0.250)}}..{{pause(0.750)}} I can't.");
    expect(openingAt(11).narration).toBe("The cabinet. It's pinning me.");
    expect(openingAt(11).eyes).toBeGreaterThan(0);
    expect(openingAt(11).eyes).toBeLessThan(1);
    expect(openingAt(16).narration).toBe("But no pain.");
    expect(openingAt(21).narration).toBe("You hear shuffling on the stone next to you.");
    expect(openingAt(21).voice).toBe("narrator");
    expect(openingAt(25).voice).toBe("thought");
    expect(openingAt(21).shuffle).toBe(true);
    expect(openingAt(25).shuffle).toBe(false);
    expect(openingAt(25).narration).toBe(
      "Oh! My boy is here, in the dark. He must be so scared.",
    );
    expect(openingAt(7).call).toBe(0);
    expect(openingAt(OPENING_DURATION).complete).toBe(true);
    expect(openingAt(OPENING_DURATION).narration).toBe("");
    expect(createInitialState().environment.lanternLit).toBe(false);
    expect(createInitialState().posture).toBe("prone");
    expect(createInitialState().stage).toBe("pinned");
  });

  it("reveals one line with the clock and then holds it", () => {
    const revealSeconds = openingTickSeconds(0, 60);

    expect(revealSeconds).toBeGreaterThan(0);
    expect(revealSeconds).toBeLessThan(6);
    expect(openingAt(revealSeconds).narration).toBe(
      "Pitch black. Cold stone against my face.",
    );
    expect(openingTickSeconds(revealSeconds, 60)).toBe(0);
  });

  it("uses one click to reveal and the next click to advance", () => {
    const revealSeconds = openingClickSeconds(0);

    expect(revealSeconds).toBe(openingTickSeconds(0, 60));
    expect(openingClickSeconds(revealSeconds)).toBeCloseTo(6 - revealSeconds);
    expect(
      openingAt(revealSeconds + openingClickSeconds(revealSeconds)).narration,
    ).toBe("I try to move.{{pause(0.250)}}.{{pause(0.250)}}..{{pause(0.750)}} I can't.");
  });

  it("finishes the current line when clicked during a pause", () => {
    const lineStart = 6;
    const duringPause = lineStart + 14 / LETTERS_PER_SECOND + 0.125;
    const line = openingAt(lineStart).narration;
    const revealedAt = duringPause + openingClickSeconds(duringPause);

    expect(revealedAt).toBeCloseTo(lineStart + compileText(line).duration);
    expect(openingAt(revealedAt).narration).toBe(line);
    expect(revealedAt + openingClickSeconds(revealedAt)).toBeCloseTo(11);
  });

  it("advances immediately when reduced motion requests an instant click", () => {
    expect(openingClickSeconds(0, true)).toBe(6);
    expect(openingClickSeconds(6, true)).toBe(5);
    expect(openingAt(6 + openingClickSeconds(6, true)).narration).toBe(
      "The cabinet. It's pinning me.",
    );
  });

  it("holds the final line until a click completes the opening", () => {
    const finalLineStart = 25;
    const revealSeconds = openingTickSeconds(finalLineStart, 60);
    const revealedAt = finalLineStart + revealSeconds;

    expect(openingAt(revealedAt).complete).toBe(false);
    expect(openingTickSeconds(revealedAt, 60)).toBe(0);
    expect(openingClickSeconds(revealedAt)).toBeCloseTo(
      OPENING_DURATION - revealedAt,
    );
    expect(
      openingAt(revealedAt + openingClickSeconds(revealedAt)).complete,
    ).toBe(true);
  });

  it("protects the patient while reading and resumes time after completion", () => {
    const initial = {
      ...createInitialState(),
      phase: "playing" as const,
    };
    const patient = { ...initial.patient };
    const revealed = tickPatient(initial, openingTickSeconds(0, 3600));
    const held = tickPatient(
      revealed,
      openingTickSeconds(revealed.elapsed, 3600),
    );

    expect(held.elapsed).toBe(revealed.elapsed);
    expect(held.patient).toEqual(patient);

    const store = new GameStore(held);
    try {
      while (!openingAt(store.getSnapshot().elapsed).complete) {
        const state = store.getSnapshot();
        store.tick(openingClickSeconds(state.elapsed, true));
      }

      expect(store.getSnapshot().elapsed).toBe(OPENING_DURATION);
      expect(store.getSnapshot().patient).toEqual(patient);

      store.tick(openingTickSeconds(store.getSnapshot().elapsed, 2));
      expect(store.getSnapshot().elapsed).toBe(OPENING_DURATION + 2);
      expect(store.getSnapshot().patient.health).toBeLessThan(patient.health);
      expect(store.getSnapshot().patient.blood).toBeLessThan(patient.blood);
    } finally {
      store.dispose();
    }
  });

  it("blocks lighting until the cabinet is off and the father is rolled", () => {
    const state = { ...createInitialState(), phase: "playing" as const };
    const blocked = validateAction(state, { kind: "light_lantern" });
    expect(blocked?.thought).toMatch(/cabinet.*roll/i);
    expect(applyAction(state, { kind: "light_lantern" }).ok).toBe(false);

    const rolled = liftThenRoll();
    const result = applyAction(rolled, { kind: "light_lantern" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stage).toBe("covered");
    expect(result.state.posture).toBe("supine");
    expect(result.state.contactCount).toBe(2);
    expect(observeStatus(result.state).environment.lanternLit).toBe(true);
    expect(applyAction(result.state, { kind: "light_lantern" }).ok).toBe(false);
  });

  it("STOP cancels lighting before the flame appears", async () => {
    vi.useFakeTimers();
    const store = new GameStore(liftThenRoll());
    try {
      store.start();
      const action = store.run({ kind: "light_lantern" });
      expect(store.getSnapshot().pending?.action.kind).toBe("light_lantern");
      store.cancel();
      await vi.runAllTimersAsync();
      expect((await action).ok).toBe(false);
      expect(store.getSnapshot().environment.lanternLit).toBe(false);
      expect(store.getSnapshot().posture).toBe("supine");
    } finally {
      store.dispose();
      vi.useRealTimers();
    }
  });
});
