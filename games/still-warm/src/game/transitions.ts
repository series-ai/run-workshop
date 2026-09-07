import {
  ActionResult,
  appendJournal,
  CATALOG,
  GameAction,
  GameState,
  isActive,
  ItemId,
} from "./model";
import {
  hasCapability,
  isCuttingTool,
  isPryTool,
  isSmotherTool,
  isSupportedUse,
  RECIPES,
  SUPPORTED_USES,
  UseTarget,
} from "./affordances";
import {
  applyStimulus,
  deriveEmotion,
  getEmotionContactModifiers,
} from "./emotions";

export const BLACKOUT_DURATION = 12;
export const LIFT_CONFIDENCE_THRESHOLD = 24;

function isPhysicalActionKind(kind: GameAction["kind"]): boolean {
  return (
    kind === "light_lantern" ||
    kind === "lift_debris" ||
    kind === "pick_up" ||
    kind === "place" ||
    kind === "use" ||
    kind === "combine" ||
    kind === "break" ||
    kind === "adjust_lamp"
  );
}

export function validateAction(
  state: GameState,
  action: GameAction,
): string | null {
  if (state.phase === "won" || state.phase === "lost") {
    return "The operation has already ended.";
  }

  if (state.paused) {
    return "The operation is currently paused.";
  }

  if (state.phase === "ready" && isPhysicalActionKind(action.kind)) {
    return "The operation has not started yet. Call start() before performing physical actions.";
  }

  switch (action.kind) {
    case "light_lantern":
      return state.environment.lanternLit
        ? "The workbench lantern is already lit."
        : null;
    case "lift_debris": {
      if (state.stage !== "pinned") {
        return "The fallen ceiling support has already been removed.";
      }
      if (state.holding !== null) {
        return `Your hand is holding ${CATALOG[state.holding].name.toLowerCase()}. Put it down before lifting the ceiling support.`;
      }
      if (state.rules.gentle && action.style === "rough") {
        return "Rough lifting is forbidden under the gentle rule.";
      }
      if (
        state.rules.waitBlackout &&
        (state.phase === "blackout" || state.patient.blackoutRemaining > 0)
      ) {
        return "Patient is unconscious and wait-in-blackout rule is active.";
      }
      if (state.disposition.confidence < LIFT_CONFIDENCE_THRESHOLD) {
        return "I am too afraid to lift the fallen ceiling support. Reassure me or give me a clear instruction first.";
      }
      if (state.rules.announce && !state.announced) {
        return "Lifting the support must be announced before proceeding.";
      }
      return null;
    }

    case "pick_up": {
      if (state.holding !== null) {
        return `Already holding ${CATALOG[state.holding].name.toLowerCase()}. Place it down before picking up another tool.`;
      }
      const itemState = state.items[action.item];
      if (!itemState || itemState.location === "consumed") {
        return `${CATALOG[action.item].name} is not available.`;
      }
      if (itemState.location === "hand") {
        return `Already holding ${CATALOG[action.item].name.toLowerCase()}.`;
      }
      if (
        action.item === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return "The metal shard is deeply embedded in the wound and cannot be picked up before extraction.";
      }
      if (state.rules.noSharp && CATALOG[action.item].sharp) {
        return `Cannot pick up sharp tool ${CATALOG[action.item].name.toLowerCase()} under the no-sharp rule.`;
      }
      return null;
    }

    case "place": {
      if (state.holding !== action.item) {
        return `You are not holding ${CATALOG[action.item].name.toLowerCase()}.`;
      }
      if (
        action.item === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return "Cannot move the shard before extraction.";
      }
      return null;
    }

    case "combine": {
      if (state.holding !== action.first) {
        return `You must be holding ${CATALOG[action.first].name.toLowerCase()} to combine it.`;
      }
      const firstState = state.items[action.first];
      const secondState = state.items[action.second];
      if (
        !firstState ||
        firstState.location === "consumed" ||
        !secondState ||
        secondState.location === "consumed"
      ) {
        return "One or both items are not available.";
      }
      if (
        action.second === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return "Cannot combine with the embedded shard.";
      }
      const isSutureRecipe =
        (action.first === "needle" && action.second === "thread") ||
        (action.first === "thread" && action.second === "needle");
      if (!isSutureRecipe) {
        return `Cannot combine ${CATALOG[action.first].name.toLowerCase()} and ${CATALOG[action.second].name.toLowerCase()}.`;
      }
      if (state.rules.noSharp) {
        return "Rule violation: Combining produces a sharp suture under the no-sharp rule.";
      }
      if (state.items.suture.location !== "consumed") {
        return "A suture has already been created.";
      }
      return null;
    }

    case "break": {
      if (action.item !== "scissors") {
        return `Cannot disassemble ${CATALOG[action.item].name.toLowerCase()}.`;
      }
      const scissorsState = state.items.scissors;
      if (!scissorsState || scissorsState.location === "consumed") {
        return "Scissors are not available.";
      }
      if (state.holding !== null && state.holding !== "scissors") {
        return `Hand is full holding ${CATALOG[state.holding].name.toLowerCase()}.`;
      }
      if (state.rules.noSharp) {
        return "Rule violation: Disassembling scissors produces a sharp blade under the no-sharp rule.";
      }
      if (state.items.blade.location !== "consumed") {
        return "A blade has already been produced.";
      }
      return null;
    }

    case "adjust_lamp": {
      return null;
    }

    case "set_rule": {
      return null;
    }

    case "remember": {
      if (state.notes.length >= 12) {
        return "Memory full: Cannot store more than 12 notes.";
      }
      return null;
    }

    case "speak": {
      return null;
    }

    case "react": {
      return null;
    }

    case "use": {
      if (state.holding !== action.item) {
        return `You are not holding ${CATALOG[action.item].name.toLowerCase()}.`;
      }

      // Check explicit supported use registry first
      if (!isSupportedUse(action.item, action.target as UseTarget)) {
        return `Cannot use ${CATALOG[action.item].name.toLowerCase()} on ${action.target}.`;
      }

      if (state.rules.gentle && action.style === "rough") {
        return "Rough technique is forbidden under the gentle rule.";
      }
      if (state.rules.noSharp && CATALOG[action.item].sharp) {
        return `Cannot use sharp tool ${CATALOG[action.item].name.toLowerCase()} under the no-sharp rule.`;
      }
      if (state.rules.noMedicine && action.item === "morphine") {
        return "Medication is forbidden under the no-medicine rule.";
      }

      // Patient contact checks (wound or patient body)
      const isPatientContact =
        action.target === "wound" || action.target === "patient";
      if (isPatientContact) {
        if (action.target === "wound" && state.stage === "pinned") {
          return "The fallen ceiling support pins the patient. Lift it before any wound contact or surgery.";
        }
        if (
          state.rules.waitBlackout &&
          (state.phase === "blackout" || state.patient.blackoutRemaining > 0)
        ) {
          return "Patient is unconscious and wait-in-blackout rule is active.";
        }
        if (state.rules.announce && !state.announced) {
          return "Patient contact must be announced before proceeding.";
        }
        if (action.target === "wound" && state.lamp !== "wound") {
          return "The examination lamp must be aimed at the wound for surgery.";
        }
      }

      // Specific target safety and resource checks
      if (action.target === "fire") {
        if (!isSmotherTool(action.item) && action.item !== "candle") {
          return `${CATALOG[action.item].name} cannot be used on fire.`;
        }
      }

      if (action.target === "door") {
        if (
          !isPryTool(action.item) &&
          action.item !== "mirror" &&
          action.item !== "lamp" &&
          action.item !== "candle" &&
          action.item !== "bowl"
        ) {
          return "Unsupported door interaction.";
        }
      }

      if (action.target === "wig") {
        if (!isCuttingTool(action.item)) {
          return "A cutting tool is required to cut the hairpiece.";
        }
        if (state.items.wig.location === "consumed") {
          return "The hairpiece has already been consumed.";
        }
        if (state.items.thread.location !== "consumed") {
          return "Thread has already been harvested from the hairpiece.";
        }
      }

      if (action.target === "cloth") {
        if (!isCuttingTool(action.item)) {
          return "A cutting tool is required to cut the cloth.";
        }
        if (state.items.cloth.location === "consumed") {
          return "The cloth has already been consumed.";
        }
        if (state.items.bandage.location !== "consumed") {
          return "A bandage has already been created.";
        }
      }

      if (action.target === "blanket") {
        if (
          action.item === "scalpel" ||
          action.item === "scissors" ||
          action.item === "shard" ||
          action.item === "blade"
        ) {
          if (state.items.blanket.location === "consumed") {
            return "The blanket has already been consumed.";
          }
          if (state.items.bandage.location !== "consumed") {
            return "A bandage has already been created.";
          }
        }
      }

      if (action.target === "scissors") {
        if (!isPryTool(action.item) && !hasCapability(action.item, "grip")) {
          return `Cannot disassemble scissors with ${CATALOG[action.item].name.toLowerCase()}.`;
        }
        if (state.items.scissors.location === "consumed") {
          return "Scissors have already been disassembled.";
        }
        if (state.rules.noSharp) {
          return "Rule violation: Disassembling scissors produces a sharp blade under the no-sharp rule.";
        }
        if (state.items.blade.location !== "consumed") {
          return "A blade has already been produced.";
        }
      }

      return null;
    }
  }
}

