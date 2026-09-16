import { describe, expect, it } from "vitest";
import { GameStore } from "./store";
import {
  OPENING_DURATION,
  openingAt,
  openingClickSeconds,
  openingTickSeconds,
} from "./opening";
import { createInitialState, type GameState } from "./model";
import { tickPatient, applyAction } from "./transitions";
import { deriveEmotion } from "./emotions";

function confidentPlaying(initial = createInitialState()): GameState {
  const disposition = { ...initial.disposition, trust: 50, confidence: 30 };
  return {
    ...initial,
    phase: "playing",
    disposition,
    emotion: deriveEmotion(disposition),
  };
}

function rollPatientProneToSupine() {
  const ready = confidentPlaying();
  const announcedLift = applyAction(ready, {
    kind: "signal_intent",
    contact: { kind: "lift_debris", style: "gentle" },
  });
  if (!announcedLift.ok) throw new Error("Could not signal lift.");
  const freed = applyAction(announcedLift.state, {
    kind: "lift_debris",
    style: "gentle",
  });
  if (!freed.ok) throw new Error("Could not lift debris.");
  const announcedRoll = applyAction(freed.state, {
    kind: "signal_intent",
    contact: { kind: "roll_patient", style: "gentle" },
  });
  if (!announcedRoll.ok) throw new Error("Could not signal roll.");
  const rolled = applyAction(announcedRoll.state, {
    kind: "roll_patient",
    style: "gentle",
  });
  if (!rolled.ok) throw new Error("Could not roll patient.");
  return rolled.state;
}

describe("Dark opening", () => {
  it("starts face down in the dark with the cabinet on his back", () => {
    expect(OPENING_DURATION).toBe(5);
    expect(openingAt(0).eyes).toBe(0);
    expect(openingAt(0).narration).toBe(
      "Pitch black. Cold against my face. I'm pinned down.",
    );
    expect(openingAt(0).voice).toBe("thought");
    expect(openingAt(0).shuffle).toBe(false);
    expect(openingAt(1.5).eyes).toBeGreaterThan(0);
    expect(openingAt(1.5).eyes).toBeLessThan(1);
    expect(openingAt(0).call).toBe(0);
    expect(openingAt(OPENING_DURATION).complete).toBe(true);
    expect(openingAt(OPENING_DURATION).narration).toBe("");
    expect(createInitialState().environment.lanternLit).toBe(false);
    expect(createInitialState().posture).toBe("prone");
    expect(createInitialState().stage).toBe("pinned");
  });

  it("reveals the opening line with the clock and then holds it", () => {
    const revealSeconds = openingTickSeconds(0, 60);

    expect(revealSeconds).toBeGreaterThan(0);
    expect(revealSeconds).toBeLessThan(OPENING_DURATION);
    expect(openingAt(revealSeconds).narration).toBe(
      "Pitch black. Cold against my face. I'm pinned down.",
    );
    expect(openingTickSeconds(revealSeconds, 60)).toBe(0);
  });

  it("uses one click to reveal and the next click to advance", () => {
    const revealSeconds = openingClickSeconds(0);

    expect(revealSeconds).toBe(openingTickSeconds(0, 60));
    expect(openingClickSeconds(revealSeconds)).toBeCloseTo(OPENING_DURATION - revealSeconds);
    expect(
      openingAt(revealSeconds + openingClickSeconds(revealSeconds)).complete,
    ).toBe(true);
  });

  it("advances immediately when reduced motion requests an instant click", () => {
    expect(openingClickSeconds(0, true)).toBe(OPENING_DURATION);
    expect(openingAt(openingClickSeconds(0, true)).complete).toBe(true);
  });

  it("holds the line until a click completes the opening", () => {
    const revealSeconds = openingTickSeconds(0, 60);

    expect(openingAt(revealSeconds).complete).toBe(false);
    expect(openingTickSeconds(revealSeconds, 60)).toBe(0);
    expect(openingClickSeconds(revealSeconds)).toBeCloseTo(
      OPENING_DURATION - revealSeconds,
    );
    expect(
      openingAt(revealSeconds + openingClickSeconds(revealSeconds)).complete,
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
    const pinned = { ...createInitialState(), phase: "playing" as const };
    expect(applyAction(pinned, { kind: "light_lantern" }).ok).toBe(false);

    const ready = confidentPlaying();
    const announcedLift = applyAction(ready, {
      kind: "signal_intent",
      contact: { kind: "lift_debris", style: "gentle" },
    });
    if (!announcedLift.ok) throw new Error("Could not signal lift.");
    const freed = applyAction(announcedLift.state, {
      kind: "lift_debris",
      style: "gentle",
    });
    if (!freed.ok) throw new Error("Could not lift debris.");

    expect(applyAction(freed.state, { kind: "light_lantern" }).ok).toBe(false);

    const rolled = rollPatientProneToSupine();
    expect(applyAction(rolled, { kind: "light_lantern" })).toMatchObject({
      ok: true,
      state: expect.objectContaining({
        environment: expect.objectContaining({ lanternLit: true }),
      }),
    });
  });
});
