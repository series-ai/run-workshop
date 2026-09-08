import {
  ActionProblem,
  ActionResult,
  appendJournal,
  CATALOG,
  ContactAction,
  GameAction,
  GameState,
  isActive,
  ItemId,
  RoomEvent,
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
import {
  canStartDoor,
  canStartFire,
  DOOR_MAX_PRESSURE,
  DOOR_PRESSURE_INTERVAL_SECONDS,
  FIRE_GROWTH_PER_SECOND,
  FIRE_HEALTH_DAMAGE_PER_SECOND,
  FIRE_ONSET,
  FIRE_SEVERE_THRESHOLD,
  openingActiveSeconds,
} from "./pacing";

export const BLACKOUT_DURATION = 12;
export const LIFT_CONFIDENCE_THRESHOLD = 24;

function problem(reason: string, thought: string | null): ActionProblem {
  return { reason, thought };
}

function sameContactAction(left: ContactAction, right: ContactAction): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "lift_debris" && right.kind === "lift_debris") {
    return left.style === right.style;
  }
  if (left.kind === "use" && right.kind === "use") {
    return (
      left.item === right.item &&
      left.target === right.target &&
      left.style === right.style
    );
  }
  return false;
}

function contactLabel(contact: ContactAction): string {
  return contact.kind === "lift_debris"
    ? `lift support ${contact.style}`
    : `use ${CATALOG[contact.item].name.toLowerCase()} on ${contact.target} ${contact.style}`;
}

function preserveDeclarationIfValid(state: GameState): GameState {
  if (
    state.declaredContact === null ||
    validateActionInternal(state, state.declaredContact, true) === null
  ) {
    return state;
  }
  return { ...state, declaredContact: null };
}

export function reconcileDeclaredContact(state: GameState): GameState {
  return preserveDeclarationIfValid(state);
}

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
): ActionProblem | null {
  return validateActionInternal(state, action, false);
}

