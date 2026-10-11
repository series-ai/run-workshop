export function createFastTurnTransport(
  baseTransport: ReturnType<typeof createTextGenTransport>,
  shouldFastClose: () => boolean,
): ReturnType<typeof createTextGenTransport> {
  return {
    async *stream(request, options) {
      if (shouldFastClose()) {
        yield { type: "text_delta", delta: "Waiting." };
        yield {
          type: "finish",
          reason: "stop",
          usage: { inputTokens: 0, outputTokens: 1, totalTokens: 1 },
        };
        return;
      }
      for await (const chunk of baseTransport.stream(request, options)) {
        yield chunk;
      }
    },
    complete(request, options) {
      if (shouldFastClose()) {
        return Promise.resolve({
          model: request.model,
          content: [{ type: "text" as const, text: "Waiting." }],
          finishReason: "stop" as const,
          usage: { inputTokens: 0, outputTokens: 1, totalTokens: 1 },
        });
      }
      return baseTransport.complete(request, options);
    },
    listModels(signal) {
      return baseTransport.listModels
        ? baseTransport.listModels(signal)
        : Promise.resolve([]);
    },
  };
}

import { z } from "zod";
import {
  createAgent,
  defineAgentTool,
  InMemoryAgentSessionStore,
  type AgentSession,
  type AgentToolContext,
} from "@series-inc/rundot-agent";
import {
  createTextGenTransport,
  createTextGenJudgeTransport,
} from "@series-inc/rundot-agent/venus";import { actionSchema, type GameAction, type VocalCue } from "../game/model";
import { GameStore } from "../game/store";
import { isLiftReady, observeRoom, observeStatus } from "../game/transitions";
import { evaluateLiftGate, isDistressUtterance } from "./turnGuards";
import { CREATURE_INSTRUCTIONS } from "./instructions";
import { initializeRun } from "./runtime";
import {
  interpretationSchema,
  ResponseEvidence,
  type InterpretationInput,
} from "./responseEvidence";
import { logConversation } from "./conversationLogger";
import { getMonsterResponse } from "../game/monsterResponse";
import type { TempoTracker } from "../game/tempo";
import { formatSensoryNarration } from "./sensoryNarration";
import { isStandAttempt, isRollAttempt } from "../game/waitingThoughts";
import { createCreatureTriage } from "./creatureTriage";

export interface LiveHooks {
  onVocalize(cue: VocalCue): void;
  onResponse(text: string): void;
  onPause(): void;
  onAction(): void;
  onTempoChange?(tempo: TempoTracker): void;
}
export interface LiveSession {
  session: AgentSession;
  beginInput(isPlayer: boolean, inputText?: string): void;
  ensureResponse?(): void;
  getTempo?(): TempoTracker;
  close(): Promise<void>;
}

function validator<T>(schema: z.ZodType<T>) {
  return (input: unknown) => {
    const parsed = schema.safeParse(input);
    return parsed.success
      ? { success: true as const, value: parsed.data }
      : {
          success: false as const,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        };
  };
}