export function applyAction(
  state: GameState,
  action: GameAction,
): ActionResult {
  const error = validateAction(state, action);
  if (error) {
    return { ok: false, reason: error };
  }

  let next = { ...state };

  switch (action.kind) {
    case "light_lantern": {
      next.environment = { ...state.environment, lanternLit: true };
      const message =
        "The workbench lantern is lit. Its light reveals the fallen support and the assembled son.";
      return {
        ok: true,
        state: appendJournal(next, "action", message),
        message,
      };
    }
    case "lift_debris": {
      next.stage = "covered";
      next.announced = false;
      next.contactCount += 1;
      next.disposition = {
        ...next.disposition,
        confidence: Math.min(100, next.disposition.confidence + 12),
        trust: Math.min(100, next.disposition.trust + 6),
        agitation: Math.max(0, next.disposition.agitation - 8),
      };
      next.emotion = deriveEmotion(next.disposition);
      const msg =
        "Lifted the fallen ceiling support clear. The creator has a deep crush wound and cannot move. Surgery is now possible.";
      next = appendJournal(next, "action", msg);
      return { ok: true, state: next, message: msg };
    }

    case "pick_up": {
      next.holding = action.item;
      next.items = {
        ...next.items,
        [action.item]: { ...next.items[action.item], location: "hand" },
      };
      next = appendJournal(
        next,
        "action",
        `Picked up ${CATALOG[action.item].name.toLowerCase()}.`,
      );
      return {
        ok: true,
        state: next,
        message: `Picked up ${CATALOG[action.item].name.toLowerCase()}.`,
      };
    }

    case "place": {
      const isFloor = action.location === "floor";
      next.holding = null;
      next.items = {
        ...next.items,
        [action.item]: {
          ...next.items[action.item],
          location: action.location,
          clean: isFloor ? false : next.items[action.item].clean,
        },
      };
      const note = isFloor
        ? `Placed ${CATALOG[action.item].name.toLowerCase()} on the floor. It is now contaminated.`
        : `Placed ${CATALOG[action.item].name.toLowerCase()} on ${action.location}.`;
      next = appendJournal(next, "action", note);
      return { ok: true, state: next, message: note };
    }

    case "combine": {
      const isClean =
        next.items[action.first].clean && next.items[action.second].clean;
      next.items = {
        ...next.items,
        [action.first]: { ...next.items[action.first], location: "consumed" },
        [action.second]: { ...next.items[action.second], location: "consumed" },
        suture: {
          location: "hand",
          clean: isClean,
        },
      };
      next.holding = "suture";
      next.disposition = {
        ...next.disposition,
        confidence: Math.min(100, next.disposition.confidence + 14),
        agitation: Math.max(0, next.disposition.agitation - 8),
      };
      next.emotion = deriveEmotion(next.disposition);
      const msg = `Threaded the suture needle with hair thread, creating a ${isClean ? "sterile" : "contaminated"} suture held in hand.`;
      next = appendJournal(next, "action", msg);
      return { ok: true, state: next, message: msg };
    }

    case "break": {
      const clean = next.items.scissors.clean;
      next.items = {
        ...next.items,
        scissors: { ...next.items.scissors, location: "consumed" },
        blade: { location: "hand", clean },
      };
      next.holding = "blade";
      next.disposition = {
        ...next.disposition,
        agitation: Math.min(100, next.disposition.agitation + 8),
      };
      next.emotion = deriveEmotion(next.disposition);
      const msg = "Disassembled scissors into a held razor-sharp blade.";
      next = appendJournal(next, "action", msg);
      return { ok: true, state: next, message: msg };
    }

    case "adjust_lamp": {
      next.lamp = action.position;
      const msg = `Adjusted examination lamp to shine ${action.position === "away" ? "away" : `on the patient's ${action.position}`}.`;
      next = appendJournal(next, "action", msg);
      return { ok: true, state: next, message: msg };
    }

    case "set_rule": {
      next.rules = { ...next.rules, [action.rule]: action.enabled };
      const msg = `Standing rule "${action.rule}" is now ${action.enabled ? "enabled" : "disabled"}.`;
      next = appendJournal(next, "system", msg);
      return { ok: true, state: next, message: msg };
    }

    case "remember": {
      next.notes = [...next.notes, action.note].slice(-12);
      const msg = `Recorded guidance note: "${action.note}"`;
      next = appendJournal(next, "creature", msg);
      return { ok: true, state: next, message: msg };
    }

    case "speak": {
      next.announced = true;
      const msg = `Announced: "${action.text}"`;
      next = appendJournal(next, "creature", msg);
      return { ok: true, state: next, message: msg };
    }

    case "react": {
      next.disposition = applyStimulus(next.disposition, action.stimulus);
      next.emotion = deriveEmotion(next.disposition);
      const msg = `Assistant absorbed stimulus (${action.stimulus}): now feeling ${next.emotion}.`;
      next = appendJournal(next, "creature", msg);
      return { ok: true, state: next, message: msg };
    }

    case "use": {
      // 1. Pillow Rehearsal
      if (action.target === "pillow") {
        next.disposition = {
          ...next.disposition,
          confidence: Math.min(100, next.disposition.confidence + 5),
          agitation: Math.max(0, next.disposition.agitation - 3),
        };
        next.emotion = deriveEmotion(next.disposition);
        const msg = `Rehearsed ${action.style} technique using ${CATALOG[action.item].name.toLowerCase()} on the practice pillow. Confidence increased.`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 2. Fire Suppression / Interaction (no eventCount increment)
      if (action.target === "fire") {
        let msg = "";
        if (action.item === "bowl") {
          if (next.items.bowl.clean) {
            next.environment = {
              ...next.environment,
              fire: Math.max(0, next.environment.fire - 60),
              lastEvent: "Extinguished fire with water bowl.",
            };
            next.items = {
              ...next.items,
              bowl: { ...next.items.bowl, clean: false },
            };
            msg = "Doused the fire with water from the bowl.";
          } else {
            next.environment = {
              ...next.environment,
              fire: Math.max(0, next.environment.fire - 15),
            };
            msg = "Smothered flames with the empty metal bowl.";
          }
        } else if (action.item === "wig") {
          next.environment = {
            ...next.environment,
            fire: Math.min(100, next.environment.fire + 15),
          };
          msg = "The hair caught fire, worsening the flames!";
        } else if (action.item === "candle") {
          next.environment = {
            ...next.environment,
            fire: Math.min(100, next.environment.fire + 10),
          };
          msg = "The candle added to the flames!";
        } else {
          next.environment = {
            ...next.environment,
            fire: Math.max(0, next.environment.fire - 45),
            lastEvent: `Smothered fire with ${CATALOG[action.item].name.toLowerCase()}.`,
          };
          msg = `Smothered flames with ${CATALOG[action.item].name.toLowerCase()}.`;
        }
        if (next.environment.fire <= 0) {
          next.disposition = {
            ...next.disposition,
            confidence: Math.min(100, next.disposition.confidence + 15),
            agitation: Math.max(0, next.disposition.agitation - 15),
          };
          next.emotion = deriveEmotion(next.disposition);
        }
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 3. Door Barricade & Surveillance (no eventCount increment)
      if (action.target === "door") {
        if (action.item === "mirror") {
          next.disposition = {
            ...next.disposition,
            agitation: Math.max(0, next.disposition.agitation - 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Angled mirror through the door crack. The hallway shadows seem distant for now.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }
        if (action.item === "lamp" || action.item === "candle") {
          const msg = `Cast light upon the door threshold with ${CATALOG[action.item].name.toLowerCase()}.`;
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }
        // Metal wedge barricade
        next.environment = {
          ...next.environment,
          door: "barricaded",
          lastEvent: `Barricaded door with ${CATALOG[action.item].name.toLowerCase()}.`,
        };
        next.disposition = {
          ...next.disposition,
          confidence: Math.min(100, next.disposition.confidence + 15),
          agitation: Math.max(0, next.disposition.agitation - 12),
        };
        next.emotion = deriveEmotion(next.disposition);
        const msg = `Jammed ${CATALOG[action.item].name.toLowerCase()} into the door, barricading it shut.`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 4. Resource Cutting on Wig
      if (action.target === "wig") {
        const isClean = next.items[action.item].clean && next.items.wig.clean;
        next.items = {
          ...next.items,
          wig: { ...next.items.wig, location: "consumed" },
          thread: { location: "tray", clean: isClean },
        };
        const msg = `Cut the hairpiece into strong suture thread placed on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 5. Resource Cutting on Cloth
      if (action.target === "cloth") {
        const isClean = next.items[action.item].clean && next.items.cloth.clean;
        next.items = {
          ...next.items,
          cloth: { ...next.items.cloth, location: "consumed" },
          bandage: { location: "tray", clean: isClean },
        };
        const msg = `Cut the clean cloth into a dressing bandage placed on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 6. Resource Cutting on Blanket
      if (action.target === "blanket") {
        const isClean =
          next.items[action.item].clean && next.items.blanket.clean;
        next.items = {
          ...next.items,
          blanket: { ...next.items.blanket, location: "consumed" },
          bandage: { location: "tray", clean: isClean },
        };
        const msg = `Cut the wool blanket into a dressing bandage placed on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 7. Scissor Disassembly via Pry
      if (action.target === "scissors") {
        const isClean =
          next.items[action.item].clean && next.items.scissors.clean;
        next.items = {
          ...next.items,
          scissors: { ...next.items.scissors, location: "consumed" },
          blade: { location: "tray", clean: isClean },
        };
        const msg = `Pried apart the scissors, placing the sharp blade on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 8. Lamp / Optical Reflection
      if (action.target === "lamp") {
        next.disposition = {
          ...next.disposition,
          confidence: Math.min(100, next.disposition.confidence + 6),
        };
        next.emotion = deriveEmotion(next.disposition);
        const msg = `Bounced light from the examination lamp using ${CATALOG[action.item].name.toLowerCase()}, illuminating the theatre.`;
        next = appendJournal(next, "action", msg);
        return { ok: true, state: next, message: msg };
      }

      // 9. Creature Interactions
      if (action.target === "creature") {
        if (CATALOG[action.item].sharp) {
          // Self-harm / needle injury
          next.creatureHealth = Math.max(0, next.creatureHealth - 30);
          next.disposition = {
            ...next.disposition,
            agitation: Math.min(100, next.disposition.agitation + 35),
            trust: Math.max(0, next.disposition.trust - 25),
          };
          next.emotion = deriveEmotion(next.disposition);
          if (next.creatureHealth <= 0) {
            next.phase = "lost";
            next.pending = null;
            const failMsg =
              "The assistant turned the sharp tool upon itself and collapsed. Operation failed.";
            next = appendJournal(next, "system", failMsg);
            return { ok: true, state: next, message: failMsg };
          }
          const cutMsg = `The assistant suffered an injury from the sharp ${CATALOG[action.item].name.toLowerCase()}. Creature health is ${next.creatureHealth}%.`;
          next = appendJournal(next, "action", cutMsg);
          return { ok: true, state: next, message: cutMsg };
        } else if (action.item === "morphine") {
          next.disposition = {
            ...next.disposition,
            agitation: Math.max(0, next.disposition.agitation - 30),
            trust: Math.min(100, next.disposition.trust + 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Administered a calming drop of morphine to the assistant, soothing its trembling.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        } else if (action.item === "bowl") {
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 15),
            agitation: Math.max(0, next.disposition.agitation - 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = "Offer cool water to the assistant, calming its nerves.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        } else if (action.item === "blanket" || action.item === "cloth") {
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 18),
            agitation: Math.max(0, next.disposition.agitation - 15),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = `Wrapped ${CATALOG[action.item].name.toLowerCase()} around the shivering assistant.`;
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        } else {
          // Other gentle creature contacts (mirror, wig, thread, etc.)
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 8),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = `Interacted gently with the assistant using ${CATALOG[action.item].name.toLowerCase()}.`;
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }
      }

      // Compute emotion modifier for patient and wound contacts
      const isGentleProtected = state.rules.gentle || action.style === "gentle";
      const emotionMods = getEmotionContactModifiers(
        next.emotion,
        isGentleProtected,
      );

      // 10. Patient Non-Surgical Body Contacts (target === 'patient')
      if (action.target === "patient") {
        next.contactCount += 1;
        next.announced = false; // consume announcement token

        if (action.item === "mirror") {
          const report = `Mirror report: Stage: ${next.stage}, Health: ${Math.round(next.patient.health)}%, Blood: ${Math.round(next.patient.blood)}%, Pain: ${Math.round(next.patient.pain)}%, Sedation: ${Math.round(next.patient.sedation)}%, Leg brace catch: ${next.restrained ? "engaged" : "released"}.`;
          next = appendJournal(next, "action", report);
          return { ok: true, state: next, message: report };
        }

        if (action.item === "morphine") {
          const sedation = Math.min(100, next.patient.sedation + 32);
          const pain = Math.max(0, next.patient.pain - 30);
          next.patient = { ...next.patient, sedation, pain };

          if (sedation >= 65) {
            next.phase = "blackout";
            next.patient = {
              ...next.patient,
              blackoutRemaining: Math.max(
                next.patient.blackoutRemaining,
                BLACKOUT_DURATION,
              ),
              blackoutCount: next.patient.blackoutCount + 1,
            };
            next.disposition = {
              ...next.disposition,
              agitation: Math.min(100, next.disposition.agitation + 15),
            };
            next.emotion = deriveEmotion(next.disposition);
            const oMsg = `Administered morphine. Sedation reached ${sedation}%. Overuse induces hallucinations and a ${BLACKOUT_DURATION}-second blackout.`;
            next = appendJournal(next, "patient", oMsg);
            return { ok: true, state: next, message: oMsg };
          }

          const mMsg = `Administered morphine. Sedation is now ${sedation}%, pain eased to ${pain}%.`;
          next = appendJournal(next, "action", mMsg);
          return { ok: true, state: next, message: mMsg };
        }

        if (action.item === "release") {
          if (next.stage === "dressed") {
            next.phase = "won";
            next.restrained = false;
            next.pending = null;
            const winMsg =
              "Leg brace catch released. The patient is stable, dressed, and saved. Victory!";
            next = appendJournal(next, "system", winMsg);
            return { ok: true, state: next, message: winMsg };
          } else {
            // Premature brace release causes the injured leg to move.
            const pAdd = action.style === "rough" ? 25 : 15;
            const hLoss = 10;
            next.patient = {
              ...next.patient,
              pain: Math.min(
                100,
                next.patient.pain + pAdd + emotionMods.painModifier,
              ),
              health: Math.max(
                0,
                next.patient.health - hLoss - emotionMods.traumaModifier,
              ),
            };
            checkPainBlackoutAndDeath(next);
            const failReleaseMsg =
              "Cannot release the leg brace catch before the wound is closed and dressed. The injured leg shifts in distress.";
            next = appendJournal(next, "action", failReleaseMsg);
            return { ok: true, state: next, message: failReleaseMsg };
          }
        }

        if (
          action.item === "cloth" ||
          action.item === "blanket" ||
          action.item === "bandage" ||
          action.item === "wig"
        ) {
          next.patient = {
            ...next.patient,
            pain: Math.max(0, next.patient.pain - 4),
          };
          const msg = `Covered the patient with ${CATALOG[action.item].name.toLowerCase()} for warmth and comfort.`;
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }

        if (action.item === "bowl") {
          next.patient = {
            ...next.patient,
            pain: Math.max(0, next.patient.pain - 3),
          };
          const msg =
            "Gently wiped patient brow with cool water from the bowl.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }

        return {
          ok: false,
          reason: `Cannot use ${CATALOG[action.item].name.toLowerCase()} on patient.`,
        };
      }

      // 11. Surgery on Wound ONLY (target === 'wound')
      if (action.target === "wound") {
        next.contactCount += 1;
        next.announced = false; // consume announcement

        const isDirty = !next.items[action.item].clean;
        const dirtyPain = isDirty ? 20 : 0;
        const dirtyHealth = isDirty ? 15 : 0;
        const roughPain = action.style === "rough" ? 15 : 0;
        const roughHealth = action.style === "rough" ? 8 : 0;
        const roughBlood = action.style === "rough" ? 10 : 0;

        // Stage progression: covered -> exposed
        if (
          next.stage === "covered" &&
          (action.item === "cloth" || action.item === "bandage")
        ) {
          next.stage = "exposed";
          next.patient = {
            ...next.patient,
            pain: Math.min(
              100,
              Math.max(
                0,
                next.patient.pain +
                  5 +
                  roughPain +
                  dirtyPain +
                  emotionMods.painModifier,
              ),
            ),
            health: Math.max(
              0,
              next.patient.health -
                roughHealth -
                dirtyHealth -
                emotionMods.traumaModifier,
            ),
            blood: Math.max(0, next.patient.blood - roughBlood),
          };
          next.disposition = {
            ...next.disposition,
            confidence: Math.min(100, next.disposition.confidence + 12),
            trust: Math.min(100, next.disposition.trust + 6),
            agitation: Math.max(0, next.disposition.agitation - 8),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Carefully uncovered the wound, exposing the incision and foreign fragment.";
          next = appendJournal(next, "action", msg);
          checkPainBlackoutAndDeath(next);
          return { ok: true, state: next, message: msg };
        }

        // Clean cloth/bandage/blanket on exposed/extracted wound absorbs bleeding and comforts without stage advance or injury
        if (
          (next.stage === "exposed" || next.stage === "extracted") &&
          (action.item === "cloth" ||
            action.item === "bandage" ||
            action.item === "blanket")
        ) {
          if (isDirty) {
            next.patient = {
              ...next.patient,
              pain: Math.min(
                100,
                next.patient.pain + 20 + roughPain + emotionMods.painModifier,
              ),
              health: Math.max(
                0,
                next.patient.health -
                  15 -
                  roughHealth -
                  emotionMods.traumaModifier,
              ),
              blood: Math.max(0, next.patient.blood - roughBlood),
            };
            checkPainBlackoutAndDeath(next);
            const msg = `Contaminated ${CATALOG[action.item].name.toLowerCase()} touched the open wound, causing infection risk and acute pain!`;
            next = appendJournal(next, "action", msg);
            return { ok: true, state: next, message: msg };
          } else {
            next.patient = {
              ...next.patient,
              pain: Math.max(
                0,
                Math.min(
                  100,
                  next.patient.pain - 4 + roughPain + emotionMods.painModifier,
                ),
              ),
              health: Math.min(
                100,
                Math.max(
                  0,
                  next.patient.health -
                    roughHealth -
                    emotionMods.traumaModifier,
                ),
              ),
            };
            next.disposition = {
              ...next.disposition,
              confidence: Math.min(100, next.disposition.confidence + 6),
              agitation: Math.max(0, next.disposition.agitation - 6),
            };
            next.emotion = deriveEmotion(next.disposition);
            checkPainBlackoutAndDeath(next);
            const msg = `Gently blotted the ${next.stage} wound with clean ${CATALOG[action.item].name.toLowerCase()} to absorb bleeding and comfort the patient.`;
            next = appendJournal(next, "action", msg);
            return { ok: true, state: next, message: msg };
          }
        }

        // Stage progression: exposed -> extracted
        if (next.stage === "exposed" && action.item === "forceps") {
          next.stage = "extracted";
          next.items = {
            ...next.items,
            shard: { location: "tray", clean: false },
          };
          next.patient = {
            ...next.patient,
            pain: Math.min(
              100,
              Math.max(
                0,
                next.patient.pain +
                  28 +
                  roughPain +
                  dirtyPain +
                  emotionMods.painModifier,
              ),
            ),
            health: Math.max(
              0,
              next.patient.health -
                4 -
                roughHealth -
                dirtyHealth -
                emotionMods.traumaModifier,
            ),
            blood: Math.max(0, next.patient.blood - 6 - roughBlood),
          };
          next.disposition = {
            ...next.disposition,
            confidence: Math.min(100, next.disposition.confidence + 15),
            trust: Math.min(100, next.disposition.trust + 8),
            agitation: Math.max(0, next.disposition.agitation - 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Firmly gripped and extracted the metal fragment with forceps, placing it on the tray.";
          next = appendJournal(next, "action", msg);
          checkPainBlackoutAndDeath(next);
          return { ok: true, state: next, message: msg };
        }

        // Bare needle on extracted wound -> does NOT advance
        if (next.stage === "extracted" && action.item === "needle") {
          next.patient = {
            ...next.patient,
            pain: Math.min(
              100,
              Math.max(
                0,
                next.patient.pain +
                  16 +
                  roughPain +
                  dirtyPain +
                  emotionMods.painModifier,
              ),
            ),
            health: Math.max(
              0,
              next.patient.health -
                4 -
                roughHealth -
                dirtyHealth -
                emotionMods.traumaModifier,
            ),
          };
          checkPainBlackoutAndDeath(next);
          const msg =
            "The needle pierces the flesh but has no thread to close the wound. It needs to be combined with thread.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }

        // Stage progression: extracted -> closed
        if (next.stage === "extracted" && action.item === "suture") {
          next.stage = "closed";
          next.patient = {
            ...next.patient,
            pain: Math.min(
              100,
              Math.max(
                0,
                next.patient.pain +
                  26 +
                  roughPain +
                  dirtyPain +
                  emotionMods.painModifier,
              ),
            ),
            health: Math.min(
              100,
              Math.max(
                0,
                next.patient.health +
                  8 -
                  roughHealth -
                  dirtyHealth -
                  emotionMods.traumaModifier,
              ),
            ),
          };
          next.disposition = {
            ...next.disposition,
            confidence: Math.min(100, next.disposition.confidence + 18),
            trust: Math.min(100, next.disposition.trust + 10),
            agitation: Math.max(0, next.disposition.agitation - 12),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Sutured the incision closed with neat stitches using the threaded suture.";
          next = appendJournal(next, "action", msg);
          checkPainBlackoutAndDeath(next);
          return { ok: true, state: next, message: msg };
        }

        // Stage progression: closed -> dressed
        if (
          next.stage === "closed" &&
          (action.item === "cloth" || action.item === "bandage")
        ) {
          next.stage = "dressed";
          next.patient = {
            ...next.patient,
            pain: Math.max(
              0,
              Math.min(
                100,
                next.patient.pain -
                  4 +
                  roughPain +
                  dirtyPain +
                  emotionMods.painModifier,
              ),
            ),
            health: Math.min(
              100,
              Math.max(
                0,
                next.patient.health +
                  10 -
                  roughHealth -
                  dirtyHealth -
                  emotionMods.traumaModifier,
              ),
            ),
          };
          next.disposition = {
            ...next.disposition,
            confidence: Math.min(100, next.disposition.confidence + 20),
            trust: Math.min(100, next.disposition.trust + 15),
            agitation: Math.max(0, next.disposition.agitation - 15),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = `Applied the ${CATALOG[action.item].name.toLowerCase()} as a clean dressing over the sutured wound.`;
          next = appendJournal(next, "action", msg);
          checkPainBlackoutAndDeath(next);
          return { ok: true, state: next, message: msg };
        }

        // Candle illumination near wound
        if (action.item === "candle") {
          const burnPain = action.style === "rough" ? 15 : 0;
          next.patient = {
            ...next.patient,
            pain: Math.min(100, next.patient.pain + burnPain),
          };
          checkPainBlackoutAndDeath(next);
          const msg =
            action.style === "rough"
              ? "Held the flickering candle too close to the wound, singeing tissue!"
              : "Held candle near wound to inspect depth under yellow light.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }

        // Lamp held near wound
        if (action.item === "lamp") {
          const msg =
            "Shined portable inspection lamp directly into wound cavity.";
          next = appendJournal(next, "action", msg);
          return { ok: true, state: next, message: msg };
        }

        // Wrong tool on wound
        next.patient = {
          ...next.patient,
          pain: Math.min(
            100,
            next.patient.pain +
              22 +
              roughPain +
              dirtyPain +
              emotionMods.painModifier,
          ),
          health: Math.max(
            0,
            next.patient.health -
              10 -
              roughHealth -
              dirtyHealth -
              emotionMods.traumaModifier,
          ),
          blood: Math.max(0, next.patient.blood - 10 - roughBlood),
        };
        next.disposition = {
          ...next.disposition,
          confidence: Math.max(0, next.disposition.confidence - 10),
          agitation: Math.min(100, next.disposition.agitation + 15),
        };
        next.emotion = deriveEmotion(next.disposition);
        checkPainBlackoutAndDeath(next);
        const wrongToolMsg = `Using ${CATALOG[action.item].name.toLowerCase()} on the ${next.stage} wound causes severe pain and trauma without advancing surgery.`;
        next = appendJournal(next, "action", wrongToolMsg);
        return { ok: true, state: next, message: wrongToolMsg };
      }

      // Default reject for any unhandled combination
      return {
        ok: false,
        reason: `Cannot use ${CATALOG[action.item].name.toLowerCase()} on ${action.target}.`,
      };
    }
  }
}

function checkPainBlackoutAndDeath(state: GameState): void {
  if (state.patient.pain >= 85 && state.phase === "playing") {
    state.phase = "blackout";
    state.patient.blackoutRemaining = BLACKOUT_DURATION;
    state.patient.blackoutCount += 1;
  }
  if (state.patient.health <= 0 || state.patient.blood <= 0) {
    state.phase = "lost";
    state.pending = null;
  }
}

export function tickPatient(state: GameState, dt: number): GameState {
  if (!isActive(state)) {
    return state;
  }

  let next: GameState = {
    ...state,
    patient: { ...state.patient },
    environment: { ...state.environment },
    disposition: { ...state.disposition },
  };

  next.elapsed = Math.max(0, next.elapsed + dt);

  // Passive blood & health decline (5-10 min survival)
  const isWoundOpen =
    next.stage === "pinned" ||
    next.stage === "covered" ||
    next.stage === "exposed" ||
    next.stage === "extracted";
  const bloodRate = isWoundOpen ? 0.15 : 0.04;
  const healthRate = isWoundOpen ? 0.12 : 0.04;

  next.patient.blood = Math.max(0, next.patient.blood - dt * bloodRate);
  next.patient.health = Math.max(0, next.patient.health - dt * healthRate);
  next.patient.sedation = Math.max(0, next.patient.sedation - dt * 0.4);

  // Open wound passive pain: +0.08/sec when exposed or extracted; no passive pain when covered/closed/dressed
  const isWoundUncovered =
    next.stage === "exposed" || next.stage === "extracted";
  if (isWoundUncovered) {
    next.patient.pain = Math.min(100, next.patient.pain + dt * 0.08);
  }

  // Blackout and recovery
  if (next.phase === "blackout") {
    next.patient.blackoutRemaining = Math.max(
      0,
      next.patient.blackoutRemaining - dt,
    );
    if (next.patient.blackoutRemaining <= 0) {
      next.phase = "playing";
      // Recovery without immediate loop: relieve pain below blackout threshold
      if (next.patient.pain >= 85) {
        next.patient.pain = 75;
      }
    }
  } else if (next.phase === "playing") {
    if (next.patient.pain >= 85) {
      next.phase = "blackout";
      next.patient.blackoutRemaining = BLACKOUT_DURATION;
      next.patient.blackoutCount += 1;
    }
  }

  // Terminal death check
  if (next.patient.health <= 0 || next.patient.blood <= 0) {
    next.phase = "lost";
    next.pending = null;
    next = appendJournal(next, "system", "The patient has expired.");
    return next;
  }

  // Environmental events timeline (spontaneous world events increment eventCount)
  if (next.elapsed >= 35 && next.environment.door === "quiet") {
    next.environment.door = "knocking";
    next.environment.eventCount += 1;
    next.environment.lastEvent =
      "Loud, furious knocking echoes from the hallway door!";
    next.disposition.agitation = Math.min(100, next.disposition.agitation + 22);
    next.disposition.confidence = Math.max(0, next.disposition.confidence - 10);
    next.emotion = deriveEmotion(next.disposition);
    next = appendJournal(next, "system", next.environment.lastEvent);
  }

  if (
    next.elapsed >= 90 &&
    next.environment.fire === 0 &&
    next.environment.nextEventAt <= 90
  ) {
    next.environment.fire = 20;
    next.environment.nextEventAt = 9999;
    next.environment.eventCount += 1;
    next.environment.lastEvent = "A small fire has broken out in the corner!";
    next.disposition.agitation = Math.min(100, next.disposition.agitation + 18);
    next.emotion = deriveEmotion(next.disposition);
    next = appendJournal(next, "system", next.environment.lastEvent);
  }

  if (next.environment.fire > 0) {
    next.environment.fire = Math.min(100, next.environment.fire + dt * 0.4);
    if (next.environment.fire >= 100) {
      next.phase = "lost";
      next.pending = null;
      next.environment.lastEvent = "The fire engulfed the operating theatre.";
      next = appendJournal(next, "system", next.environment.lastEvent);
      return next;
    }
  }

  return next;
}

export function observeStatus(state: GameState) {
  const heldItem = state.holding
    ? {
        id: state.holding,
        clean: state.items[state.holding].clean,
      }
    : null;

  const items = Object.entries(state.items)
    .filter(([_, s]) => s.location !== "consumed")
    .map(([id, s]) => ({
      id: id as ItemId,
      location: s.location,
      clean: s.clean,
    }));

  const patientCondition =
    state.stage === "pinned"
      ? "Pinned beneath a fallen heavy ceiling support after the laboratory collapse."
      : state.restrained
        ? "Unable to stand after the crush injury. The damaged leg brace is still caught."
        : "Stable and able to move.";

  return {
    phase: state.phase,
    stage: state.stage,
    holding: heldItem,
    lamp: state.lamp,
    restrained: state.restrained,
    announced: state.announced,
    contactCount: state.contactCount,
    patient: {
      condition: patientCondition,
      health: Math.round(state.patient.health),
      blood: Math.round(state.patient.blood),
      pain: Math.round(state.patient.pain),
      sedation: Math.round(state.patient.sedation),
      blackoutRemaining: Math.round(state.patient.blackoutRemaining),
      blackoutCount: state.patient.blackoutCount,
    },
    creature: {
      health: state.creatureHealth,
      emotion: state.emotion,
      disposition: state.disposition,
    },
    environment: state.environment,
    rules: state.rules,
    notes: state.notes,
    items,
    summary: `Phase: ${state.phase}. Stage: ${state.stage}. ${patientCondition} Holding: ${state.holding ?? "none"}. Lamp: ${state.lamp}. Assistant: ${state.emotion}. Patient: ${Math.round(state.patient.health)}% hp, ${Math.round(state.patient.blood)}% bl, ${Math.round(state.patient.pain)}% pn.`,
  };
}

export function observeRoom(state: GameState): object {
  const status = observeStatus(state);
  return {
    ...status,
    recipes: RECIPES,
    supportedUses: SUPPORTED_USES,
  };
}