function validateActionInternal(
  state: GameState,
  action: GameAction,
  skipDeclaration: boolean,
): ActionProblem | null {
  if (state.phase === "won" || state.phase === "lost") {
    return problem("The operation has already ended.", null);
  }

  if (state.paused) {
    return problem("The operation is currently paused.", null);
  }

  if (state.phase === "ready" && isPhysicalActionKind(action.kind)) {
    return problem(
      "The operation has not started yet. Call start() before performing physical actions.",
      null,
    );
  }

  switch (action.kind) {
    case "light_lantern":
      return state.environment.lanternLit
        ? problem(
            "The workbench lantern is already lit.",
            "The lantern is already on. We need a different action.",
          )
        : null;
    case "lift_debris": {
      if (state.stage !== "pinned") {
        return problem(
          "The fallen ceiling support has already been removed.",
          "That support is already clear. We can work on the wound.",
        );
      }
      if (state.holding !== null) {
        return problem(
          `Your hand is holding ${CATALOG[state.holding].name.toLowerCase()}. Put it down before lifting the ceiling support.`,
          "He needs to put down what he is holding first.",
        );
      }
      if (state.rules.gentle && action.style === "rough") {
        return problem(
          "Rough lifting is forbidden under the gentle rule.",
          "I told him to use gentle hands. He must change that movement.",
        );
      }
      if (
        state.rules.waitBlackout &&
        (state.phase === "blackout" || state.patient.blackoutRemaining > 0)
      ) {
        return problem(
          "Patient is unconscious and wait-in-blackout rule is active.",
          null,
        );
      }
      if (state.disposition.confidence < LIFT_CONFIDENCE_THRESHOLD) {
        return problem(
          "I am too afraid to lift the fallen ceiling support. Reassure me or give me a clear instruction first.",
          "He is afraid to lift it. I have to reassure him.",
        );
      }
      if (
        state.rules.announce &&
        !skipDeclaration &&
        (!state.declaredContact ||
          !sameContactAction(state.declaredContact, action))
      ) {
        return problem(
          "Lifting the support requires an exact signal before proceeding.",
          "Wait. I need to know what he is going to do.",
        );
      }
      return null;
    }

    case "pick_up": {
      if (state.holding !== null) {
        return problem(
          `Already holding ${CATALOG[state.holding].name.toLowerCase()}. Place it down before picking up another tool.`,
          "He is already holding that. He needs to put it down first.",
        );
      }
      const itemState = state.items[action.item];
      if (!itemState || itemState.location === "consumed") {
        return problem(
          `${CATALOG[action.item].name} is not available.`,
          "That is gone. We need something else.",
        );
      }
      if (itemState.location === "hand") {
        return problem(
          `Already holding ${CATALOG[action.item].name.toLowerCase()}.`,
          "He is already holding that. He needs to put it down first.",
        );
      }
      if (
        state.stage === "dressed" &&
        itemState.location === "patient" &&
        (action.item === "cloth" || action.item === "bandage")
      ) {
        return problem(
          `${CATALOG[action.item].name} is already applied as the dressing.`,
          "That dressing needs to stay in place.",
        );
      }
      if (
        action.item === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return problem(
          "The metal shard is deeply embedded in the wound and cannot be picked up before extraction.",
          "The fragment is still embedded. We need to extract it first.",
        );
      }
      if (state.rules.noSharp && CATALOG[action.item].sharp) {
        return problem(
          `Cannot pick up sharp tool ${CATALOG[action.item].name.toLowerCase()} under the no-sharp rule.`,
          "I told him no sharp tools. He must change that action.",
        );
      }
      return null;
    }

    case "place": {
      if (state.holding !== action.item) {
        return problem(
          `You are not holding ${CATALOG[action.item].name.toLowerCase()}.`,
          "He needs to hold that tool first.",
        );
      }
      if (
        action.item === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return problem(
          "Cannot move the shard before extraction.",
          "The fragment is still embedded. We need to extract it first.",
        );
      }
      return null;
    }

    case "combine": {
      if (state.holding !== action.first) {
        return problem(
          `You must be holding ${CATALOG[action.first].name.toLowerCase()} to combine it.`,
          "He needs to hold the first item before combining.",
        );
      }
      const firstState = state.items[action.first];
      const secondState = state.items[action.second];
      if (
        !firstState ||
        firstState.location === "consumed" ||
        !secondState ||
        secondState.location === "consumed"
      ) {
        return problem(
          "One or both items are not available.",
          "That is gone. We need something else.",
        );
      }
      if (
        action.second === "shard" &&
        (state.stage === "pinned" ||
          state.stage === "covered" ||
          state.stage === "exposed")
      ) {
        return problem(
          "Cannot combine with the embedded shard.",
          "The fragment is still embedded. We need to extract it first.",
        );
      }
      const isSutureRecipe =
        (action.first === "needle" && action.second === "thread") ||
        (action.first === "thread" && action.second === "needle");
      if (!isSutureRecipe) {
        return problem(
          `Cannot combine ${CATALOG[action.first].name.toLowerCase()} and ${CATALOG[action.second].name.toLowerCase()}.`,
          "Those items do not work together. We need a valid combination.",
        );
      }
      if (state.rules.noSharp) {
        return problem(
          "Rule violation: Combining produces a sharp suture under the no-sharp rule.",
          "I told him no sharp tools. He must change that action.",
        );
      }
      if (state.items.suture.location !== "consumed") {
        return problem(
          "A suture has already been created.",
          "We already made the suture. We need a different step.",
        );
      }
      return null;
    }

    case "break": {
      if (action.item !== "scissors") {
        return problem(
          `Cannot disassemble ${CATALOG[action.item].name.toLowerCase()}.`,
          "That item cannot be disassembled. We need scissors.",
        );
      }
      const scissorsState = state.items.scissors;
      if (!scissorsState || scissorsState.location === "consumed") {
        return problem(
          "Scissors are not available.",
          "That is gone. We need something else.",
        );
      }
      if (state.holding !== null && state.holding !== "scissors") {
        return problem(
          `Hand is full holding ${CATALOG[state.holding].name.toLowerCase()}.`,
          "He needs to put down what he is holding first.",
        );
      }
      if (state.rules.noSharp) {
        return problem(
          "Rule violation: Disassembling scissors produces a sharp blade under the no-sharp rule.",
          "I told him no sharp tools. He must change that action.",
        );
      }
      if (state.items.blade.location !== "consumed") {
        return problem(
          "A blade has already been produced.",
          "We already made the blade. We need a different step.",
        );
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
        return problem(
          "Memory full: Cannot store more than 12 notes.",
          "I already have enough notes. We need to use the notes we have.",
        );
      }
      return null;
    }

    case "signal_intent": {
      return validateActionInternal(state, action.contact, true);
    }

    case "vocalize": {
      return null;
    }

    case "react": {
      return null;
    }

    case "use": {
      if (state.holding !== action.item) {
        return problem(
          `You are not holding ${CATALOG[action.item].name.toLowerCase()}.`,
          "He needs to hold that tool first.",
        );
      }

      // Check explicit supported use registry first
      if (!isSupportedUse(action.item, action.target as UseTarget)) {
        return problem(
          `Cannot use ${CATALOG[action.item].name.toLowerCase()} on ${action.target}.`,
          "That tool cannot do this. We need a different target or tool.",
        );
      }

      if (state.rules.gentle && action.style === "rough") {
        return problem(
          "Rough technique is forbidden under the gentle rule.",
          "I told him to use gentle hands. He must change that movement.",
        );
      }
      if (state.rules.noSharp && CATALOG[action.item].sharp) {
        return problem(
          `Cannot use sharp tool ${CATALOG[action.item].name.toLowerCase()} under the no-sharp rule.`,
          "I told him no sharp tools. He must change that action.",
        );
      }
      if (state.rules.noMedicine && action.item === "morphine") {
        return problem(
          "Medication is forbidden under the no-medicine rule.",
          "I told him no medicine. He must change that action.",
        );
      }
      if (action.item === "morphine" && state.medicineDoses <= 0) {
        return problem(
          "The morphine supply is empty.",
          "No morphine left. I need another way through the pain.",
        );
      }

      if (action.item === "candle") {
        if (action.target === "lamp") {
          if (state.candleLit) {
            return problem(
              "The candle is already lit.",
              "The candle is already lit. We need a different action.",
            );
          }
          if (!state.environment.lanternLit) {
            return problem(
              "The workbench lantern must be lit before lighting the candle.",
              "The lantern is dark. I need the workbench light first.",
            );
          }
        } else if (action.target !== "fire") {
          if (!state.candleLit) {
            return problem(
              "The candle must be lit before this use.",
              "The candle is dark. I need to light it first.",
            );
          }
        }
        if (action.target === "bowl") {
          if (state.waterPortions <= 0) {
            return problem(
              "The bowl has no water left to quench the candle.",
              "The water is gone. I need another way to put out the candle.",
            );
          }
        }
      }

      // Patient contact checks (wound or patient body)
      const isPatientContact =
        action.target === "wound" || action.target === "patient";
      if (isPatientContact) {
        if (action.target === "wound" && state.stage === "pinned") {
          return problem(
            "The fallen ceiling support pins the patient. Lift it before any wound contact or surgery.",
            "The weight is still on me. He has to lift it first.",
          );
        }
        if (action.target === "wound" && !state.environment.lanternLit) {
          return problem(
            "The workbench lantern must be lit before wound surgery.",
            "He cannot see the wound. We need the light.",
          );
        }
        if (
          state.rules.waitBlackout &&
          (state.phase === "blackout" || state.patient.blackoutRemaining > 0)
        ) {
          return problem(
            "Patient is unconscious and wait-in-blackout rule is active.",
            null,
          );
        }
        if (action.target === "wound" && state.lamp !== "wound") {
          return problem(
            "The examination lamp must be aimed at the wound for surgery.",
            "He cannot see the wound clearly. We need the examination lamp.",
          );
        }
        if (
          action.item === "release" &&
          action.target === "patient" &&
          state.stage === "dressed" &&
          state.environment.fire > 0
        ) {
          return problem(
            "The fire must be extinguished before releasing the leg brace and leaving the room.",
            "He has to put out the fire before we can leave.",
          );
        }
      }

      // Specific target safety and resource checks
      if (action.target === "fire") {
        if (state.environment.fire <= 0) {
          return problem(
            "There is no active fire to suppress.",
            "There is no fire. We need a different action.",
          );
        }
        if (!isSmotherTool(action.item) && action.item !== "candle") {
          return problem(
            `${CATALOG[action.item].name} cannot be used on fire.`,
            "That item cannot put out the fire. We need a smothering tool.",
          );
        }
      }

      if (action.target === "door") {
        if (
          !isPryTool(action.item) &&
          action.item !== "mirror" &&
          action.item !== "candle" &&
          action.item !== "bowl"
        ) {
          return problem(
            "Unsupported door interaction.",
            "That tool cannot secure the door. We need a suitable tool.",
          );
        }
      }

      if (action.target === "wig") {
        if (!isCuttingTool(action.item)) {
          return problem(
            "A cutting tool is required to cut the hairpiece.",
            "We need a cutting tool for the hairpiece.",
          );
        }
        if (state.items.wig.location === "consumed") {
          return problem(
            "The hairpiece has already been consumed.",
            "That is gone. We need something else.",
          );
        }
        if (state.items.thread.location !== "consumed") {
          return problem(
            "Thread has already been harvested from the hairpiece.",
            "The thread is already harvested. We need a different step.",
          );
        }
      }

      if (action.target === "cloth") {
        const isThreadPull =
          action.item === "forceps" || action.item === "needle";
        if (!isCuttingTool(action.item) && !isThreadPull) {
          if (action.item !== "bowl") {
            return problem(
              "A cutting or thread-pulling tool is required for the cloth.",
              "We need a cutting or thread-pulling tool for the cloth.",
            );
          }
        } else {
          if (state.items.cloth.location === "consumed") {
            return problem(
              "The cloth has already been consumed.",
              "That is gone. We need something else.",
            );
          }
          if (isThreadPull && state.items.thread.location !== "consumed") {
            return problem(
              "Thread has already been harvested.",
              "The thread is already harvested. We need a different step.",
            );
          }
          if (!isThreadPull && state.items.bandage.location !== "consumed") {
            return problem(
              "A bandage has already been created.",
              "We already made the bandage. We need a different step.",
            );
          }
        }
      }

      if (action.target === "blanket") {
        const isThreadPull =
          action.item === "forceps" || action.item === "needle";
        const isCutting = isCuttingTool(action.item);
        if (isThreadPull || isCutting) {
          if (state.items.blanket.location === "consumed") {
            return problem(
              "The blanket has already been consumed.",
              "That is gone. We need something else.",
            );
          }
          if (isThreadPull && state.items.thread.location !== "consumed") {
            return problem(
              "Thread has already been harvested.",
              "The thread is already harvested. We need a different step.",
            );
          }
          if (isCutting && state.items.bandage.location !== "consumed") {
            return problem(
              "A bandage has already been created.",
              "We already made the bandage. We need a different step.",
            );
          }
        }
      }

      if (
        action.target === "cloth" ||
        action.target === "blanket" ||
        action.target === "bandage"
      ) {
        if (action.item === "bowl") {
          const source = state.items[action.target];
          if (!source || source.location === "consumed") {
            return problem(
              `The ${action.target} is not available to wash.`,
              "That is gone. We need something else.",
            );
          }
          if (source.clean) {
            return problem(
              `The ${action.target} is already clean.`,
              "That fabric is already clean. We need a different step.",
            );
          }
          if (state.waterPortions <= 0) {
            return problem(
              "The bowl has no clean water left.",
              "The clean water is gone. We need another way through this.",
            );
          }
          if (!state.items.bowl.clean) {
            return problem(
              "The bowl is not clean enough to wash the fabric.",
              "The bowl is dirty. We need clean water.",
            );
          }
        }
      }

      if (
        (action.target === "patient" || action.target === "creature") &&
        action.item === "bowl"
      ) {
        if (!state.items.bowl.clean) {
          return problem(
            "The bowl is not clean enough for water contact.",
            "The bowl is dirty. We need clean water.",
          );
        }
        if (state.waterPortions <= 0) {
          return problem(
            "The bowl has no clean water left.",
            "The clean water is gone. We need another way through this.",
          );
        }
      }

      if (action.target === "scissors") {
        if (!isPryTool(action.item) && !hasCapability(action.item, "grip")) {
          return problem(
            `Cannot disassemble scissors with ${CATALOG[action.item].name.toLowerCase()}.`,
            "That tool cannot disassemble the scissors. We need a pry or grip tool.",
          );
        }
        if (state.items.scissors.location === "consumed") {
          return problem(
            "Scissors have already been disassembled.",
            "That is gone. We need something else.",
          );
        }
        if (state.rules.noSharp) {
          return problem(
            "Rule violation: Disassembling scissors produces a sharp blade under the no-sharp rule.",
            "I told him no sharp tools. He must change that action.",
          );
        }
        if (state.items.blade.location !== "consumed") {
          return problem(
            "A blade has already been produced.",
            "We already made the blade. We need a different step.",
          );
        }
      }

      if (
        isPatientContact &&
        state.rules.announce &&
        !skipDeclaration &&
        (!state.declaredContact ||
          !sameContactAction(state.declaredContact, action as ContactAction))
      ) {
        return problem(
          "Patient contact requires an exact signal before proceeding.",
          "Wait. I need to know what he is going to do.",
        );
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
    return { ok: false, ...error };
  }

  let next = { ...state };
  if (isPhysicalActionKind(action.kind)) {
    next.problem = null;
  }

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
      next.declaredContact = null;
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
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
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
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: note,
      };
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
      const msg = `Threaded the suture needle with suture thread, creating a ${isClean ? "sterile" : "contaminated"} suture held in hand.`;
      next = appendJournal(next, "action", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
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
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "adjust_lamp": {
      next.lamp = action.position;
      const msg = `Adjusted examination lamp to shine ${action.position === "away" ? "away" : `on the patient's ${action.position}`}.`;
      next = appendJournal(next, "action", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "set_rule": {
      next.rules = { ...next.rules, [action.rule]: action.enabled };
      const msg = `Standing rule "${action.rule}" is now ${action.enabled ? "enabled" : "disabled"}.`;
      next = appendJournal(next, "system", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "remember": {
      next.notes = [...next.notes, action.note].slice(-12);
      const msg = `Recorded guidance note: "${action.note}"`;
      next = appendJournal(next, "creature", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "signal_intent": {
      next.declaredContact = action.contact;
      next.problem = null;
      const msg = `Signaled intent to ${contactLabel(action.contact)}.`;
      next = appendJournal(next, "creature", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "vocalize": {
      const msg = `Wordless cue: ${action.cue}.`;
      next = appendJournal(next, "creature", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
    }

    case "react": {
      next.disposition = applyStimulus(next.disposition, action.stimulus);
      next.emotion = deriveEmotion(next.disposition);
      const msg = `Assistant absorbed stimulus (${action.stimulus}): now feeling ${next.emotion}.`;
      next = appendJournal(next, "creature", msg);
      return {
        ok: true,
        state: preserveDeclarationIfValid(next),
        message: msg,
      };
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
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 2. Fire suppression / interaction (journal only)
      if (action.target === "fire") {
        let msg = "";
        if (action.item === "bowl") {
          if (next.waterPortions > 0) {
            const poured = next.waterPortions;
            next.environment = {
              ...next.environment,
              fire: Math.max(0, next.environment.fire - poured * 20),
            };
            next.items = {
              ...next.items,
              bowl: { ...next.items.bowl, clean: false },
            };
            next.waterPortions = 0;
            msg = `Doused the fire with ${poured} water portion${poured === 1 ? "" : "s"} from the bowl.`;
          } else {
            next.environment = {
              ...next.environment,
              fire: Math.max(0, next.environment.fire - 15),
            };
            next.items = {
              ...next.items,
              bowl: { ...next.items.bowl, clean: false },
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
          if (!next.candleLit) {
            next.candleLit = true;
            msg = "Lit the candle from the existing fire.";
          } else {
            next.environment = {
              ...next.environment,
              fire: Math.min(100, next.environment.fire + 10),
            };
            msg = "The lit candle added to the flames!";
          }
        } else {
          next.environment = {
            ...next.environment,
            fire: Math.max(0, next.environment.fire - 45),
          };
          msg = `Smothered flames with ${CATALOG[action.item].name.toLowerCase()}.`;
        }
        if (CATALOG[action.item].material === "fabric") {
          next.items = {
            ...next.items,
            [action.item]: { ...next.items[action.item], clean: false },
          };
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
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 3. A lit candle can spend one water portion to quench its flame.
      if (action.target === "bowl" && action.item === "candle") {
        next.waterPortions = Math.max(0, next.waterPortions - 1);
        next.candleLit = false;
        next.items = {
          ...next.items,
          bowl: { ...next.items.bowl, clean: false },
        };
        const msg =
          "Quenched the candle in the bowl with one water portion. The bowl is now dirty.";
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 4. Door barricade and surveillance (journal only)
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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }
        if (action.item === "candle") {
          const msg =
            "Held the lit candle at the door threshold for a brief inspection.";
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }
        // Seat the existing locking bars. The tool remains held.
        next.environment = {
          ...next.environment,
          door: "barricaded",
          doorPressure: 0,
        };
        next.disposition = {
          ...next.disposition,
          confidence: Math.min(100, next.disposition.confidence + 15),
          agitation: Math.max(0, next.disposition.agitation - 12),
        };
        next.emotion = deriveEmotion(next.disposition);
        const msg = `Seated the existing locking bars with ${CATALOG[action.item].name.toLowerCase()}. The door is barricaded.`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 5. Wash dirty fabric with one clean water portion.
      if (
        action.item === "bowl" &&
        (action.target === "cloth" ||
          action.target === "blanket" ||
          action.target === "bandage")
      ) {
        const source = action.target;
        next.waterPortions = Math.max(0, next.waterPortions - 1);
        next.items = {
          ...next.items,
          [source]: { ...next.items[source], clean: true },
        };
        const msg = `Washed the dirty ${source} with one clean water portion.`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 6. Pull thread from fabric without cutting it.
      if (
        (action.target === "cloth" || action.target === "blanket") &&
        (action.item === "forceps" || action.item === "needle")
      ) {
        const source = action.target;
        const isClean =
          next.items[action.item].clean && next.items[source].clean;
        next.items = {
          ...next.items,
          [source]: { ...next.items[source], location: "consumed" },
          thread: { location: "tray", clean: isClean },
        };
        const msg = `Pulled ${isClean ? "clean " : "contaminated "}suture thread from the ${source}.`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 7. Resource Cutting on Wig
      if (action.target === "wig") {
        const isClean = next.items[action.item].clean && next.items.wig.clean;
        next.items = {
          ...next.items,
          wig: { ...next.items.wig, location: "consumed" },
          thread: { location: "tray", clean: isClean },
        };
        const msg = `Cut the hairpiece into strong suture thread placed on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 8. Resource Cutting on Cloth
      if (action.target === "cloth") {
        const isClean = next.items[action.item].clean && next.items.cloth.clean;
        next.items = {
          ...next.items,
          cloth: { ...next.items.cloth, location: "consumed" },
          bandage: { location: "tray", clean: isClean },
        };
        const msg = `Cut the linen cloth into a dressing bandage placed on the tray (clean: ${isClean}).`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 9. Resource Cutting on Blanket
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
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 10. Scissor Disassembly via Pry
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
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 11. Lamp alignment practice
      if (action.target === "lamp") {
        if (action.item === "candle") {
          next.candleLit = true;
          const msg = "Lit the candle from the workbench lantern.";
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }
        next.disposition = {
          ...next.disposition,
          confidence: Math.min(100, next.disposition.confidence + 6),
        };
        next.emotion = deriveEmotion(next.disposition);
        const msg = `Practiced aligning the fixed examination lamp with the ${CATALOG[action.item].name.toLowerCase()}. Confidence increased.`;
        next = appendJournal(next, "action", msg);
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: msg,
        };
      }

      // 12. Creature Interactions
      if (action.target === "creature") {
        if (action.item === "bowl") {
          next.waterPortions = Math.max(0, next.waterPortions - 1);
        }
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
            next.outcome = "creature_lost";
            next.pending = null;
            const failMsg =
              "The assistant turned the sharp tool upon itself and collapsed. Operation failed.";
            next = appendJournal(next, "system", failMsg);
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: failMsg,
            };
          }
          const cutMsg = `The assistant suffered an injury from the sharp ${CATALOG[action.item].name.toLowerCase()}. Creature health is ${next.creatureHealth}%.`;
          next = appendJournal(next, "action", cutMsg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: cutMsg,
          };
        } else if (action.item === "morphine") {
          next = consumeMedicineDose(next);
          next.disposition = {
            ...next.disposition,
            agitation: Math.max(0, next.disposition.agitation - 30),
            trust: Math.min(100, next.disposition.trust + 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg =
            "Administered a calming drop of morphine to the assistant, soothing its trembling.";
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        } else if (action.item === "bowl") {
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 15),
            agitation: Math.max(0, next.disposition.agitation - 10),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = "Offer cool water to the assistant, calming its nerves.";
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        } else if (action.item === "blanket" || action.item === "cloth") {
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 18),
            agitation: Math.max(0, next.disposition.agitation - 15),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = `Held the ${CATALOG[action.item].name.toLowerCase()} briefly against the shivering assistant.`;
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        } else {
          // Other gentle creature contacts (mirror, wig, thread, etc.)
          next.disposition = {
            ...next.disposition,
            trust: Math.min(100, next.disposition.trust + 8),
          };
          next.emotion = deriveEmotion(next.disposition);
          const msg = `Interacted gently with the assistant using ${CATALOG[action.item].name.toLowerCase()}.`;
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
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
        next.declaredContact = null;

        if (action.item === "bowl") {
          next.waterPortions = Math.max(0, next.waterPortions - 1);
        }

        if (action.item === "mirror") {
          const report = `Mirror report: Stage: ${next.stage}, Health: ${Math.round(next.patient.health)}%, Blood: ${Math.round(next.patient.blood)}%, Pain: ${Math.round(next.patient.pain)}%, Sedation: ${Math.round(next.patient.sedation)}%, Leg brace catch: ${next.restrained ? "engaged" : "released"}.`;
          next = appendJournal(next, "action", report);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: report,
          };
        }

        if (action.item === "candle") {
          const report = `Candle check: health ${Math.round(next.patient.health)}%, blood ${Math.round(next.patient.blood)}%, pain ${Math.round(next.patient.pain)}%.`;
          next = appendJournal(next, "action", report);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: report,
          };
        }

        if (action.item === "morphine") {
          next = consumeMedicineDose(next);
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
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: oMsg,
            };
          }

          const mMsg = `Administered morphine. Sedation is now ${sedation}%, pain eased to ${pain}%.`;
          next = appendJournal(next, "action", mMsg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: mMsg,
          };
        }

        if (action.item === "release") {
          if (next.stage === "dressed") {
            next.phase = "won";
            next.outcome = "saved";
            next.restrained = false;
            next.pending = null;
            const winMsg =
              "Leg brace catch released. The patient is stable, dressed, and saved. Victory!";
            next = appendJournal(next, "system", winMsg);
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: winMsg,
            };
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
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: failReleaseMsg,
            };
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
          const verb = action.item === "cloth" ? "Pressed" : "Held";
          const msg = `${verb} the ${CATALOG[action.item].name.toLowerCase()} briefly against the patient for warmth and comfort.`;
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }

        if (action.item === "bowl") {
          next.patient = {
            ...next.patient,
            pain: Math.max(0, next.patient.pain - 3),
          };
          const msg =
            "Gently wiped patient brow with cool water from the bowl.";
          next = appendJournal(next, "action", msg);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }

        return {
          ok: false,
          ...problem(
            `Cannot use ${CATALOG[action.item].name.toLowerCase()} on patient.`,
            "That tool cannot touch me in this way. He needs a suitable contact.",
          ),
        };
      }

      // 11. Surgery on Wound ONLY (target === 'wound')
      if (action.target === "wound") {
        next.contactCount += 1;
        next.declaredContact = null;

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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
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
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: msg,
            };
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
            return {
              ok: true,
              state: preserveDeclarationIfValid(next),
              message: msg,
            };
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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }

        // Stage progression: extracted -> closed
        if (next.stage === "extracted" && action.item === "suture") {
          next.stage = "closed";
          next.holding = null;
          next.items = {
            ...next.items,
            suture: { ...next.items.suture, location: "consumed" },
          };
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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
        }

        // Stage progression: closed -> dressed
        if (
          next.stage === "closed" &&
          (action.item === "cloth" || action.item === "bandage")
        ) {
          next.stage = "dressed";
          next.holding = null;
          next.items = {
            ...next.items,
            [action.item]: { ...next.items[action.item], location: "patient" },
          };
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
          const msg = isDirty
            ? `Applied the contaminated ${CATALOG[action.item].name.toLowerCase()} as a dressing over the sutured wound.`
            : `Applied the ${CATALOG[action.item].name.toLowerCase()} as a clean dressing over the sutured wound.`;
          next = appendJournal(next, "action", msg);
          checkPainBlackoutAndDeath(next);
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
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
          return {
            ok: true,
            state: preserveDeclarationIfValid(next),
            message: msg,
          };
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
        return {
          ok: true,
          state: preserveDeclarationIfValid(next),
          message: wrongToolMsg,
        };
      }

      // Default reject for any unhandled combination
      return {
        ok: false,
        ...problem(
          `Cannot use ${CATALOG[action.item].name.toLowerCase()} on ${action.target}.`,
          "That tool cannot do this. We need a different target or tool.",
        ),
      };
    }
  }
}

function consumeMedicineDose(state: GameState): GameState {
  const medicineDoses = Math.max(0, state.medicineDoses - 1);
  if (medicineDoses > 0) return { ...state, medicineDoses };
  return {
    ...state,
    medicineDoses,
    holding: null,
    items: {
      ...state.items,
      morphine: { ...state.items.morphine, location: "consumed" },
    },
  };
}

function checkPainBlackoutAndDeath(state: GameState): void {
  if (state.patient.pain >= 85 && state.phase === "playing") {
    state.phase = "blackout";
    state.patient.blackoutRemaining = BLACKOUT_DURATION;
    state.patient.blackoutCount += 1;
  }
  if (state.patient.health <= 0 || state.patient.blood <= 0) {
    state.phase = "lost";
    state.outcome = "blood_loss";
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

  const activeSeconds = openingActiveSeconds(next.elapsed, dt);
  next.elapsed = Math.max(0, next.elapsed + Math.max(0, dt));

  // Passive blood & health decline (5-10 min survival)
  const isWoundOpen =
    next.stage === "pinned" ||
    next.stage === "covered" ||
    next.stage === "exposed" ||
    next.stage === "extracted";
  const bloodRate = isWoundOpen ? 0.15 : 0.04;
  const healthRate = isWoundOpen ? 0.12 : 0.04;

  next.patient.blood = Math.max(
    0,
    next.patient.blood - activeSeconds * bloodRate,
  );
  next.patient.health = Math.max(
    0,
    next.patient.health - activeSeconds * healthRate,
  );
  next.patient.sedation = Math.max(
    0,
    next.patient.sedation - activeSeconds * 0.4,
  );

  // Open wound passive pain: +0.08/sec when exposed or extracted; no passive pain when covered/closed/dressed
  const isWoundUncovered =
    next.stage === "exposed" || next.stage === "extracted";
  if (isWoundUncovered) {
    next.patient.pain = Math.min(100, next.patient.pain + activeSeconds * 0.08);
  }

  // Blackout and recovery
  if (next.phase === "blackout") {
    next.patient.blackoutRemaining = Math.max(
      0,
      next.patient.blackoutRemaining - activeSeconds,
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
    next.outcome = "blood_loss";
    next.pending = null;
    next = appendJournal(next, "system", "The patient has expired.");
    return next;
  }

  // Door pressure starts after the room is visible and the patient is free.
  if (
    next.environment.door === "quiet" &&
    canStartDoor(next.elapsed, next.environment.lanternLit, next.stage)
  ) {
    next.environment.door = "knocking";
    next.environment.doorPressure = 1;
    next.environment.nextEventAt =
      next.elapsed + DOOR_PRESSURE_INTERVAL_SECONDS;
    const doorEvent: RoomEvent = {
      kind: "door",
      text: "A hard knock strikes the hallway door. Door pressure is 1 of 3.",
    };
    next.environment.events = [...next.environment.events, doorEvent];
    next.disposition.agitation = Math.min(100, next.disposition.agitation + 14);
    next.disposition.confidence = Math.max(0, next.disposition.confidence - 6);
    next.emotion = deriveEmotion(next.disposition);
    next = appendJournal(next, "system", doorEvent.text);
  } else if (
    next.environment.door === "knocking" &&
    next.environment.doorPressure < DOOR_MAX_PRESSURE &&
    next.elapsed >= next.environment.nextEventAt
  ) {
    const pressure = next.environment.doorPressure + 1;
    next.environment.doorPressure = pressure;
    next.environment.nextEventAt =
      next.elapsed + DOOR_PRESSURE_INTERVAL_SECONDS;
    const doorEvent: RoomEvent = {
      kind: "door",
      text:
        pressure === 2
          ? "The hallway door shakes again. Door pressure is 2 of 3."
          : "The pounding is now relentless. Door pressure is at its limit, 3 of 3.",
    };
    next.environment.events = [...next.environment.events, doorEvent];
    next.disposition.agitation = Math.min(
      100,
      next.disposition.agitation + (pressure === 2 ? 10 : 6),
    );
    next.disposition.confidence = Math.max(
      0,
      next.disposition.confidence - (pressure === 2 ? 5 : 3),
    );
    next.emotion = deriveEmotion(next.disposition);
    next = appendJournal(next, "system", doorEvent.text);
  }

  const fireWasBurning =
    state.environment.fireStarted && state.environment.fire > 0;
  if (
    !next.environment.fireStarted &&
    canStartFire(next.elapsed, next.stage, next.phase)
  ) {
    next.environment.fire = FIRE_ONSET;
    next.environment.fireStarted = true;
    const fireEvent: RoomEvent = {
      kind: "fire",
      text: "A small fire has broken out in the corner!",
    };
    next.environment.events = [...next.environment.events, fireEvent];
    next.disposition.agitation = Math.min(100, next.disposition.agitation + 18);
    next.emotion = deriveEmotion(next.disposition);
    next = appendJournal(next, "system", fireEvent.text);
  }

  if (fireWasBurning && next.environment.fire > 0) {
    const fireBeforeGrowth = next.environment.fire;
    next.environment.fire = Math.min(
      100,
      fireBeforeGrowth + activeSeconds * FIRE_GROWTH_PER_SECOND,
    );
    const severeSeconds =
      fireBeforeGrowth >= FIRE_SEVERE_THRESHOLD
        ? activeSeconds
        : Math.max(
            0,
            activeSeconds -
              (FIRE_SEVERE_THRESHOLD - fireBeforeGrowth) /
                FIRE_GROWTH_PER_SECOND,
          );
    if (severeSeconds > 0) {
      next.patient.health = Math.max(
        0,
        next.patient.health - severeSeconds * FIRE_HEALTH_DAMAGE_PER_SECOND,
      );
    }
    if (next.environment.fire >= 100) {
      next.phase = "lost";
      next.outcome = "fire";
      next.pending = null;
      next = appendJournal(next, "system", "The fire engulfed the room.");
      return next;
    }
    if (next.patient.health <= 0) {
      next.phase = "lost";
      next.outcome = "fire";
      next.pending = null;
      next = appendJournal(
        next,
        "system",
        "Smoke and heat overwhelmed the patient before the fire was stopped.",
      );
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
    outcome: state.outcome,
    stage: state.stage,
    holding: heldItem,
    lamp: state.lamp,
    restrained: state.restrained,
    declaredContact: state.declaredContact,
    problem: state.problem,
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
    medicineDoses: state.medicineDoses,
    waterPortions: state.waterPortions,
    candleLit: state.candleLit,
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
