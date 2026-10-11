import {
  defineTriage,
  type AgentInput,
  type AgentJudgeQuestionChoice,
  type AgentToolSet,
  type AgentTriageConfig,
} from "@series-inc/rundot-agent";
import type { GameStore } from "../game/store";
import type { GameState, ItemId, VocalCue } from "../game/model";
import { updateTempo, type TempoTracker } from "../game/tempo";
import { formatSensoryNarration, formatInspectNarration } from "./sensoryNarration";

export type TriageIntent =
  | "soothe"
  | "come"
  | "lift"
  | "stand_self"
  | "roll_self"
  | "light_lantern"
  | "fetch_forceps"
  | "fetch_scalpel"
  | "fetch_cloth"
  | "fetch_morphine"
  | "fetch_needle"
  | "stop"
  | "inspect"
  | "chat";

export interface CreatureTriageContext {
  store: GameStore;
  getTempo: () => TempoTracker;
  setTempo: (tempo: TempoTracker) => void;
  getSnapshotBefore: () => GameState;
  getPlayerInputText: () => string | null;
  isPlayerTurn: () => boolean;
  getActionSucceeded: () => boolean;
  setActionSucceeded: (succeeded: boolean) => void;
  getGateFailureReason: () =>
    | "lift_scared"
    | "stand_injured"
    | "roll_pinned"
    | undefined;
  setGateFailureReason: (
    reason: "lift_scared" | "stand_injured" | "roll_pinned" | undefined,
  ) => void;
  onResponse: (text: string) => void;
  onTempoChange?: (tempo: TempoTracker) => void;
  onVocalize: (cue: VocalCue) => void;
  markResponded: () => void;
}

export const TRIAGE_QUESTIONS = {
  intent: {
    type: "choice" as const,
    instructions:
      "Classify the player's core intent or command to the creature or themselves. Choose the single most specific match.",
    criteria: {
      soothe:
        "Comfort, calm, praise, or reassure the creature (e.g., 'it is okay', 'good boy', 'I am here', 'calm down', 'breathe', 'do not be afraid')",
      come: "Command the creature to come closer, approach, return to, or walk toward the player (e.g., 'come here', 'come to me', 'come closer', 'get over here', 'follow my voice')",
      lift: "Command the creature to lift, push, heave, or remove the fallen cabinet/debris pinning the player",
      stand_self:
        "Player states or tries to stand up, rise, or get to their feet themselves while pinned",
      roll_self:
        "Player states or tries to roll over or turn onto their back or stomach",
      light_lantern:
        "Command the creature to light the lantern, candle, lamp, or make fire/light",
      fetch_forceps: "Command to fetch, pick up, get, or bring the forceps",
      fetch_scalpel:
        "Command to fetch, pick up, get, or bring the scalpel or blade",
      fetch_cloth:
        "Command to fetch, pick up, get, or bring the cloth, linen, or bandage",
      fetch_morphine:
        "Command to fetch, pick up, get, or bring morphine or medicine",
      fetch_needle:
        "Command to fetch, pick up, get, or bring the suture needle, thread, or stitch",
      stop: "Command the creature to halt, freeze, stop moving, quiet, or wait",
      inspect:
        "Command to look at, check, examine, or inspect the wound, room, or player condition",
      chat: "Open-ended conversation, lore questions, philosophical questions, or anything requiring generative dialogue",
    },
  } satisfies AgentJudgeQuestionChoice<TriageIntent>,
};