export async function createLiveSession(
  store: GameStore,
  hooks: LiveHooks,
  signal: AbortSignal,
): Promise<LiveSession> {
  const run = await initializeRun();
  signal.throwIfAborted();
  let reactionAvailable = false;
  let isPlayerTurn = false;
  let respondedThisTurn = false;
  let lastActionDescription: string | null = null;
  let playerInputText: string | null = null;
  let turnStartedScared = false;
  let reactedOutOfFear = false;
  let gateFailureReason:
    | "lift_scared"
    | "stand_injured"
    | "roll_pinned"
    | undefined = undefined;
  let actionSucceeded = false;
  let snapshotBefore = store.getSnapshot();
  let turn: { turnId: number; epoch: number } = store.beginTurn();
  /**
   * Hands the finished turn to the store, which owns the pacing tracker.
   * The agent layer supplies what only it knows: whether the intended action
   * succeeded, and whether an emotional gate blocked it.
   */
  const settleTempo = () => {
    store.settleTurn({
      turnId: turn.turnId,
      epoch: turn.epoch,
      stateBefore: snapshotBefore,
      actionSucceeded,
      gateFailed: Boolean(gateFailureReason),
    });
    hooks.onTempoChange?.(store.getSnapshot().tempo);
  };
  const responseEvidence = new ResponseEvidence();
  const withEvidence = <T extends object>(result: T) => ({
    ...result,
    evidenceId: responseEvidence.issue(),
  });
  const empty = z.strictObject({});
  const tools = {
    inspect_room: defineAgentTool({
      description:
        "Inspect your father's physical condition, objects, emotions, rules, and possible material combinations.",
      inputSchema: z.toJSONSchema(empty),
      validate: validator(empty),
      execute: (_input, context) => {
        context.signal.throwIfAborted();
        const obs = observeRoom(store.getSnapshot());
        logConversation("TOOL_INSPECT_ROOM", obs);
        return withEvidence(obs);
      },
    }),
    act: defineAgentTool<GameAction, unknown>(
      {
        description:
          "Perform one physical action, signal an exact contact with your father, make a wordless sound, record guidance, set a standing rule, or react to the player. Effects are real and validated. You must inspect the outcome before claiming success.",
        inputSchema: z.toJSONSchema(actionSchema),
        validate: validator(actionSchema),
        timeoutMs: 25000,
        idempotency: "none",
        execute: async (action: GameAction, context: AgentToolContext) => {
          context.signal.throwIfAborted();
          logConversation("TOOL_ACT_CALL", action);
          if (action.kind === "set_rule" && !action.enabled) {
            const errResult = {
              ok: false,
              message:
                "Only your father can lift a rule under Standing rules in the pause menu. Do not repeat the forbidden action. Wait for the player to change the rule.",
            };
            logConversation("TOOL_ACT_REJECTED", errResult);
            return withEvidence(errResult);
          }
          if (action.kind === "react") {
            if (!reactionAvailable) {
              const errResult = {
                ok: false,
                message:
                  "Tone can be interpreted only once for each player command.",
              };
              logConversation("TOOL_REACT_REJECTED", errResult);
              return withEvidence(errResult);
            }
            if (
              action.stimulus === "reassure" &&
              playerInputText &&
              isDistressUtterance(playerInputText)
            ) {
              const errResult = {
                ok: false,
                message:
                  "A frantic cry for help or distress is not reassurance. You are frightened and agitated, not comforted.",
              };
              logConversation("TOOL_REACT_REJECTED", errResult);
              return withEvidence(errResult);
            }
            const emotionBefore = store.getSnapshot().emotion;
            reactionAvailable = false;
            if (emotionBefore === "scared") {
              reactedOutOfFear = true;
            }
          }

          if (
            action.kind === "roll_patient" &&
            store.getSnapshot().stage === "pinned"
          ) {
            gateFailureReason = "roll_pinned";
          }

          const isLiftAction =
            action.kind === "lift_debris" ||
            (action.kind === "signal_intent" && action.contact.kind === "lift_debris");
          if (isLiftAction) {
            const gate = evaluateLiftGate({ turnStartedScared, reactedOutOfFear });
            if (!gate.ok) {
              logConversation("TOOL_ACT_REJECTED", gate);
              gateFailureReason = "lift_scared";
              return withEvidence(gate);
            }
          }
          hooks.onAction();
          const result = await store.run(action, context.signal);
          context.signal.throwIfAborted();
          logConversation("TOOL_ACT_RESULT", { action, result });
          if (result.ok) {
            if (action.kind === "vocalize")
              hooks.onVocalize(action.cue);
            if (action.kind === "signal_intent")
              hooks.onVocalize("effort");
            if (action.kind !== "vocalize" && action.kind !== "react") {
              actionSucceeded = true;
              if (result.message) lastActionDescription = result.message;
            }
          }
          return withEvidence({
            ...result,
            observation: observeStatus(store.getSnapshot()),
          });
        },
      },
    ),
    interpret_response: defineAgentTool<InterpretationInput, unknown>({
      description:
        "Show one brief sensory narration line from the father's first-person perspective ('I', 'me', 'my') describing what I hear, feel, or see from the actual latest tool outcome. NEVER use third-person 'he'/'him' for the father. Use the latest evidenceId from this input. This cannot change the world.",
      inputSchema: z.toJSONSchema(interpretationSchema),
      validate: validator(interpretationSchema),
      execute: (input, context) => {
        context.signal.throwIfAborted();
        logConversation("TOOL_INTERPRET_RESPONSE_CALL", input);
        const decision = responseEvidence.accept(input);
        if (!decision.ok) {
          logConversation("TOOL_INTERPRET_RESPONSE_REJECTED", decision);
          return decision;
        }
        context.signal.throwIfAborted();
        respondedThisTurn = true;
        settleTempo();
        logConversation("TOOL_INTERPRET_RESPONSE_ACCEPTED", decision.text);
        hooks.onResponse(decision.text);
        return { ok: true, message: "Narration thought shown." };
      },
    }),
  };
  const baseTransport = createTextGenTransport(run.textGen, {
    mode: "open",
    modelClass: "quick",
    // Do not set reasoningEffort: "none". The quick-tier completion endpoint
    // rejects it with 400 "Reasoning is mandatory for this endpoint and cannot
    // be disabled" (STREAM_FAILED), killing every escalated chat turn.
  });
  const modelTransport = createFastTurnTransport(
    baseTransport,
    () => respondedThisTurn,
  );
  // beta.5 normalizes the decide endpoint's untyped answers
  // (no "type" discriminator) inside createTextGenJudgeTransport.
  const judgeTransport = createTextGenJudgeTransport(run.textGen);
  const triage = createCreatureTriage(tools, {
    store,
    settleTurn: settleTempo,
    getSnapshotBefore: () => snapshotBefore,
    getPlayerInputText: () => playerInputText,
    isPlayerTurn: () => isPlayerTurn,
    getActionSucceeded: () => actionSucceeded,
    setActionSucceeded: (s) => {
      actionSucceeded = s;
    },
    getGateFailureReason: () => gateFailureReason,
    setGateFailureReason: (r) => {
      gateFailureReason = r;
    },
    onResponse: (text) => {
      hooks.onResponse(text);
    },
    onTempoChange: hooks.onTempoChange,
    onVocalize: hooks.onVocalize,
    markResponded: () => {
      respondedThisTurn = true;
    },
  });
  const agent = createAgent({
    model: modelTransport,
    models: ["quick"],
    instructions: CREATURE_INSTRUCTIONS,
    tools,
    judge: judgeTransport,
    triage,
    store: new InMemoryAgentSessionStore(),
    concurrency: "reject",
    maxTurns: 12,
    modelRetry: {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      jitter: 0.1,
      maxFallbackModels: 0,
    },
    truncation: {
      maxRecoveries: 0,
      outputTokenMultiplier: 1,
      initialMaxOutputTokens: 1300,
    },
    compaction: false,
  });
  const session = await agent.createSession({
    id: `operation-${crypto.randomUUID()}`,
    name: "Still Warm",
  });
  if (signal.aborted) {
    await session.close();
    signal.throwIfAborted();
  }
  signal.throwIfAborted();
  const subscriptions = [
    run.lifecycles.onPause(hooks.onPause),
    run.lifecycles.onSleep(hooks.onPause),
    run.lifecycles.onQuit(hooks.onPause),
  ];
  return {
    session,
    beginInput(isPlayer, inputText) {
      isPlayerTurn = isPlayer;
      respondedThisTurn = false;
      lastActionDescription = null;
      reactionAvailable = isPlayer;
      playerInputText = isPlayer ? (inputText ?? null) : null;
      snapshotBefore = store.getSnapshot();
      turn = store.beginTurn();
      gateFailureReason = undefined;
      actionSucceeded = false;
      const snap = store.getSnapshot();
      turnStartedScared =
        snap.emotion === "scared" || (snap.stage === "pinned" && !isLiftReady(snap));
      reactedOutOfFear = false;

      if (isPlayer && inputText) {
        if (isStandAttempt(inputText)) {
          gateFailureReason = "stand_injured";
        } else if (isRollAttempt(inputText) && snap.stage === "pinned") {
          gateFailureReason = "roll_pinned";
        }
      }

      responseEvidence.beginInput();
    },
    ensureResponse() {
      if (isPlayerTurn && !respondedThisTurn) {
        respondedThisTurn = true;
        settleTempo();
        const snapshotAfter = store.getSnapshot();
        const fallback = getMonsterResponse(snapshotAfter.emotion);
        const text = formatSensoryNarration({
          action: "none",
          actionSucceeded,
          gateFailureReason,
          tempoState: store.getSnapshot().tempo.state,
          currentStage: snapshotAfter.stage,
          creatureEmotion: snapshotAfter.emotion,
          vocalText: fallback.text,
        });
        logConversation("ENSURED_FALLBACK_MONSTER_RESPONSE", { ...fallback, text, lastActionDescription });
        hooks.onResponse(text);
        hooks.onVocalize(fallback.cue);
      }
    },
    getTempo() {
      return store.getSnapshot().tempo;
    },
    async close() {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      session.abort("Operation closed");
      await session.close();
    },
  };
}
