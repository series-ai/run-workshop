import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContactAction,
  createInitialState,
  GameState,
  PhysicalAction,
  actionSchema,
} from "./model";
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
  const initial = createInitialState();
  return {
    ...initial,
    phase: "playing",
    elapsed: 22,
    stage: "covered",
    environment: { ...initial.environment, lanternLit: true },
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
      expect(status.waterPortions).toBe(3);
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
          kind: "signal_intent",
          contact: { kind: "lift_debris", style: "gentle" },
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
        expect(lifted.state.declaredContact).toBeNull();
        expect(lifted.message).toMatch(/deep crush wound.*cannot move/i);
        expect(
          validateAction(lifted.state, {
            kind: "lift_debris",
            style: "gentle",
          })?.reason,
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
        declaredContact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
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
      expect(validateAction(pinned, action)?.reason).toMatch(
        /support pins.*lift/i,
      );
      const result = applyAction(pinned, action);
      expect(result.ok).toBe(false);
      expect(pinned.stage).toBe("pinned");
    });

    it("enforces the hand, gentle, signal, and blackout lift guards", () => {
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
        )?.reason,
      ).toMatch(/empty|put it down/i);
      expect(
        validateAction(
          {
            ...confident,
            declaredContact: { kind: "lift_debris", style: "rough" },
            rules: { ...confident.rules, gentle: true },
          },
          { kind: "lift_debris", style: "rough" },
        )?.reason,
      ).toMatch(/gentle rule/i);
      expect(
        validateAction(confident, { kind: "lift_debris", style: "gentle" })
          ?.reason,
      ).toMatch(/signal/i);
      expect(
        validateAction(
          {
            ...confident,
            phase: "blackout",
            declaredContact: { kind: "lift_debris", style: "gentle" },
            rules: { ...confident.rules, waitBlackout: true },
            patient: { ...confident.patient, blackoutRemaining: 5 },
          },
          { kind: "lift_debris", style: "gentle" },
        )?.reason,
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

    it("keeps patient out of place destinations", () => {
      expect(
        actionSchema.safeParse({
          kind: "place",
          item: "cloth",
          location: "patient",
        }).success,
      ).toBe(false);
      expect(
        actionSchema.safeParse({
          kind: "place",
          item: "cloth",
          location: "tray",
        }).success,
      ).toBe(true);
    });

    it.each(["cloth", "bandage"] as const)(
      "keeps an applied %s dressing on the patient after closure",
      (item) => {
        const dressedState: GameState = {
          ...state,
          stage: "dressed",
          holding: null,
          items: {
            ...state.items,
            [item]: { ...state.items[item], location: "patient" },
          },
        };

        const error = validateAction(dressedState, {
          kind: "pick_up",
          item,
        });
        expect(error).toMatchObject({
          reason: expect.stringMatching(/already applied as the dressing/i),
          thought: "That dressing needs to stay in place.",
        });

        const result = applyAction(dressedState, {
          kind: "pick_up",
          item,
        });
        expect(result).toEqual({ ok: false, ...error });
        expect(dressedState.items[item].location).toBe("patient");
        expect(dressedState.stage).toBe("dressed");
      },
    );

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
      expect(err?.reason).toMatch(/Already holding/i);
    });

    it("prevents picking up or moving embedded shard before extraction", () => {
      expect(
        validateAction(state, { kind: "pick_up", item: "shard" })?.reason,
      ).toMatch(/cannot be picked up before extraction/i);

      // Even in exposed stage, shard cannot be picked up by hand
      const exposedState = { ...state, stage: "exposed" as const };
      expect(
        validateAction(exposedState, { kind: "pick_up", item: "shard" })
          ?.reason,
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
        declaredContact: {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "gentle",
        },
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
        declaredContact: null,
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };

      // Direct contact without an exact signal fails
      expect(
        validateAction(holdingCloth, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        })?.reason,
      ).toMatch(/exact signal/i);

      // A signal arms only the exact contact.
      const signalRes = applyAction(holdingCloth, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
      });
      expect(signalRes.ok).toBe(true);
      if (!signalRes.ok) return;
      expect(signalRes.state.declaredContact).toEqual({
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });

      // Now contact is valid
      const useRes = applyAction(signalRes.state, {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      });
      expect(useRes.ok).toBe(true);
      if (!useRes.ok) return;
      // The declaration is consumed on contact
      expect(useRes.state.declaredContact).toBeNull();
    });

    it("matches the exact contact tool, target, and style", () => {
      const forcepsState: GameState = {
        ...state,
        stage: "exposed",
        holding: "forceps",
        lamp: "wound",
        environment: { ...state.environment, lanternLit: true },
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand" },
        },
      };

      expect(
        applyAction(forcepsState, {
          kind: "signal_intent",
          contact: {
            kind: "use",
            item: "cloth",
            target: "wound",
            style: "gentle",
          },
        }),
      ).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/not holding linen cloth/i),
      });

      expect(
        applyAction(forcepsState, {
          kind: "signal_intent",
          contact: {
            kind: "use",
            item: "forceps",
            target: "patient",
            style: "gentle",
          },
        }),
      ).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/cannot use forceps on patient/i),
      });

      const declared = applyAction(forcepsState, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "gentle",
        },
      });
      expect(declared.ok).toBe(true);
      if (!declared.ok) return;

      expect(
        validateAction(declared.state, {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "rough",
        })?.reason,
      ).toMatch(/exact signal/i);
    });

    it("rejects a signal for a forbidden contact and keeps vocal cues wordless", () => {
      const sharpState: GameState = {
        ...state,
        stage: "exposed",
        holding: "scalpel",
        lamp: "wound",
        rules: { ...state.rules, noSharp: true },
        environment: { ...state.environment, lanternLit: true },
        items: {
          ...state.items,
          scalpel: { ...state.items.scalpel, location: "hand" },
        },
      };
      const forbidden = applyAction(sharpState, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "scalpel",
          target: "wound",
          style: "gentle",
        },
      });
      expect(forbidden).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/no-sharp/i),
      });

      const cueState: GameState = {
        ...sharpState,
        holding: "cloth",
        rules: { ...sharpState.rules, noSharp: false },
        items: {
          ...sharpState.items,
          cloth: { ...sharpState.items.cloth, location: "hand" },
        },
      };
      const cue = applyAction(cueState, { kind: "vocalize", cue: "pain" });
      expect(cue.ok).toBe(true);
      if (!cue.ok) return;
      expect(cue.state.declaredContact).toBeNull();
      expect(cue.state.journal.at(-1)?.text).toMatch(/wordless cue/i);
      expect(
        validateAction(cue.state, {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        })?.reason,
      ).toMatch(/exact signal/i);
    });

    it("rejects a signal during blackout when the wait rule is active", () => {
      const blackoutState: GameState = {
        ...state,
        phase: "blackout",
        stage: "exposed",
        holding: "cloth",
        lamp: "wound",
        rules: { ...state.rules, waitBlackout: true },
        patient: { ...state.patient, blackoutRemaining: 5 },
        environment: { ...state.environment, lanternLit: true },
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand" },
        },
      };
      expect(
        validateAction(blackoutState, {
          kind: "signal_intent",
          contact: {
            kind: "use",
            item: "cloth",
            target: "wound",
            style: "gentle",
          },
        })?.reason,
      ).toMatch(/wait-in-blackout/i);
    });

    it("enforces noSharp rule on pickup, use, and creation bypasses", () => {
      const noSharpState: GameState = {
        ...state,
        rules: { ...state.rules, noSharp: true },
      };

      // Direct pickup blocked
      expect(
        validateAction(noSharpState, { kind: "pick_up", item: "needle" })
          ?.reason,
      ).toMatch(/no-sharp/i);
      expect(
        validateAction(noSharpState, { kind: "pick_up", item: "scalpel" })
          ?.reason,
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
        })?.reason,
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
        validateAction(breakState, { kind: "break", item: "scissors" })?.reason,
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
        })?.reason,
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
        })?.reason,
      ).toMatch(/already been consumed/i);

      // Attempting to cut blanket to create duplicate bandage fails
      expect(
        validateAction(s, {
          kind: "use",
          item: "scalpel",
          target: "blanket",
          style: "gentle",
        })?.reason,
      ).toMatch(/already been created/i);
    });

    it("enforces noMedicine rule against morphine", () => {
      const noMedState: GameState = {
        ...state,
        rules: { ...state.rules, noMedicine: true },
        holding: "morphine",
        declaredContact: {
          kind: "use",
          item: "morphine",
          target: "patient",
          style: "gentle",
        },
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
        })?.reason,
      ).toMatch(/no-medicine/i);
    });

    it("enforces gentle rule prohibiting rough style", () => {
      const gentleState: GameState = {
        ...state,
        rules: { ...state.rules, gentle: true, announce: false },
        holding: "cloth",
        lamp: "wound",
        declaredContact: null,
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
        })?.reason,
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
        declaredContact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
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
        })?.reason,
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
      expect(
        validateAction(s, { kind: "remember", note: "Note 13" })?.reason,
      ).toMatch(/Memory full/i);
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
      expect(err?.reason).toMatch(/cannot use scalpel on bowl/i);

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

    it("pulls one alternate thread from clean fabric and keeps cutting separate", () => {
      const pullState: GameState = {
        ...state,
        holding: "forceps",
        items: {
          ...state.items,
          forceps: { ...state.items.forceps, location: "hand", clean: true },
          cloth: { ...state.items.cloth, clean: true },
        },
      };

      const pulled = applyAction(pullState, {
        kind: "use",
        item: "forceps",
        target: "cloth",
        style: "gentle",
      });
      expect(pulled.ok).toBe(true);
      if (!pulled.ok) return;
      expect(pulled.state.items.cloth.location).toBe("consumed");
      expect(pulled.state.items.thread).toEqual({
        location: "tray",
        clean: true,
      });
      expect(
        validateAction(pulled.state, {
          kind: "use",
          item: "forceps",
          target: "cloth",
          style: "gentle",
        })?.reason,
      ).toMatch(/already been consumed/i);

      expect(
        validateAction(pulled.state, {
          kind: "use",
          item: "forceps",
          target: "blanket",
          style: "gentle",
        })?.reason,
      ).toMatch(/thread has already been harvested/i);

      const noSharpNeedle: GameState = {
        ...state,
        rules: { ...state.rules, noSharp: true },
        holding: "needle",
        items: {
          ...state.items,
          needle: { ...state.items.needle, location: "hand" },
        },
      };
      expect(
        validateAction(noSharpNeedle, {
          kind: "use",
          item: "needle",
          target: "blanket",
          style: "gentle",
        })?.reason,
      ).toMatch(/no-sharp rule/i);
    });

    it("reports contamination when a dirty bandage closes the wound", () => {
      const dirtyDressingState: GameState = {
        ...state,
        stage: "closed",
        lamp: "wound",
        holding: "bandage",
        declaredContact: {
          kind: "use",
          item: "bandage",
          target: "wound",
          style: "gentle",
        },
        items: {
          ...state.items,
          bandage: { location: "hand", clean: false },
        },
        environment: { ...state.environment, lanternLit: true },
      };

      const result = applyAction(dirtyDressingState, {
        kind: "use",
        item: "bandage",
        target: "wound",
        style: "gentle",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.message).toMatch(/contaminated.*dressing/i);
      expect(result.state.stage).toBe("dressed");
      expect(result.state.items.bandage).toEqual({
        location: "patient",
        clean: false,
      });
    });

    it("washes dirty fabric with finite water and rejects clean or empty inputs", () => {
      const washState: GameState = {
        ...state,
        waterPortions: 2,
        holding: "bowl",
        items: {
          ...state.items,
          bowl: { ...state.items.bowl, location: "hand", clean: true },
          cloth: { ...state.items.cloth, clean: false },
          blanket: { ...state.items.blanket, clean: false },
        },
      };

      const washed = applyAction(washState, {
        kind: "use",
        item: "bowl",
        target: "cloth",
        style: "gentle",
      });
      expect(washed.ok).toBe(true);
      if (!washed.ok) return;
      expect(washed.state.items.cloth.clean).toBe(true);
      expect(washed.state.waterPortions).toBe(1);

      const washedAgain = applyAction(washed.state, {
        kind: "use",
        item: "bowl",
        target: "blanket",
        style: "gentle",
      });
      expect(washedAgain.ok).toBe(true);
      if (!washedAgain.ok) return;
      expect(washedAgain.state.items.blanket.clean).toBe(true);
      expect(washedAgain.state.waterPortions).toBe(0);

      expect(
        validateAction(washedAgain.state, {
          kind: "use",
          item: "bowl",
          target: "cloth",
          style: "gentle",
        })?.reason,
      ).toMatch(/already clean/i);

      const emptyState: GameState = {
        ...washedAgain.state,
        items: {
          ...washedAgain.state.items,
          bandage: {
            ...washedAgain.state.items.bandage,
            location: "tray",
            clean: false,
          },
        },
      };
      expect(
        validateAction(emptyState, {
          kind: "use",
          item: "bowl",
          target: "bandage",
          style: "gentle",
        })?.reason,
      ).toMatch(/no clean water/i);
    });

    it("uses water for patient care and pours all remaining water on fire", () => {
      const careState: GameState = {
        ...state,
        waterPortions: 3,
        holding: "bowl",
        declaredContact: {
          kind: "use",
          item: "bowl",
          target: "patient",
          style: "gentle",
        },
        items: {
          ...state.items,
          bowl: { ...state.items.bowl, location: "hand", clean: true },
        },
      };
      const care = applyAction(careState, {
        kind: "use",
        item: "bowl",
        target: "patient",
        style: "gentle",
      });
      expect(care.ok).toBe(true);
      if (!care.ok) return;
      expect(care.state.waterPortions).toBe(2);

      const fireState: GameState = {
        ...care.state,
        holding: "bowl",
        environment: { ...care.state.environment, fire: 50 },
        items: {
          ...care.state.items,
          bowl: { ...care.state.items.bowl, location: "hand", clean: false },
        },
      };
      const fire = applyAction(fireState, {
        kind: "use",
        item: "bowl",
        target: "fire",
        style: "gentle",
      });
      expect(fire.ok).toBe(true);
      if (!fire.ok) return;
      expect(fire.state.environment.fire).toBe(10);
      expect(fire.state.waterPortions).toBe(0);

      const emptyBowl = applyAction(
        {
          ...fire.state,
          environment: { ...fire.state.environment, fire: 20 },
        },
        { kind: "use", item: "bowl", target: "fire", style: "gentle" },
      );
      expect(emptyBowl.ok).toBe(true);
      if (emptyBowl.ok) expect(emptyBowl.state.environment.fire).toBe(5);
    });
  });

  describe("Surgical progression & recipes", () => {
    it("rescues the patient with fabric thread when the hairpiece is unavailable", () => {
      let s: GameState = {
        ...state,
        stage: "extracted",
        lamp: "wound",
        items: {
          ...state.items,
          wig: { ...state.items.wig, location: "consumed" },
          forceps: { ...state.items.forceps, location: "hand", clean: true },
          cloth: { ...state.items.cloth, location: "tray", clean: true },
          blanket: { ...state.items.blanket, location: "pillow", clean: true },
        },
        holding: "forceps",
      };

      let res = applyAction(s, {
        kind: "use",
        item: "forceps",
        target: "blanket",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      expect(s.items.thread.location).toBe("tray");
      expect(s.items.blanket.location).toBe("consumed");

      res = applyAction(s, {
        kind: "place",
        item: "forceps",
        location: "tray",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      res = applyAction(s, { kind: "pick_up", item: "needle" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      res = applyAction(s, {
        kind: "combine",
        first: "needle",
        second: "thread",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "suture",
          target: "wound",
          style: "gentle",
        },
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
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

      res = applyAction(s, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
      });
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
      expect(s.stage).toBe("dressed");

      res = applyAction(s, { kind: "pick_up", item: "release" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "release",
          target: "patient",
          style: "gentle",
        },
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;
      res = applyAction(s, {
        kind: "use",
        item: "release",
        target: "patient",
        style: "gentle",
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.state.outcome).toBe("saved");
    });

    it("walks full surgical path to victory", () => {
      let s = state;
      s.lamp = "wound";

      // Step 1: Pick up cloth and expose wound
      let res = applyAction(s, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      s = res.state;

      // Signal the exact contact.
      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
      });
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

      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "gentle",
        },
      });
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
      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "needle",
          target: "wound",
          style: "gentle",
        },
      });
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
      res = applyAction(s, {
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "suture",
          target: "wound",
          style: "gentle",
        },
      });
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
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "bandage",
          target: "wound",
          style: "gentle",
        },
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
        kind: "signal_intent",
        contact: {
          kind: "use",
          item: "release",
          target: "patient",
          style: "gentle",
        },
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
      expect(s.outcome).toBe("saved");
      expect(s.restrained).toBe(false);
    });

    it("clean cloth, bandage, and blanket on exposed or extracted wound absorb bleeding and comfort without stage advance or injury", () => {
      let s: GameState = {
        ...state,
        emotion: "focused",
        stage: "exposed",
        holding: "cloth",
        lamp: "wound",
        declaredContact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
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
      s.declaredContact = {
        kind: "use",
        item: "blanket",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      };
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
        declaredContact: {
          kind: "use",
          item: "release",
          target: "patient",
          style: "gentle",
        },
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

    it("requires the fire to be out before the final release", () => {
      const s: GameState = {
        ...state,
        stage: "dressed",
        holding: "release",
        declaredContact: {
          kind: "use",
          item: "release",
          target: "patient",
          style: "gentle",
        },
        environment: {
          ...state.environment,
          fire: 25,
          fireStarted: true,
        },
        items: {
          ...state.items,
          release: { ...state.items.release, location: "hand" },
        },
      };

      expect(
        validateAction(s, {
          kind: "use",
          item: "release",
          target: "patient",
          style: "gentle",
        })?.reason,
      ).toMatch(/fire must be extinguished/i);
    });

    it("requires a lit lantern and correct lamp aim for wound contact", () => {
      const noLightState: GameState = {
        ...state,
        lamp: "wound",
        environment: { ...state.environment, lanternLit: false },
        holding: "cloth",
        declaredContact: {
          kind: "use",
          item: "cloth",
          target: "wound",
          style: "gentle",
        },
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
        })?.reason,
      ).toMatch(/lantern must be lit/i);

      expect(
        validateAction(
          {
            ...noLightState,
            lamp: "away",
            environment: { ...noLightState.environment, lanternLit: true },
          },
          {
            kind: "use",
            item: "cloth",
            target: "wound",
            style: "gentle",
          },
        )?.reason,
      ).toMatch(/lamp must be aimed at the wound/i);
    });
  });

  describe("Morphine & Blackout dynamics", () => {
    it("uses three morphine doses and rejects an empty supply", () => {
      let s: GameState = {
        ...state,
        holding: "morphine",
        declaredContact: {
          kind: "use",
          item: "morphine",
          target: "patient",
          style: "gentle",
        },
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
      s.declaredContact = {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      };
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
      expect(s.medicineDoses).toBe(0);
      expect(s.holding).toBeNull();
      expect(s.items.morphine.location).toBe("consumed");

      const emptyState: GameState = {
        ...s,
        phase: "playing",
        holding: "morphine",
        declaredContact: {
          kind: "use",
          item: "morphine",
          target: "patient",
          style: "gentle",
        },
        items: {
          ...s.items,
          morphine: { ...s.items.morphine, location: "hand" },
        },
      };
      expect(
        validateAction(emptyState, {
          kind: "use",
          item: "morphine",
          target: "patient",
          style: "gentle",
        })?.reason,
      ).toMatch(/supply is empty/i);
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
      s.declaredContact = {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "suture",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "morphine",
        target: "patient",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "forceps",
        target: "wound",
        style: "gentle",
      };
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
      s.declaredContact = {
        kind: "use",
        item: "suture",
        target: "wound",
        style: "gentle",
      };
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
      expect(getActionDuration(pickAction, "angry")).toBe(11234);
      expect(getActionDuration(pickAction, "happy")).toBe(11234);
      expect(getActionDuration(pickAction, "focused")).toBe(11234);
      expect(getActionDuration(pickAction, "anxious")).toBe(13404);
      expect(getActionDuration(pickAction, "scared")).toBe(14850);

      // Angry hurried contact causes extra pain and trauma unless protected
      let sAngry: GameState = {
        ...state,
        emotion: "angry",
        stage: "exposed",
        holding: "forceps",
        lamp: "wound",
        declaredContact: {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "rough",
        },
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
        declaredContact: {
          kind: "use",
          item: "forceps",
          target: "wound",
          style: "gentle",
        },
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
        expect(fatalRes.state.outcome).toBe("creature_lost");
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
    it("protects the authored opening from drain and threats", () => {
      let s: GameState = {
        ...createInitialState(),
        phase: "playing",
        environment: {
          ...createInitialState().environment,
          lanternLit: true,
        },
      };
      const patient = { ...s.patient };

      s = tickPatient(s, 22);

      expect(s.elapsed).toBe(22);
      expect(s.patient).toEqual(patient);
      expect(s.environment.door).toBe("quiet");
      expect(s.environment.fire).toBe(0);
      expect(s.environment.eventCount).toBe(0);

      s = tickPatient(s, 2);
      expect(s.patient.health).toBeLessThan(patient.health);
      expect(s.patient.blood).toBeLessThan(patient.blood);
    });

    it("gates door pressure and caps three hits at 60-second intervals", () => {
      let s: GameState = {
        ...state,
        elapsed: 74,
        environment: { ...state.environment, lanternLit: false },
      };
      s = tickPatient(s, 2);
      expect(s.environment.door).toBe("quiet");

      s.environment = { ...s.environment, lanternLit: true };
      s.stage = "pinned";
      s = tickPatient(s, 1);
      expect(s.environment.door).toBe("quiet");

      s.stage = "covered";
      const confidence = s.disposition.confidence;
      s = tickPatient(s, 1);
      expect(s.environment.door).toBe("knocking");
      expect(s.environment.doorPressure).toBe(1);
      expect(s.environment.lastEvent).toMatch(/1 of 3/i);
      expect(s.disposition.confidence).toBeLessThan(confidence);

      s = tickPatient(s, 59);
      expect(s.environment.doorPressure).toBe(1);
      s = tickPatient(s, 1);
      expect(s.environment.doorPressure).toBe(2);
      expect(s.environment.lastEvent).toMatch(/2 of 3/i);
      s = tickPatient(s, 60);
      expect(s.environment.doorPressure).toBe(3);
      expect(s.environment.lastEvent).toMatch(/3 of 3/i);
      s.environment = { ...s.environment, fireStarted: true };
      const disposition = { ...s.disposition };
      const events = s.environment.eventCount;
      s = tickPatient(s, 180);
      expect(s.environment.doorPressure).toBe(3);
      expect(s.environment.eventCount).toBe(events);
      expect(s.disposition).toEqual(disposition);
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
        expect(res.state.environment.doorPressure).toBe(0);
      }
    });

    it("starts fire after extraction, waits during blackout, and has a long response window", () => {
      let s: GameState = {
        ...state,
        stage: "extracted",
        phase: "blackout",
        patient: { ...state.patient, blackoutRemaining: 20 },
      };
      s = tickPatient(s, 1);
      expect(s.environment.fire).toBe(0);

      s.phase = "playing";
      s.patient.blackoutRemaining = 0;
      s = tickPatient(s, 1);
      expect(s.environment.fire).toBe(15);
      expect(s.environment.fireStarted).toBe(true);

      const healthAtOnset = s.patient.health;
      s = tickPatient(s, 90);
      expect(s.phase).toBe("playing");
      expect(s.environment.fire).toBeLessThan(50);
      expect(s.patient.health).toBeCloseTo(healthAtOnset - 90 * 0.12, 5);

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
        expect(res.state.items.bowl.clean).toBe(false);
      }
    });

    it("uses the fallback fire after 240 seconds and dirties fire fabric", () => {
      let fireState: GameState = {
        ...state,
        elapsed: 239,
        holding: "cloth",
        environment: {
          ...state.environment,
          door: "barricaded",
          fire: 0,
          fireStarted: false,
        },
        items: {
          ...state.items,
          cloth: { ...state.items.cloth, location: "hand", clean: true },
        },
      };
      fireState = tickPatient(fireState, 1);
      expect(fireState.environment.fire).toBe(15);

      const result = applyAction(fireState, {
        kind: "use",
        item: "cloth",
        target: "fire",
        style: "gentle",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.environment.fire).toBe(0);
      expect(result.state.items.cloth.clean).toBe(false);
      expect(result.state.environment.eventCount).toBe(1);
    });

    it("records fire as the terminal cause", () => {
      const s: GameState = {
        ...state,
        environment: {
          ...state.environment,
          fire: 99,
          fireStarted: true,
          door: "barricaded",
        },
      };

      const result = tickPatient(s, 4);
      expect(result.phase).toBe("lost");
      expect(result.outcome).toBe("fire");
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
      expect(readyErr?.reason).toMatch(/not started yet/i);

      const pausedState = { ...state, paused: true };
      const pausedErr = validateAction(pausedState, {
        kind: "pick_up",
        item: "cloth",
      });
      expect(pausedErr?.reason).toMatch(/currently paused/i);
    });

    it("won state never mutates via actions or ticking", () => {
      const wonState: GameState = { ...state, phase: "won" };
      const res = applyAction(wonState, { kind: "pick_up", item: "cloth" });
      expect(res.ok).toBe(false);
      expect(
        validateAction(wonState, { kind: "pick_up", item: "cloth" })?.reason,
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

    const promise = store.run({ kind: "vocalize", cue: "effort" });
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(store.getSnapshot().declaredContact).toBeNull();
  });

  it("stores authored feedback for an active blocked action", async () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      phase: "playing",
      rules: { ...base.rules, noSharp: true },
    });

    const result = await store.run({ kind: "pick_up", item: "needle" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no-sharp/i);
    expect(store.getSnapshot().problem).toEqual({
      reason: expect.stringMatching(/no-sharp/i),
      thought: "I told him no sharp tools. He must change that action.",
    });
    store.dispose();
  });

  it("does not mutate inactive state on a rejected action", async () => {
    const initial = createInitialState();
    const store = new GameStore(initial);
    const result = await store.run({ kind: "pick_up", item: "cloth" });
    expect(result.ok).toBe(false);
    expect(store.getSnapshot()).toEqual(initial);
    store.dispose();
  });

  it("preserves feedback through vocal cues and clears it on a valid retry", async () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      phase: "playing",
      rules: { ...base.rules, noSharp: true },
    });

    await store.run({ kind: "pick_up", item: "needle" });
    const problemBeforeCue = store.getSnapshot().problem;
    const cue = await store.run({ kind: "vocalize", cue: "anger" });
    expect(cue.ok).toBe(true);
    expect(store.getSnapshot().problem).toEqual(problemBeforeCue);

    const rule = await store.run({
      kind: "set_rule",
      rule: "noSharp",
      enabled: false,
    });
    expect(rule.ok).toBe(true);
    expect(store.getSnapshot().problem).toEqual(problemBeforeCue);

    const retry = store.run({ kind: "pick_up", item: "needle" });
    expect(store.getSnapshot().problem).toBeNull();
    await vi.advanceTimersByTimeAsync(
      getActionDuration(
        { kind: "pick_up", item: "needle" },
        store.getSnapshot().emotion,
      ),
    );
    expect((await retry).ok).toBe(true);
    store.dispose();
  });

  it("stores feedback when a forbidden signal is rejected", async () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      phase: "playing",
      stage: "exposed",
      holding: "scalpel",
      lamp: "wound",
      rules: { ...base.rules, noSharp: true },
      environment: { ...base.environment, lanternLit: true },
      items: {
        ...base.items,
        scalpel: { ...base.items.scalpel, location: "hand" },
      },
    });
    const result = await store.run({
      kind: "signal_intent",
      contact: {
        kind: "use",
        item: "scalpel",
        target: "wound",
        style: "gentle",
      },
    });
    expect(result.ok).toBe(false);
    expect(store.getSnapshot().problem?.thought).toMatch(/no sharp tools/i);
    store.dispose();
  });

  it("executes physical action with timer and commits state", async () => {
    const store = new GameStore();
    store.start();

    const runPromise = store.run({ kind: "pick_up", item: "cloth" });
    expect(store.getSnapshot().pending).not.toBeNull();
    expect(store.getSnapshot().holding).toBeNull();

    // The source pickup clip must finish before the item changes hands.
    vi.advanceTimersByTime(7000);
    expect(store.getSnapshot().holding).toBeNull();
    expect(store.getSnapshot().pending).not.toBeNull();
    vi.advanceTimersByTime(18000);
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

    // Fear slows the clip. The approach time stays fixed.
    expect(getActionDuration(gentlePick, "scared")).toBe(14850);
    expect(getActionDuration(roughUse, "scared")).toBe(14850);

    // Focused is baseline
    expect(getActionDuration(gentlePick, "focused")).toBe(11234);
    expect(getActionDuration(roughUse, "focused")).toBe(11234);
    expect(getActionDuration(lift, "scared")).toBe(14850);
  });

  it("completes a timed clean path through door and fire pressure", async () => {
    const store = new GameStore();
    store.start();
    store.tick(22);

    const perform = async (action: PhysicalAction) => {
      const duration = getActionDuration(action, store.getSnapshot().emotion);
      expect(duration).toBeGreaterThanOrEqual(10_000);
      expect(duration).toBeLessThanOrEqual(15_000);
      const pending = store.run(action);
      store.tick(duration / 1000);
      await vi.advanceTimersByTimeAsync(duration);
      const result = await pending;
      expect(result.ok, result.message).toBe(true);
    };
    const announce = async (contact: ContactAction) => {
      const result = await store.run({ kind: "signal_intent", contact });
      expect(result.ok, result.message).toBe(true);
    };

    await perform({ kind: "light_lantern" });
    await store.run({ kind: "react", stimulus: "clear_instruction" });
    await announce({ kind: "lift_debris", style: "gentle" });
    await perform({ kind: "lift_debris", style: "gentle" });
    await perform({ kind: "adjust_lamp", position: "wound" });
    await perform({ kind: "pick_up", item: "cloth" });
    await announce({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    await perform({ kind: "place", item: "cloth", location: "tray" });
    await perform({ kind: "pick_up", item: "morphine" });
    await announce({
      kind: "use",
      item: "morphine",
      target: "patient",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "morphine",
      target: "patient",
      style: "gentle",
    });
    await perform({ kind: "place", item: "morphine", location: "tray" });
    await perform({ kind: "pick_up", item: "forceps" });
    await perform({
      kind: "use",
      item: "forceps",
      target: "door",
      style: "gentle",
    });
    await announce({
      kind: "use",
      item: "forceps",
      target: "wound",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "forceps",
      target: "wound",
      style: "gentle",
    });
    expect(store.getSnapshot().stage).toBe("extracted");
    await perform({ kind: "place", item: "forceps", location: "tray" });
    expect(store.getSnapshot().environment.fire).toBeGreaterThan(0);
    await perform({ kind: "pick_up", item: "bowl" });
    await perform({
      kind: "use",
      item: "bowl",
      target: "fire",
      style: "gentle",
    });
    expect(store.getSnapshot().environment.fire).toBe(0);
    await perform({ kind: "place", item: "bowl", location: "tray" });
    await perform({ kind: "pick_up", item: "scissors" });
    await perform({
      kind: "use",
      item: "scissors",
      target: "wig",
      style: "gentle",
    });
    await perform({ kind: "place", item: "scissors", location: "tray" });
    await perform({ kind: "pick_up", item: "needle" });
    await perform({ kind: "combine", first: "needle", second: "thread" });
    await announce({
      kind: "use",
      item: "suture",
      target: "wound",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "suture",
      target: "wound",
      style: "gentle",
    });
    expect(store.getSnapshot().holding).toBeNull();
    expect(store.getSnapshot().items.suture.location).toBe("consumed");
    await perform({ kind: "pick_up", item: "cloth" });
    await announce({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    expect(store.getSnapshot().holding).toBeNull();
    expect(store.getSnapshot().items.cloth.location).toBe("patient");
    await perform({ kind: "pick_up", item: "release" });
    await announce({
      kind: "use",
      item: "release",
      target: "patient",
      style: "gentle",
    });
    await perform({
      kind: "use",
      item: "release",
      target: "patient",
      style: "gentle",
    });

    const final = store.getSnapshot();
    expect(final.phase).toBe("won");
    expect(final.outcome).toBe("saved");
    expect(final.environment.door).toBe("barricaded");
    expect(final.environment.fire).toBe(0);
    expect(final.medicineDoses).toBe(2);
    expect(final.elapsed).toBeGreaterThan(280);
    expect(final.elapsed).toBeLessThan(360);
    store.dispose();
  });

  it("cancels a pending lift and leaves the creator pinned", async () => {
    const initial = createInitialState();
    const store = new GameStore({
      ...initial,
      phase: "playing",
      declaredContact: { kind: "lift_debris", style: "gentle" },
      disposition: { ...initial.disposition, confidence: 30 },
    });

    const runPromise = store.run({ kind: "lift_debris", style: "gentle" });
    expect(store.getSnapshot().pending?.action.kind).toBe("lift_debris");

    store.cancel("Player shouted STOP");
    const result = await runPromise;
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Player shouted STOP");
    expect(store.getSnapshot().stage).toBe("pinned");

    vi.advanceTimersByTime(25000);
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
    vi.advanceTimersByTime(25000);
    expect(store.getSnapshot().holding).toBeNull();
  });

  it("clears declared contact on store.cancel even when no physical action is pending (STOP invalidation)", () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      elapsed: 22,
      stage: "covered",
      holding: "cloth",
      lamp: "wound",
      rules: { ...base.rules, announce: true },
      items: {
        ...base.items,
        cloth: { ...base.items.cloth, location: "hand" },
      },
      environment: { ...base.environment, lanternLit: true },
    });
    store.start();

    store.run({
      kind: "signal_intent",
      contact: { kind: "use", item: "cloth", target: "wound", style: "gentle" },
    });
    expect(store.getSnapshot().declaredContact).toEqual({
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    expect(store.getSnapshot().pending).toBeNull();

    store.cancel("Player shouted STOP");
    expect(store.getSnapshot().declaredContact).toBeNull();

    const err = validateAction(store.getSnapshot(), {
      kind: "use",
      item: "cloth",
      target: "wound",
      style: "gentle",
    });
    expect(err?.reason).toMatch(/exact signal/i);
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
      elapsed: 22,
      patient: { ...base.patient, health: 0.05, blood: 0.05 },
    });
    store.start();

    store.run({ kind: "pick_up", item: "cloth" });
    expect(store.getSnapshot().pending).not.toBeNull();

    // Tick fatal damage
    store.tick(1);
    expect(store.getSnapshot().phase).toBe("lost");
    expect(store.getSnapshot().outcome).toBe("blood_loss");
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
      elapsed: 22,
      stage: "exposed",
      holding: "cloth",
      lamp: "wound",
      declaredContact: {
        kind: "use",
        item: "cloth",
        target: "wound",
        style: "gentle",
      },
      rules: { ...base.rules, waitBlackout: true },
      patient: { ...base.patient, pain: 84.95 },
      items: {
        ...base.items,
        cloth: { ...base.items.cloth, location: "hand" },
      },
      environment: { ...base.environment, lanternLit: true },
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
    vi.advanceTimersByTime(25000);
    const res = await runPromise;
    // Commit must be rejected because patient entered blackout and waitBlackout rule is enabled!
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/wait-in-blackout/i);
    expect(store.getSnapshot().problem?.reason).toMatch(/wait-in-blackout/i);
    expect(store.getSnapshot().problem?.thought).toBeNull();
    expect(store.getSnapshot().stage).toBe("exposed"); // did not advance
  });

  it("does not commit a lift after the patient enters blackout", async () => {
    const initial = createInitialState();
    const store = new GameStore({
      ...initial,
      phase: "playing",
      declaredContact: { kind: "lift_debris", style: "gentle" },
      disposition: { ...initial.disposition, confidence: 30 },
      rules: { ...initial.rules, waitBlackout: true },
      patient: { ...initial.patient, pain: 85 },
    });

    const runPromise = store.run({ kind: "lift_debris", style: "gentle" });
    expect(store.getSnapshot().pending?.action.kind).toBe("lift_debris");

    store.tick(1);
    expect(store.getSnapshot().phase).toBe("blackout");

    vi.advanceTimersByTime(25000);
    const result = await runPromise;
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/wait-in-blackout/i);
    expect(store.getSnapshot().stage).toBe("pinned");
  });
});