export function createCreatureTriage<TTools extends AgentToolSet>(
  tools: TTools,
  context: CreatureTriageContext,
): AgentTriageConfig<TTools, typeof TRIAGE_QUESTIONS> {
  const commitReply = (narration: string) => {
    const snapBefore = context.getSnapshotBefore();
    const snapAfter = context.store.getSnapshot();
    const updatedTempo = updateTempo(context.getTempo(), {
      actionSucceeded: context.getActionSucceeded(),
      gateFailed: Boolean(context.getGateFailureReason()),
      stateBefore: {
        stage: snapBefore.stage,
        emotion: snapBefore.emotion,
        disposition: { ...snapBefore.disposition },
        holding: snapBefore.holding,
      },
      stateAfter: {
        stage: snapAfter.stage,
        emotion: snapAfter.emotion,
        disposition: { ...snapAfter.disposition },
        holding: snapAfter.holding,
      },
    });
    context.setTempo(updatedTempo);
    context.onTempoChange?.(updatedTempo);
    context.markResponded();
    context.onResponse(narration);
    return narration;
  };

  const createItemFetchRoute = (item: ItemId) => ({
    calls: () => {
      const snap = context.store.getSnapshot();
      const calls: Array<{
        tool: Extract<keyof TTools, string>;
        input: unknown;
      }> = [];
      if (snap.holding !== null && snap.holding !== item) {
        calls.push({
          tool: "act" as Extract<keyof TTools, string>,
          input: { kind: "place", item: snap.holding, location: "tray" },
        });
      }
      calls.push({
        tool: "act" as Extract<keyof TTools, string>,
        input: { kind: "pick_up", item },
      });
      return calls;
    },
    reply: () => {
      const snap = context.store.getSnapshot();
      const succeeded = context.getActionSucceeded();
      const narration = formatSensoryNarration({
        action: "pick_up",
        targetItem: item,
        actionSucceeded: succeeded,
        tempoState: context.getTempo().state,
        currentStage: snap.stage,
        creatureEmotion: snap.emotion,
        vocalText: succeeded
          ? `I hear him gather the ${item}, his steps careful on the stone.`
          : `He hesitates over the ${item}, his clumsy hands trembling out of reach.`,
      });
      return commitReply(narration);
    },
  });

  return defineTriage(tools, {
    id: "creature-turn-triage",
    version: 1,
    timeoutMs: 3500,
    minConfidence: 0.85,
    onJudgeFailure: "escalate",
    prefilter: (input: AgentInput) => {
      const text = input.text ?? "";
      return text.startsWith("PLAYER COMMAND") || context.isPlayerTurn();
    },
    state: (ctx) => {
      const snap = context.store.getSnapshot();
      return {
        playerUtterance: context.getPlayerInputText() ?? ctx.input.text,
        stage: snap.stage,
        emotion: snap.emotion,
        holding: snap.holding,
        posture: snap.posture,
        pinned: snap.stage === "pinned",
        lanternLit: snap.environment.lanternLit,
        creatureArea: snap.creatureArea,
      };
    },
    questions: TRIAGE_QUESTIONS,
    routes: {
      chat: "escalate",

      come: {
        calls: () => [
          {
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "move_to", target: "father" },
          },
        ],
        reply: () => {
          const snapBefore = context.getSnapshotBefore();
          const snap = context.store.getSnapshot();
          const succeeded = context.getActionSucceeded();
          const narration = formatSensoryNarration({
            action: "move_to",
            actionSucceeded: succeeded,
            movedFrom: snapBefore.creatureArea,
            movedTo: snap.creatureArea,
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText: succeeded
              ? "His weight settles close, the straw rustling beside my head."
              : "He stays where he is; I hear his weight settle, hesitant, a few steps off.",
          });
          return commitReply(narration);
        },
      },

      soothe: {
        calls: () => [
          {
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "react", stimulus: "reassure" },
          },
          {
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "vocalize", cue: "relief" },
          },
        ],
        reply: () => {
          const snap = context.store.getSnapshot();
          const narration = formatSensoryNarration({
            action: "react",
            actionSucceeded: true,
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText:
              "He lets out a shuddering breath, the trembling in his limbs steadying slightly.",
          });
          return commitReply(narration);
        },
      },

      lift: {
        calls: () => {
          const snap = context.store.getSnapshot();
          const needsSignal =
            snap.rules.announce &&
            (!snap.declaredContact ||
              snap.declaredContact.kind !== "lift_debris");
          const calls: Array<{
            tool: Extract<keyof TTools, string>;
            input: unknown;
          }> = [];
          if (needsSignal) {
            calls.push({
              tool: "act" as Extract<keyof TTools, string>,
              input: {
                kind: "signal_intent",
                contact: { kind: "lift_debris", style: "gentle" },
              },
            });
          }
          calls.push({
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "lift_debris", style: "gentle" },
          });
          return calls;
        },
        reply: () => {
          const snap = context.store.getSnapshot();
          const failed =
            context.getGateFailureReason() === "lift_scared" ||
            !context.getActionSucceeded();
          const narration = formatSensoryNarration({
            action: "lift_debris",
            actionSucceeded: !failed,
            gateFailureReason: failed ? "lift_scared" : undefined,
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText: failed
              ? "He whimpers, cowering back from the heavy oak."
              : "The heavy oak shifts with a groan as he heaves it off my chest.",
          });
          return commitReply(narration);
        },
      },

      stand_self: {
        calls: () => {
          context.setGateFailureReason("stand_injured");
          return [
            {
              tool: "act" as Extract<keyof TTools, string>,
              input: { kind: "vocalize", cue: "pain" },
            },
          ];
        },
        reply: () => {
          const snap = context.store.getSnapshot();
          context.setGateFailureReason("stand_injured");
          const narration = formatSensoryNarration({
            action: "none",
            actionSucceeded: false,
            gateFailureReason: "stand_injured",
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText:
              "I strain to push against the cold stones, but agony rips through my ribs. The heavy oak pins me flat.",
          });
          return commitReply(narration);
        },
      },

      roll_self: {
        calls: () => {
          const snap = context.store.getSnapshot();
          if (snap.stage === "pinned") {
            context.setGateFailureReason("roll_pinned");
            return [
              {
                tool: "act" as Extract<keyof TTools, string>,
                input: { kind: "vocalize", cue: "pain" },
              },
            ];
          }
          const needsSignal =
            snap.rules.announce &&
            (!snap.declaredContact ||
              snap.declaredContact.kind !== "roll_patient");
          const calls: Array<{
            tool: Extract<keyof TTools, string>;
            input: unknown;
          }> = [];
          if (needsSignal) {
            calls.push({
              tool: "act" as Extract<keyof TTools, string>,
              input: {
                kind: "signal_intent",
                contact: { kind: "roll_patient", style: "gentle" },
              },
            });
          }
          calls.push({
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "roll_patient", style: "gentle" },
          });
          return calls;
        },
        reply: () => {
          const snap = context.store.getSnapshot();
          const pinned =
            snap.stage === "pinned" ||
            context.getGateFailureReason() === "roll_pinned";
          const narration = formatSensoryNarration({
            action: pinned ? "none" : "roll_patient",
            actionSucceeded: !pinned && context.getActionSucceeded(),
            gateFailureReason: pinned ? "roll_pinned" : undefined,
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText: pinned
              ? "The heavy oak cabinet pins me fast against the flagstones. I cannot turn."
              : "Rough hands steady me as I am turned onto my back.",
          });
          return commitReply(narration);
        },
      },

      light_lantern: {
        calls: () => [
          {
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "light_lantern" },
          },
        ],
        reply: () => {
          const snap = context.store.getSnapshot();
          const succeeded = context.getActionSucceeded();
          const narration = formatSensoryNarration({
            action: "light_lantern",
            actionSucceeded: succeeded,
            tempoState: context.getTempo().state,
            currentStage: snap.stage,
            creatureEmotion: snap.emotion,
            vocalText: succeeded
              ? "A spark catches. Warm yellow lantern light blooms against the damp stone."
              : "Flint scrapes the dark uselessly—I am still pinned face down in the dirt.",
          });
          return commitReply(narration);
        },
      },

      fetch_forceps: createItemFetchRoute("forceps"),
      fetch_scalpel: createItemFetchRoute("scalpel"),
      fetch_cloth: createItemFetchRoute("cloth"),
      fetch_morphine: createItemFetchRoute("morphine"),
      fetch_needle: createItemFetchRoute("needle"),

      stop: {
        calls: () => [
          {
            tool: "act" as Extract<keyof TTools, string>,
            input: { kind: "vocalize", cue: "fear" },
          },
        ],
        reply: () => {
          const narration =
            "Footsteps freeze instantly. He holds his breath in the gloom, waiting.";
          return commitReply(narration);
        },
      },

      inspect: {
        calls: () => [
          {
            tool: "inspect_room" as Extract<keyof TTools, string>,
            input: {},
          },
        ],
        reply: () => {
          const snap = context.store.getSnapshot();
          const narration = formatInspectNarration({
            posture: snap.posture,
            stage: snap.stage,
            lamp: snap.lamp,
            candleLit: snap.candleLit,
            lanternLit: snap.environment.lanternLit,
            fire: snap.environment.fire,
          });
          return commitReply(narration);
        },
      },
    },
  });
}
