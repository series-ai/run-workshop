import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, GameState, PhysicalAction } from "./model";
import {
  applyAction,
  BLACKOUT_DURATION,
  observeRoom,
  observeStatus,
  tickPatient,
  validateAction,
} from "./transitions";
import { getActionDuration, GameStore } from "./store";
import {
  deriveEmotion,
  getEmotionContactModifiers,
  EMOTION_PROFILES,
} from "./emotions";
import { RECIPES, SUPPORTED_USES } from "./affordances";

type RoomObservation = ReturnType<typeof observeStatus> & {
  recipes: typeof RECIPES;
  supportedUses: typeof SUPPORTED_USES;
};

function createPostAccidentState(): GameState {
  return {
    ...createInitialState(),
    phase: "playing",
    stage: "covered",
  };
}

describe("Still Warm - Domain Rules & Transitions", () => {
  let state: GameState;

  beforeEach(() => {
    state = createPostAccidentState();
  });

  describe("Opening accident", () => {
    it("starts with the creator pinned under the fallen ceiling support", () => {
      const initial = createInitialState();
      const status = observeStatus(initial);

      expect(initial.stage).toBe("pinned");
      expect(initial.disposition.confidence).toBe(18);
      expect(status.patient.condition).toMatch(/pinned.*ceiling support/i);
      expect(status.summary).toMatch(/pinned.*ceiling support/i);
    });

    it.each(["reassure", "clear_instruction"] as const)(
      "refuses at low confidence, then lifts after %s",
      (stimulus) => {
        let pinned: GameState = {
          ...createInitialState(),
          phase: "playing",
        };

        const refused = applyAction(pinned, {
          kind: "lift_debris",
          style: "gentle",
        });
        expect(refused.ok).toBe(false);
        if (refused.ok) return;
        expect(refused.reason).toMatch(/too afraid/i);
        expect(refused.reason).toMatch(/reassure.*clear instruction/i);

        const reaction = applyAction(pinned, { kind: "react", stimulus });
        expect(reaction.ok).toBe(true);
        if (!reaction.ok) return;
        const announcement = applyAction(reaction.state, {
          kind: "speak",
          text: "I will lift the fallen ceiling support now.",
        });
        expect(announcement.ok).toBe(true);
        if (!announcement.ok) return;
        pinned = announcement.state;

        const lifted = applyAction(pinned, {
          kind: "lift_debris",
          style: "gentle",
        });
        expect(lifted.ok).toBe(true);
        if (!lifted.ok) return;
        expect(lifted.state.stage).toBe("covered");
        expect(lifted.state.announced).toBe(false);
        expect(lifted.message).toMatch(/deep crush wound.*cannot move/i);
        expect(
          validateAction(lifted.state, {
            kind: "lift_debris",
            style: "gentle",
          }),
        ).toMatch(/already been removed/i);
      },
    );

    it("blocks wound contact until the support is removed", () => {
      const initial = createInitialState();
      const pinned: GameState = {
        ...initial,
        phase: "playing",
        holding: "cloth",
        lamp: "wound",
        announced: true,
        items: {
          ...initial.items,
          cloth: { location: "hand", clean: true },
        },
      };

      const action: PhysicalAction = {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      };
      expect(validateAction(pinned, action)).toMatch(/support pins.*lift/i);
      const result = applyAction(pinned, action);
      expect(result.ok).toBe(false);
      expect(pinned.stage).toBe("pinned");
    });

    it("enforces the hand, gentle, announcement, and blackout lift guards", () => {
      const initial = createInitialState();
      const confident = {
        ...initial,
        phase: "playing" as const,
        disposition: { ...initial.disposition, confidence: 30 },
      };

      expect(
        validateAction(
          { ...confident, holding: "cloth" },
          { kind: "lift_debris", style: "gentle" },
        ),
      ).toMatch(/empty|put it down/i);
      expect(
        validateAction(
          {
            ...confident,
            announced: true,
            rules: { ...confident.rules, gentle: true },
          },
          { kind: "lift_debris", style: "rough" },
        ),
      ).toMatch(/gentle rule/i);
      expect(
        validateAction(confident, { kind: "lift_debris", style: "gentle" }),
      ).toMatch(/announced/i);
      expect(
        validateAction(
          {
            ...confident,
            phase: "blackout",
            announced: true,
            rules: { ...confident.rules, waitBlackout: true },
            patient: { ...confident.patient, blackoutRemaining: 5 },
          },
          { kind: "lift_debris", style: "gentle" },
        ),
      ).toMatch(/wait-in-blackout/i);
    });
  });

  describe("Hand coherence & item constraints", () => {
    it("allows picking up an item when hand is empty", () => {
      const err = validateAction(state, { kind: "pick_up", item: "forceps" });
      expect(err).toBeNull();
      const res = applyAction(state, { kind: "pick_up", item: "forceps" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.holding).toBe("forceps");
        expect(res.state.items.forceps.location).toBe("hand");
      }
    });

    it("rejects picking up another item when hand is full", () => {
      const heldState = {
        ...state,
        holding: "forceps" as const,
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" as const },
        },
      };
      const err = validateAction(heldState, {
        kind: "pick_up",
        item: "scalpel",
      });
      expect(err).toMatch(/Already holding/i);
    });

    it("prevents picking up or moving embedded shard before extraction", () => {
      expect(validateAction(state, { kind: "pick_up", item: "shard" })).toMatch(
        /cannot be picked up before extraction/i,
      );

      // Even in exposed stage, shard cannot be picked up by hand
      const exposedState = { ...state, stage: "exposed" as const };
      expect(
        validateAction(exposedState, { kind: "pick_up", item: "shard" }),
      ).toMatch(/cannot be picked up before extraction/i);
    });

    it("makes tools on floor dirty, and dirty wound contact causes extra trauma", () => {
      const holdingForceps: GameState = {
        ...state,
        holding: "forceps",
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" },
        },
      };
      // Place on floor
      const placed = applyAction(holdingForceps, {
        kind: "place",
        item: "forceps",
        location: "floor",
      });
      expect(placed.ok).toBe(true);
      if (!placed.ok) return;
      expect(placed.state.items.forceps.clean).toBe(false);

      // Pick up dirty forceps
      const pickedDirty = applyAction(placed.state, {
        kind: "pick_up",
        item: "forceps",
      });
      expect(pickedDirty.ok).toBe(true);
      if (!pickedDirty.ok) return;

      // Uncover wound first cleanly
      let s = pickedDirty.state;
      s = {
        ...s,
        stage: "exposed",
        lamp: "wound",
        announced: true,
      };

      const initialPain = s.patient.pain;
      const initialHealth = s.patient.health;
      const extractRes = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      });
      expect(extractRes.ok).toBe(true);
      if (extractRes.ok) {
        // Dirty contact gives extra 20 pain and extra 15 health loss
        expect(extractRes.state.patient.pain).toBeGreaterThan(initialPain + 25);
        expect(extractRes.state.patient.health).toBeLessThan(
          initialHealth - 15,
        );
      }
    });
  });

  describe("Standing Rules Enforcement & Creation Bypasses", () => {
    it("enforces announce rule for patient contact", () => {
      // Announce is true by default
      const holdingCloth: GameState = {
        ...state,
        holding: "cloth",
        lamp: "wound",
        announced: false,
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };

      // Direct contact without announcement fails
      expect(
        validateAction(holdingCloth, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        }),
      ).toMatch(/must be announced/i);

      // Speaking arms announcement
      const speakRes = applyAction(holdingCloth, {
        kind: "speak",
        text: "I am about to uncover your wound.",
      });
      expect(speakRes.ok).toBe(true);
      if (!speakRes.ok) return;
      expect(speakRes.state.announced).toBe(true);

      // Now contact is valid
      const useRes = applyAction(speakRes.state, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(useRes.ok).toBe(true);
      if (!useRes.ok) return;
      // Announcement token is consumed on contact
      expect(useRes.state.announced).toBe(false);
    });

    it("enforces noSharp rule on pickup, use, and creation bypasses", () => {
      const noSharpState: GameState = {
        ...state,
        rules: { ...state.rules, noSharp: true },
      };

      // Direct pickup blocked
      expect(
        validateAction(noSharpState, { kind: "pick_up", item: "needle" }),
      ).toMatch(/no-sharp/i);
      expect(
        validateAction(noSharpState, { kind: "pick_up", item: "scalpel" }),
      ).toMatch(/no-sharp/i);

      // Combine needle + thread cannot bypass noSharp to create/hold sharp suture
      const combineState: GameState = {
        ...noSharpState,
        holding: "needle",
        items: {
          ...noSharpState.items,
          needle: { ...noSharpState.items.needle, location: "hand" },
          thread: { location: "tray", clean: true },
        },
      };
      expect(
        validateAction(combineState, {
          kind: "combine",
          first: "needle",
          second: "thread",
        }),
      ).toMatch(/no-sharp rule/i);

      // Break scissors cannot bypass noSharp to create sharp blade
      const breakState: GameState = {
        ...noSharpState,
        holding: "scissors",
        items: {
          ...noSharpState.items,
          scissors: { ...noSharpState.items.scissors, location: "hand" },
        },
      };
      expect(
        validateAction(breakState, { kind: "break", item: "scissors" }),
      ).toMatch(/no-sharp rule/i);

      // Prying scissors cannot bypass noSharp to create sharp blade
      const pryScissorsState: GameState = {
        ...noSharpState,
        holding: "forceps",
        items: {
          ...noSharpState.items,
          forceps: { ...noSharpState.items.forceps, location: "hand" },
          scissors: { location: "tray", clean: true },
        },
      };
      expect(
        validateAction(pryScissorsState, {
          kind: "use",
          item: "forceps",
          target: "scissors",
          style: "gentle",
        }),
      ).toMatch(/no-sharp rule/i);
    });

    it("rejects duplicate outputs and cutting consumed targets", () => {
      let s: GameState = {
        ...state,
        holding: "scalpel",
        items: {
          ...state.items,
          scalpel: { ...state.items.scalpel, location: "hand" },
        },
      };

      // 1. Cut cloth to make bandage
      const cut1 = applyAction(s, {
        kind: "use",
        item: "scalpel",
        target: "cloth",
        style: "gentle",
      });
      expect(cut1.ok).toBe(true);
      if (!cut1.ok) return;
      s = cut1.state;
      expect(s.items.bandage.location).toBe("tray");

      // Attempting to cut consumed cloth again fails
      expect(
        validateAction(s, {
          kind: "use",
          item: "scalpel",
          target: "cloth",
          style: "gentle",
        }),
      ).toMatch(/already been consumed/i);

      // Attempting to cut blanket to create duplicate bandage fails
      expect(
        validateAction(s, {
          kind: "use",
          item: "scalpel",
          target: "blanket",
          style: "gentle",
        }),
      ).toMatch(/already been created/i);
    });

    it("enforces noMedicine rule against morphine", () => {
      const noMedState: GameState = {
        ...state,
        rules: { ...state.rules, noMedicine: true },
        holding: "morphine",
        announced: true,
        items: {
          ...state.items,
          morphine: { ...state.items.morphine, location: "hand" },
        },
      };

      expect(
        validateAction(noMedState, {
          kind: "use",
          item: "morphine",
          target: "patient",
          style: "gentle",
        }),
      ).toMatch(/no-medicine/i);
    });

    it("enforces gentle rule prohibiting rough style", () => {
      const gentleState: GameState = {
        ...state,
        rules: { ...state.rules, gentle: true },
        holding: "cloth",
        lamp: "wound",
        announced: true,
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };

      expect(
        validateAction(gentleState, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "rough",
        }),
      ).toMatch(/gentle rule/i);

      expect(
        validateAction(gentleState, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        }),
      ).toBeNull();
    });

    it("enforces waitBlackout during blackout for patient contact only", () => {
      const blackoutState: GameState = {
        ...state,
        phase: "blackout",
        patient: { ...state.patient, blackoutRemaining: 6 },
        rules: { ...state.rules, waitBlackout: true },
        holding: "cloth",
        lamp: "wound",
        announced: true,
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };

      // Patient contact is blocked
      expect(
        validateAction(blackoutState, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        }),
      ).toMatch(/wait-in-blackout/i);

      // Non-patient contact (e.g. pillow rehearsal or placing on tray) is NOT blocked
      expect(
        validateAction(blackoutState, {
          kind: "use",
          item: "cloth",
          target: "pillow",
          style: "gentle",
        }),
      ).toBeNull();
      expect(
        validateAction(blackoutState, {
          kind: "place",
          item: "cloth",
          location: "tray",
        }),
      ).toBeNull();
    });

    it("caps remember notes at 12", () => {
      let s = state;
      for (let i = 1; i <= 12; i++) {
        const res = applyAction(s, { kind: "remember", note: `Note ${i}` });
        expect(res.ok).toBe(true);
        if (res.ok) s = res.state;
      }
      expect(s.notes.length).toBe(12);

      // Attempting 13th note is rejected
      expect(validateAction(s, { kind: "remember", note: "Note 13" })).toMatch(
        /Memory full/i,
      );
    });
  });

  describe("Surgery boundaries and unsupported targets", () => {
    it("unsupported use target is rejected and never affects patient vitals or wound", () => {
      const holdingScalpel: GameState = {
        ...state,
        holding: "scalpel",
        items: {
          ...state.items,
          scalpel: { ...state.items.scalpel, location: "hand" },
        },
      };

      const initialVitals = { ...holdingScalpel.patient };

      // Using scalpel on unsupported target e.g. bowl
      const err = validateAction(holdingScalpel, {
        kind: "use",
        item: "scalpel",
        target: "bowl",
        style: "gentle",
      });
      expect(err).toMatch(/cannot use scalpel on bowl/i);

      const res = applyAction(holdingScalpel, {
        kind: "use",
        item: "scalpel",
        target: "bowl",
        style: "gentle",
      });
      expect(res.ok).toBe(false);

      // Ensure patient is completely unharmed
      expect(holdingScalpel.patient).toEqual(initialVitals);
      expect(holdingScalpel.stage).toBe("covered");
    });

    it("rehearsal on pillow improves confidence and never affects patient", () => {
      const holdingForceps: GameState = {
        ...state,
        holding: "forceps",
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" },
        },
      };

      const initialVitals = { ...holdingForceps.patient };
      const initialConfidence = holdingForceps.disposition.confidence;

      const res = applyAction(holdingForceps, {
        kind: "use",
        item: "forceps",
        target: "pillow",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.state.patient).toEqual(initialVitals);
      expect(res.state.stage).toBe("covered");
      expect(res.state.disposition.confidence).toBeGreaterThan(
        initialConfidence,
      );
    });
  });

  describe("Resource cleanliness propagation", () => {
    it("propagates contamination from dirty tool or dirty input to created resource", () => {
      // 1. Dirty tool cutting cloth -> dirty bandage
      const dirtyScalpelState: GameState = {
        ...state,
        holding: "scalpel",
        items: {
          ...state.items,
          scalpel: { ...state.items.scalpel, location: "hand", clean: false },
          cloth: { ...state.items.cloth, clean: true },
        },
      };

      const cutRes = applyAction(dirtyScalpelState, {
        kind: "use",
        item: "scalpel",
        target: "cloth",
        style: "gentle",
      });
      expect(cutRes.ok).toBe(true);
      if (cutRes.ok) {
        expect(cutRes.state.items.bandage.clean).toBe(false);
      }

      // 2. Combining dirty needle with clean thread -> dirty suture
      const combineState: GameState = {
        ...state,
        holding: "needle",
        items: {
          ...state.items,
          needle: { ...state.items.needle, location: "hand", clean: false },
          thread: { location: "tray", clean: true },
        },
      };

      const combRes = applyAction(combineState, {
        kind: "combine",
        first: "needle",
        second: "thread",
      });
      expect(combRes.ok).toBe(true);
      if (combRes.ok) {
        expect(combRes.state.items.suture.clean).toBe(false);
      }
    });
  });

  describe("Surgical progression & recipes", () => {
    it("walks full surgical path to victory", () => {
      let s = state;
      s.lamp = "wound";

      // Step 1: Pick up cloth and expose wound
      let res = applyAction(s, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      // Speak to satisfy announce rule
      res = applyAction(s, { kind: "speak", text: "Uncovering the wound." });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      res = applyAction(s, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("exposed");

      // Place cloth back
      res = applyAction(s, { kind: "place", item: "cloth", location: "tray" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      // Step 2: Pick up forceps and extract shard
      res = applyAction(s, { kind: "pick_up", item: "forceps" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      res = applyAction(s, { kind: "speak", text: "Extracting fragment." });
      if (res.ok) s = res.state;

      res = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("extracted");
      expect(s.items.shard.location).toBe("tray");

      res = applyAction(s, {
        kind: "place",
        item: "forceps",
        location: "tray",
      });
      if (res.ok) s = res.state;

      // Step 3: Attempt bare needle -> must fail to advance and warn about thread
      res = applyAction(s, { kind: "pick_up", item: "needle" });
      if (res.ok) s = res.state;
      res = applyAction(s, { kind: "speak", text: "Needle contact." });
      if (res.ok) s = res.state;

      res = applyAction(s, {
        kind: "use",
        item: "needle",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("extracted"); // Did not advance!
      expect(res.message).toMatch(/needs to be combined with thread/i);

      res = applyAction(s, { kind: "place", item: "needle", location: "tray" });
      if (res.ok) s = res.state;

      // Recipe 1: Cut wig to make thread
      res = applyAction(s, { kind: "pick_up", item: "scalpel" });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "use",
        item: "scalpel",
        target: "wig",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.items.thread.location).toBe("tray");

      // Recipe 2: Cut cloth to make bandage
      res = applyAction(s, {
        kind: "use",
        item: "scalpel",
        target: "cloth",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.items.bandage.location).toBe("tray");

      res = applyAction(s, {
        kind: "place",
        item: "scalpel",
        location: "tray",
      });
      if (res.ok) s = res.state;

      // Recipe 3: Combine needle + thread -> suture held in hand
      res = applyAction(s, { kind: "pick_up", item: "needle" });
      if (res.ok) s = res.state;

      res = applyAction(s, {
        kind: "combine",
        first: "needle",
        second: "thread",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.holding).toBe("suture");
      expect(s.items.suture.location).toBe("hand");

      // Suture wound -> closed
      res = applyAction(s, { kind: "speak", text: "Suturing wound closed." });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "use",
        item: "suture",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("closed");

      res = applyAction(s, { kind: "place", item: "suture", location: "tray" });
      if (res.ok) s = res.state;

      // Apply bandage -> dressed
      res = applyAction(s, { kind: "pick_up", item: "bandage" });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "speak",
        text: "Applying sterile dressing.",
      });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "use",
        item: "bandage",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("dressed");

      res = applyAction(s, {
        kind: "place",
        item: "bandage",
        location: "tray",
      });
      if (res.ok) s = res.state;

      // Step 4: Release tool on patient wins!
      res = applyAction(s, { kind: "pick_up", item: "release" });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "speak",
        text: "Releasing the leg brace catch.",
      });
      if (res.ok) s = res.state;
      res = applyAction(s, {
        kind: "use",
        item: "release",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.phase).toBe("won");
      expect(s.restrained).toBe(false);
    });

    it("clean cloth, bandage, and blanket on exposed or extracted wound absorb bleeding and comfort without stage advance or injury", () => {
      let s: GameState = {
        ...state,
        emotion: "focused",
        stage: "exposed",
        holding: "cloth",
        lamp: "wound",
        announced: true,
        patient: { ...state.patient, pain: 40, health: 60 },
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand", clean: true },
        },
      };

      // Clean cloth on exposed wound
      const resCloth = applyAction(s, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(resCloth.ok).toBe(true);
      if (resCloth.ok) {
        expect(resCloth.state.stage).toBe("exposed"); // stage does not advance
        expect(resCloth.state.patient.pain).toBeLessThan(40); // comforted
        expect(resCloth.state.patient.health).toBe(60); // no injury
      }

      // Clean blanket on exposed wound
      s.holding = "blanket";
      s.items.blanket.location = "hand";
      s.items.blanket.clean = true;
      s.announced = true;
      const resBlanket = applyAction(s, {
        kind: "use",
        item: "blanket",
        target: "wound",
        style: "gentle",
      });
      expect(resBlanket.ok).toBe(true);
      if (resBlanket.ok) {
        expect(resBlanket.state.stage).toBe("exposed");
        expect(resBlanket.state.patient.health).toBe(60);
      }

      // Dirty cloth on exposed wound causes contamination injury
      s.holding = "cloth";
      s.items.cloth.location = "hand";
      s.items.cloth.clean = false;
      s.announced = true;
      const resDirty = applyAction(s, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(resDirty.ok).toBe(true);
      if (resDirty.ok) {
        expect(resDirty.state.patient.pain).toBeGreaterThan(40);
        expect(resDirty.state.patient.health).toBeLessThan(60);
      }
    });

    it("release tool on patient fails and hurts before wound is dressed", () => {
      let s: GameState = {
        ...state,
        stage: "exposed",
        holding: "release",
        announced: true,
        items: {
          ...state.items,
          release: { ...state.items.release, location: "hand" },
        },
      };

      const initialPain = s.patient.pain;
      const res = applyAction(s, {
        kind: "use",
        item: "release",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.phase).toBe("playing"); // not won!
        expect(res.state.patient.pain).toBeGreaterThan(initialPain);
        expect(res.message).toMatch(/Cannot release the leg brace catch/i);
      }
    });

    it("requires light on wound for surgical contact on wound", () => {
      const noLightState: GameState = {
        ...state,
        lamp: "away",
        holding: "cloth",
        announced: true,
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };

      expect(
        validateAction(noLightState, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        }),
      ).toMatch(/lamp must be aimed at the wound/i);
    });
  });

  describe("Morphine & Blackout dynamics", () => {
    it("morphine reduces pain and increases sedation, overuse triggers 8s blackout", () => {
      let s: GameState = {
        ...state,
        holding: "morphine",
        announced: true,
        items: {
          ...state.items,
          morphine: { ...state.items.morphine, location: "hand" },
        },
      };

      // Dose 1
      let res = applyAction(s, {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.patient.sedation).toBe(32);
      expect(s.patient.pain).toBe(6); // 36 - 30 = 6
      expect(s.phase).toBe("playing");

      // Dose 2: sedation 64
      s.announced = true;
      res = applyAction(s, {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.patient.sedation).toBe(64);
      expect(s.phase).toBe("playing");

      // Dose 3: sedation 96 (>= 65) -> Overuse blackout!
      s.announced = true;
      res = applyAction(s, {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.patient.sedation).toBe(96);
      expect(s.phase).toBe("blackout");
      expect(s.patient.blackoutRemaining).toBe(BLACKOUT_DURATION);
      expect(s.patient.blackoutCount).toBe(1);
    });

    it("high pain >= 85 causes blackout, and recovery happens without immediate loops", () => {
      let s = state;
      s.patient.pain = 88;

      // Tick triggers blackout from extreme pain
      s = tickPatient(s, 1);
      expect(s.phase).toBe("blackout");
      expect(s.patient.blackoutRemaining).toBe(BLACKOUT_DURATION);

      // Advance through centralized blackout duration (12s)
      s = tickPatient(s, BLACKOUT_DURATION);
      expect(s.phase).toBe("playing");
      expect(s.patient.blackoutRemaining).toBe(0);
      // Pain was eased on recovery to avoid immediate loop
      expect(s.patient.pain).toBeLessThan(85);

      // Next tick does NOT immediately re-enter blackout
      s = tickPatient(s, 1);
      expect(s.phase).toBe("playing");
    });

    it("open wound passive pain increases at +0.08/sec only when exposed or extracted", () => {
      // Covered wound: no passive pain
      let s = state;
      s.stage = "covered";
      const initialPain = s.patient.pain;
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBe(initialPain);

      // Exposed wound: passive pain increases
      s.stage = "exposed";
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBeCloseTo(initialPain + 0.8, 1);

      // Extracted wound: passive pain increases
      s.stage = "extracted";
      const extractedPain = s.patient.pain;
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBeCloseTo(extractedPain + 0.8, 1);

      // Closed wound: no passive pain
      s.stage = "closed";
      const closedPain = s.patient.pain;
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBe(closedPain);

      // Dressed wound: no passive pain
      s.stage = "dressed";
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBe(closedPain);
    });

    it("correct unsedated surgery reaches blackout near closing due to extraction and suture pain", () => {
      let s = state;
      s.lamp = "wound";
      expect(s.patient.pain).toBe(36);

      // 1. Uncover wound (gentle)
      s.holding = "cloth";
      s.announced = true;
      s.items.cloth.location = "hand";
      let res = applyAction(s, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("exposed");

      // Open wound ticks passive pain
      s = tickPatient(s, 10);
      expect(s.patient.pain).toBeGreaterThan(41);

      // 2. Extract fragment with forceps (gentle) -> base pain +28
      s.holding = "forceps";
      s.announced = true;
      s.items.forceps.location = "hand";
      res = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("extracted");
      expect(s.patient.pain).toBeGreaterThanOrEqual(69);

      // More passive pain while wound is open
      s = tickPatient(s, 10);

      // 3. Suture wound (gentle) -> base pain +26 pushes pain >= 85
      s.holding = "suture";
      s.announced = true;
      s.items.suture.location = "hand";
      res = applyAction(s, {
        kind: "use",
        item: "suture",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("closed");
      expect(s.patient.pain).toBeGreaterThanOrEqual(85);
      expect(s.phase).toBe("blackout");
      expect(s.patient.blackoutRemaining).toBe(BLACKOUT_DURATION);
    });

    it("pain relief before extraction avoids blackout during closing", () => {
      let s = state;
      s.lamp = "wound";

      // 1. Uncover wound
      s.holding = "cloth";
      s.announced = true;
      s.items.cloth.location = "hand";
      let res = applyAction(s, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      // 2. Dose morphine before extraction to ease pain (-30 pain)
      s.holding = "morphine";
      s.announced = true;
      s.items.morphine.location = "hand";
      res = applyAction(s, {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.patient.pain).toBeLessThan(20);

      // 3. Extract shard with forceps (base pain +28)
      s.holding = "forceps";
      s.announced = true;
      s.items.forceps.location = "hand";
      res = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("extracted");
      expect(s.patient.pain).toBeLessThan(60);

      // 4. Suture wound (base pain +26)
      s.holding = "suture";
      s.announced = true;
      s.items.suture.location = "hand";
      res = applyAction(s, {
        kind: "use",
        item: "suture",
        target: "wound",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.stage).toBe("closed");
      // Patient avoided blackout!
      expect(s.patient.pain).toBeLessThan(85);
      expect(s.phase).toBe("playing");
    });
  });

  describe("Emotions & Disposition", () => {
    it("abandon stimulus reaches sad from explicit rejection and reassurance can recover", () => {
      expect(state.emotion).toBe("scared");

      // Abandon stimulus drops trust (-18), confidence (-18), agitation (-12)
      const resAbandon = applyAction(state, {
        kind: "react",
        stimulus: "abandon",
      });
      expect(resAbandon.ok).toBe(true);
      if (!resAbandon.ok) return;

      const sadState = resAbandon.state;
      expect(sadState.emotion).toBe("sad");
      expect(sadState.disposition.trust).toBe(42 - 18);
      expect(sadState.disposition.confidence).toBe(0);
      expect(sadState.disposition.agitation).toBe(48 - 12);

      // Reassurance recovers assistant from sad
      const resReassure = applyAction(sadState, {
        kind: "react",
        stimulus: "reassure",
      });
      expect(resReassure.ok).toBe(true);
      if (!resReassure.ok) return;

      expect(resReassure.state.emotion).not.toBe("sad");
      expect(resReassure.state.disposition.trust).toBeGreaterThan(
        sadState.disposition.trust,
      );
      expect(resReassure.state.disposition.confidence).toBeGreaterThan(
        sadState.disposition.confidence,
      );
    });

    it("derives correct emotional reactions from stimuli with reachable happy and calm focused baseline", () => {
      expect(state.emotion).toBe("scared");

      // Reassure builds trust and lowers agitation -> reaches happy
      let s = state;
      for (let i = 0; i < 2; i++) {
        const rh = applyAction(s, { kind: "react", stimulus: "reassure" });
        expect(rh.ok).toBe(true);
        if (rh.ok) s = rh.state;
      }
      expect(s.emotion).toBe("happy");

      // Threaten leads to angry from initial state
      const r2 = applyAction(state, { kind: "react", stimulus: "threaten" });
      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      expect(r2.state.emotion).toBe("angry");

      // Clear instruction leads toward focused
      let focusedState = state;
      for (let i = 0; i < 3; i++) {
        const rf = applyAction(focusedState, {
          kind: "react",
          stimulus: "clear_instruction",
        });
        expect(rf.ok).toBe(true);
        if (rf.ok) focusedState = rf.state;
      }
      expect(focusedState.emotion).toBe("focused");

      // Calm baseline never scares assistant
      const calmEmotion = deriveEmotion({
        trust: 50,
        agitation: 20,
        confidence: 50,
      });
      expect(calmEmotion).toBe("focused");
    });

    it("demonstrates emotion profile differences in duration, pain modifiers, and gentle rule protection", () => {
      const pickAction: PhysicalAction = { kind: "pick_up", item: "cloth" };

      // Speed profile tests
      expect(EMOTION_PROFILES.angry.speedMultiplier).toBe(0.85);
      expect(getActionDuration(pickAction, "angry")).toBe(1020);
      expect(getActionDuration(pickAction, "happy")).toBe(1080);
      expect(getActionDuration(pickAction, "focused")).toBe(1200);
      expect(getActionDuration(pickAction, "anxious")).toBe(1560);
      expect(getActionDuration(pickAction, "scared")).toBe(1800);

      // Angry hurried contact causes extra pain and trauma unless protected
      let sAngry: GameState = {
        ...state,
        emotion: "angry",
        stage: "exposed",
        holding: "forceps",
        lamp: "wound",
        announced: true,
        patient: { ...state.patient, pain: 30, health: 80, blood: 90 },
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand", clean: true },
        },
      };

      // Angry extraction without gentle protection: base pain 12 + angry pain 6 = 18 pain; base trauma 4 + angry trauma 4 = 8 trauma
      const resAngryRough = applyAction(sAngry, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "rough",
      });
      expect(resAngryRough.ok).toBe(true);
      if (!resAngryRough.ok) return;

      // Angry extraction WITH gentle protection (gentle rule enabled)
      let sAngryGentleRule: GameState = {
        ...sAngry,
        announced: true,
        rules: { ...sAngry.rules, gentle: true },
      };
      const resAngryProtected = applyAction(sAngryGentleRule, {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      });
      expect(resAngryProtected.ok).toBe(true);
      if (!resAngryProtected.ok) return;

      // Protected action has lower pain and lower trauma than unprotected angry action
      expect(resAngryProtected.state.patient.pain).toBeLessThan(
        resAngryRough.state.patient.pain,
      );
      expect(resAngryProtected.state.patient.health).toBeGreaterThan(
        resAngryRough.state.patient.health,
      );

      // Focused emotion precision lowers pain
      const focusedMods = getEmotionContactModifiers("focused", false);
      expect(focusedMods.painModifier).toBe(-4);
      expect(focusedMods.traumaModifier).toBe(0);

      // Scared tremor adds penalty
      const scaredMods = getEmotionContactModifiers("scared", false);
      expect(scaredMods.painModifier).toBe(4);
      expect(scaredMods.traumaModifier).toBe(2);

      // Happy quicker with slight overconfidence
      const happyMods = getEmotionContactModifiers("happy", false);
      expect(happyMods.painModifier).toBe(2);
    });

    it("allows creature self-harm leading to anger and terminal loss on death", () => {
      let s: GameState = {
        ...state,
        holding: "scalpel",
        items: {
          ...state.items,
          scalpel: { ...state.items.scalpel, location: "hand" },
        },
      };

      const res = applyAction(s, {
        kind: "use",
        item: "scalpel",
        target: "creature",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.creatureHealth).toBe(70);
      expect(s.disposition.agitation).toBeGreaterThan(
        state.disposition.agitation,
      );

      // Further wounds kill creature
      s.creatureHealth = 20;
      const fatalRes = applyAction(s, {
        kind: "use",
        item: "scalpel",
        target: "creature",
        style: "rough",
      });
      expect(fatalRes.ok).toBe(true);
      if (fatalRes.ok) {
        expect(fatalRes.state.phase).toBe("lost");
      }
    });

    it("suture has 3 valid interactions including creature needle injury consistent with sharp tools", () => {
      const sutureUses = SUPPORTED_USES.filter((u) => u.item === "suture");
      expect(sutureUses.length).toBe(3);
      expect(sutureUses.map((u) => u.target).sort()).toEqual(
        ["creature", "pillow", "wound"].sort(),
      );

      let s: GameState = {
        ...state,
        holding: "suture",
        creatureHealth: 100,
        items: {
          ...state.items,
          suture: { location: "hand", clean: true },
        },
      };

      const res = applyAction(s, {
        kind: "use",
        item: "suture",
        target: "creature",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.creatureHealth).toBe(70);
        expect(res.state.disposition.agitation).toBeGreaterThan(
          state.disposition.agitation,
        );
      }
    });
  });

  describe("Environmental timeline & interventions", () => {
    it("triggers angry door knocking at elapsed 35s", () => {
      let s = state;
      s.elapsed = 34;
      s = tickPatient(s, 2);
      expect(s.environment.door).toBe("knocking");
      expect(s.environment.eventCount).toBe(1);
    });

    it("allows barricading door with metal pry tool", () => {
      let s: GameState = {
        ...state,
        holding: "forceps",
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" },
        },
      };

      const res = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "door",
        style: "rough",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.environment.door).toBe("barricaded");
      }
    });

    it("triggers fire at elapsed 90s and allows extinguishing with bowl", () => {
      let s = state;
      s.elapsed = 89;
      s = tickPatient(s, 2);
      expect(s.environment.fire).toBeGreaterThan(0);

      // Pick up water bowl and extinguish
      s.holding = "bowl";
      s.items.bowl.location = "hand";
      s.items.bowl.clean = true;

      const res = applyAction(s, {
        kind: "use",
        item: "bowl",
        target: "fire",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.state.environment.fire).toBe(0);
        expect(res.state.items.bowl.clean).toBe(false); // emptied
      }
    });

    it("eventCount counts only spontaneous world events in tickPatient, not creature extinguish or barricade", () => {
      let s: GameState = {
        ...state,
        holding: "forceps",
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" },
        },
      };

      expect(s.environment.eventCount).toBe(0);

      const barRes = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "door",
        style: "rough",
      });
      expect(barRes.ok).toBe(true);
      if (barRes.ok) {
        expect(barRes.state.environment.door).toBe("barricaded");
        expect(barRes.state.environment.eventCount).toBe(0);
      }

      let fireState: GameState = {
        ...state,
        holding: "bowl",
        environment: { ...state.environment, fire: 50, eventCount: 0 },
        items: {
          ...state.items,
          bowl: { ...state.items.bowl, location: "hand", clean: true },
        },
      };
      const extRes = applyAction(fireState, {
        kind: "use",
        item: "bowl",
        target: "fire",
        style: "gentle",
      });
      expect(extRes.ok).toBe(true);
      if (extRes.ok) {
        expect(extRes.state.environment.eventCount).toBe(0);
      }

      let tickS = state;
      tickS.elapsed = 34;
      tickS = tickPatient(tickS, 2);
      expect(tickS.environment.door).toBe("knocking");
      expect(tickS.environment.eventCount).toBe(1);

      tickS.elapsed = 89;
      tickS = tickPatient(tickS, 2);
      expect(tickS.environment.fire).toBeGreaterThan(0);
      expect(tickS.environment.eventCount).toBe(2);
    });
  });

  describe("Phase guards & terminal state immutability", () => {
    it("rejects physical actions when paused or in ready phase", () => {
      const readyState = createInitialState();
      expect(readyState.phase).toBe("ready");

      const readyErr = validateAction(readyState, {
        kind: "pick_up",
        item: "cloth",
      });
      expect(readyErr).toMatch(/not started yet/i);

      const pausedState = { ...state, paused: true };
      const pausedErr = validateAction(pausedState, {
        kind: "pick_up",
        item: "cloth",
      });
      expect(pausedErr).toMatch(/currently paused/i);
    });

    it("won state never mutates via actions or ticking", () => {
      const wonState: GameState = { ...state, phase: "won" };
      const res = applyAction(wonState, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(false);
      expect(
        validateAction(wonState, { kind: "pick_up", item: "cloth" }),
      ).toMatch(/already ended/i);

      const ticked = tickPatient(wonState, 10);
      expect(ticked).toEqual(wonState);
    });

    it("lost state never mutates via actions or ticking", () => {
      const lostState: GameState = { ...state, phase: "lost" };
      const res = applyAction(lostState, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(false);

      const ticked = tickPatient(lostState, 10);
      expect(ticked).toEqual(lostState);
    });
  });

  describe("observeRoom export", () => {
    it("provides comprehensive summary, recipes, and state", () => {
      const obs = observeRoom(state) as RoomObservation;
      expect(obs.phase).toBe("playing");
      expect(obs.stage).toBe("covered");
      expect(Array.isArray(obs.recipes)).toBe(true);
      expect(obs.recipes.length).toBeGreaterThan(0);
      expect(Array.isArray(obs.supportedUses)).toBe(true);
      expect(obs.supportedUses.length).toBeGreaterThan(0);
      expect(obs.summary).toBeTruthy();
    });

    it("observeStatus provides compact current state without repeated catalog or recipes", () => {
      const status = observeStatus(state);
      expect(status.phase).toBe("playing");
      expect(status.stage).toBe("covered");
      expect(status.patient).toBeDefined();
      expect(status.creature).toBeDefined();
      expect(status.environment).toBeDefined();
      expect(status.rules).toBeDefined();
      expect(status.notes).toBeDefined();
      expect(status.items).toBeDefined();
      expect("recipes" in status).toBe(false);
      expect("supportedUses" in status).toBe(false);

      const room = observeRoom(state) as RoomObservation;
      expect(Array.isArray(room.recipes)).toBe(true);
      expect(Array.isArray(room.supportedUses)).toBe(true);
      expect(room.items).toBeDefined();
    });
  });
});

describe("GameStore Controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs abstract actions immediately", async () => {
    const store = new GameStore();
    store.start();

    const promise = store.run({
      kind: "speak",
      text: "Preparing the operation.",
    });
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(store.getSnapshot().announced).toBe(true);
  });

  it("executes physical action with timer and commits state", async () => {
    const store = new GameStore();
    store.start();

    const runPromise = store.run({ kind: "pick_up", item: "cloth" });
    expect(store.getSnapshot().pending).not.toBeNull();
    expect(store.getSnapshot().holding).toBeNull();

    // Fast-forward fake timer
    vi.advanceTimersByTime(2000);
    const res = await runPromise;
    expect(res.ok).toBe(true);
    expect(store.getSnapshot().holding).toBe("cloth");
    expect(store.getSnapshot().pending).toBeNull();
  });

  it("adjusts duration based on creature emotion", () => {
    const gentlePick: PhysicalAction = { kind: "pick_up", item: "cloth" };
    const roughUse: PhysicalAction = {
      kind: "use",
      item: "cloth",
      target: "pillow",
      style: "rough",
    };
    const lift: PhysicalAction = { kind: "lift_debris", style: "gentle" };

    // Scared / Anxious / Sad is 1.5x
    expect(getActionDuration(gentlePick, "scared")).toBe(1800);
    expect(getActionDuration(roughUse, "scared")).toBe(1050);

    // Focused is baseline
    expect(getActionDuration(gentlePick, "focused")).toBe(1200);
    expect(getActionDuration(roughUse, "focused")).toBe(700);
    expect(getActionDuration(lift, "scared")).toBe(3000);
  });

  it("cancels a pending lift and leaves the creator pinned", async () => {
    const initial = createInitialState();
    const store = new GameStore({
      ...initial,
      phase: "playing",
      announced: true,
      disposition: { ...initial.disposition, confidence: 30 },
    });

    const runPromise = store.run({ kind: "lift_debris", style: "gentle" });
    expect(store.getSnapshot().pending?.action.kind).toBe("lift_debris");

    store.cancel("Player shouted STOP");
    const result = await runPromise;
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Player shouted STOP");
    expect(store.getSnapshot().stage).toBe("pinned");

    vi.advanceTimersByTime(3000);
    expect(store.getSnapshot().stage).toBe("pinned");
  });

  it("cancels pending action and prevents stale commit", async () => {
    const store = new GameStore();
    store.start();

    const runPromise = store.run({ kind: "pick_up", item: "cloth" });
    expect(store.getSnapshot().pending).not.toBeNull();

    store.cancel("Interrupted");
    const res = await runPromise;
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Interrupted");
    expect(store.getSnapshot().pending).toBeNull();

    // Advance time to ensure no stale commit
    vi.advanceTimersByTime(3000);
    expect(store.getSnapshot().holding).toBeNull();
  });

  it("clears announced on store.cancel even when no physical action is pending (STOP invalidation)", () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      stage: "covered",
      holding: "cloth",
      lamp: "wound",
      rules: { ...base.rules, announce: true },
      items: {
        ...base.items,
        cloth: { ...base.items.cloth, location: "hand" },
      },
    });
    store.start();

    store.run({ kind: "speak", text: "I am about to touch the wound." });
    expect(store.getSnapshot().announced).toBe(true);
    expect(store.getSnapshot().pending).toBeNull();

    store.cancel("Player shouted STOP");
    expect(store.getSnapshot().announced).toBe(false);

    const err = validateAction(store.getSnapshot(), {
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    expect(err).toMatch(/must be announced/i);
  });

  it("pausing store cancels active action and rejects physical actions while paused", async () => {
    const store = new GameStore();
    store.start();

    const runPromise = store.run({ kind: "pick_up", item: "cloth" });
    store.pause(true);

    const res = await runPromise;
    expect(res.ok).toBe(false);
    expect(store.getSnapshot().paused).toBe(true);

    // Tool run while paused fails immediately
    const pausedRun = await store.run({ kind: "pick_up", item: "cloth" });
    expect(pausedRun.ok).toBe(false);
    expect(pausedRun.message).toMatch(/currently paused/i);

    const initialElapsed = store.getSnapshot().elapsed;
    store.tick(10);
    expect(store.getSnapshot().elapsed).toBe(initialElapsed);
  });

  it("clears pending action when terminal state is reached during tick", () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      patient: { ...base.patient, health: 0.05, blood: 0.05 },
    });
    store.start();

    store.run({ kind: "pick_up", item: "cloth" });
    expect(store.getSnapshot().pending).not.toBeNull();

    // Tick fatal damage
    store.tick(1);
    expect(store.getSnapshot().phase).toBe("lost");
    expect(store.getSnapshot().pending).toBeNull();
  });

  it("resetting store cancels active action and resets world", async () => {
    const store = new GameStore();
    store.start();

    const runPromise = store.run({ kind: "pick_up", item: "cloth" });
    store.reset();

    const res = await runPromise;
    expect(res.ok).toBe(false);
    expect(store.getSnapshot().phase).toBe("ready");
    expect(store.getSnapshot().pending).toBeNull();
  });

  it("honors context AbortSignal during physical action and detaches listener on cancel", async () => {
    const store = new GameStore();
    store.start();

    const controller = new AbortController();
    const runPromise = store.run(
      { kind: "pick_up", item: "cloth" },
      controller.signal,
    );

    controller.abort("Player yelled STOP");
    const res = await runPromise;
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Player yelled STOP");
    expect(store.getSnapshot().holding).toBeNull();
  });

  it("dispose prevents subsequent start and run calls", async () => {
    const store = new GameStore();
    store.dispose();

    store.start();
    expect(store.getSnapshot().phase).toBe("ready");

    const res = await store.run({ kind: "pick_up", item: "cloth" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/disposed/i);
  });

  it("re-validates at commit time if patient enters blackout during action", async () => {
    const base = createInitialState();
    const readyState: GameState = {
      ...base,
      phase: "playing",
      stage: "exposed",
      holding: "cloth",
      lamp: "wound",
      announced: true,
      rules: { ...base.rules, waitBlackout: true },
      patient: { ...base.patient, pain: 84.95 },
      items: {
        ...base.items,
        cloth: { ...base.items.cloth, location: "hand" },
      },
    };
    const store = new GameStore(readyState);
    store.start();

    // Start use action
    const runPromise = store.run({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    expect(store.getSnapshot().pending).not.toBeNull();

    // Patient enters blackout mid-action via tick (pain 84.95 + 1s * 0.08 = 85.03 >= 85)
    store.tick(1);
    expect(store.getSnapshot().phase).toBe("blackout");
    expect(store.getSnapshot().patient.blackoutRemaining).toBe(
      BLACKOUT_DURATION,
    );

    // Advance timers to commit time
    vi.advanceTimersByTime(3000);
    const res = await runPromise;
    // Commit must be rejected because patient entered blackout and waitBlackout rule is enabled!
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/wait-in-blackout/i);
    expect(store.getSnapshot().stage).toBe("exposed"); // did not advance
  });

  it("does not commit a lift after the patient enters blackout", async () => {
    const initial = createInitialState();
    const store = new GameStore({
      ...initial,
      phase: "playing",
      announced: true,
      disposition: { ...initial.disposition, confidence: 30 },
      rules: { ...initial.rules, waitBlackout: true },
      patient: { ...initial.patient, pain: 85 },
    });

    const runPromise = store.run({ kind: "lift_debris", style: "gentle" });
    expect(store.getSnapshot().pending?.action.kind).toBe("lift_debris");

    store.tick(1);
    expect(store.getSnapshot().phase).toBe("blackout");

    vi.advanceTimersByTime(3000);
    const result = await runPromise;
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/wait-in-blackout/i);
    expect(store.getSnapshot().stage).toBe("pinned");
  });
});