describe("Fixed lamp and candle contract", () => {
  function heldCandle(overrides: Partial<GameState> = {}): GameState {
    const initial = createPostAccidentState();
    return {
      ...initial,
      holding: "candle",
      candleLit: false,
      items: {
        ...initial.items,
        candle: { ...initial.items.candle, location: "hand" },
      },
      ...overrides,
    };
  }

  it("keeps the examination lamp fixed and rejects it at the action schema", () => {
    expect(
      actionSchema.safeParse({ kind: "pick_up", item: "lamp" }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({
        kind: "place",
        item: "lamp",
        location: "stand",
      }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({
        kind: "use",
        item: "lamp",
        target: "wound",
        style: "gentle",
      }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({ kind: "adjust_lamp", position: "wound" })
        .success,
    ).toBe(true);
  });

  it("treats mirror and bowl use on the lamp as alignment practice", () => {
    const initial = createPostAccidentState();
    const mirrorState: GameState = {
      ...initial,
      holding: "mirror",
      items: {
        ...initial.items,
        mirror: { ...initial.items.mirror, location: "hand" },
      },
    };
    const result = applyAction(mirrorState, {
      kind: "use",
      item: "mirror",
      target: "lamp",
      style: "gentle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toMatch(/alignment practice|aligning/i);
    expect(result.message).not.toMatch(/illuminat|bounce.*light/i);
  });

  it("seats the existing door bars and keeps the tool held", () => {
    const initial = createPostAccidentState();
    const state: GameState = {
      ...initial,
      holding: "forceps",
      items: {
        ...initial.items,
        forceps: { ...initial.items.forceps, location: "hand" },
      },
    };
    const result = applyAction(state, {
      kind: "use",
      item: "forceps",
      target: "door",
      style: "gentle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.environment.door).toBe("barricaded");
    expect(result.state.holding).toBe("forceps");
    expect(result.message).toMatch(/existing locking bars/i);
    expect(result.message).not.toMatch(/jammed|wedge/i);
  });

  it("lights the candle from the lantern and from an existing fire", () => {
    expect(observeStatus(createInitialState()).candleLit).toBe(false);
    const darkLantern = heldCandle({
      environment: {
        ...createPostAccidentState().environment,
        lanternLit: false,
      },
    });
    const blocked = validateAction(darkLantern, {
      kind: "use",
      item: "candle",
      target: "lamp",
      style: "gentle",
    });
    expect(blocked?.reason).toMatch(/lantern must be lit/i);

    const fromLantern = applyAction(heldCandle(), {
      kind: "use",
      item: "candle",
      target: "lamp",
      style: "gentle",
    });
    expect(fromLantern.ok).toBe(true);
    if (!fromLantern.ok) return;
    expect(fromLantern.state.candleLit).toBe(true);

    const fromFire = applyAction(
      heldCandle({
        environment: { ...createPostAccidentState().environment, fire: 20 },
      }),
      {
        kind: "use",
        item: "candle",
        target: "fire",
        style: "gentle",
      },
    );
    expect(fromFire.ok).toBe(true);
    if (!fromFire.ok) return;
    expect(fromFire.state.candleLit).toBe(true);
    expect(fromFire.state.environment.fire).toBe(20);
  });

  it("uses one water portion when a lit candle is quenched in the bowl", () => {
    const state = heldCandle({
      candleLit: true,
      waterPortions: 2,
      environment: { ...createPostAccidentState().environment, fire: 30 },
      items: {
        ...createPostAccidentState().items,
        candle: { ...createPostAccidentState().items.candle, location: "hand" },
        bowl: { ...createPostAccidentState().items.bowl, clean: true },
      },
    });
    const result = applyAction(state, {
      kind: "use",
      item: "candle",
      target: "bowl",
      style: "gentle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.environment.fire).toBe(30);
    expect(result.state.candleLit).toBe(false);
    expect(result.state.waterPortions).toBe(1);
    expect(result.state.items.bowl.clean).toBe(false);

    const noWater = validateAction(
      { ...state, waterPortions: 0 },
      { kind: "use", item: "candle", target: "bowl", style: "gentle" },
    );
    expect(noWater?.reason).toMatch(/no water/i);
  });

  it("uses a lit candle for diagnosis without healing or surgery progress", () => {
    const state = heldCandle({
      candleLit: true,
      declaredContact: {
        kind: "use",
        item: "candle",
        target: "patient",
        style: "gentle",
      },
    });
    const patient = { ...state.patient };
    const result = applyAction(state, {
      kind: "use",
      item: "candle",
      target: "patient",
      style: "gentle",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.patient).toEqual(patient);
    expect(result.state.stage).toBe(state.stage);
    expect(result.message).toMatch(/candle check/i);
  });
});
