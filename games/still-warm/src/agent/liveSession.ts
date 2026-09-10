import { z } from "zod";
import {
  createAgent,
  defineAgentTool,
  InMemoryAgentSessionStore,
  type AgentSession,
  type AgentToolContext,
} from "@series-inc/rundot-agent";
import { createTextGenTransport } from "@series-inc/rundot-agent/venus";
import { actionSchema, type GameAction, type VocalCue } from "../game/model";
import { GameStore } from "../game/store";
import { observeRoom, observeStatus } from "../game/transitions";
import { CREATURE_INSTRUCTIONS } from "./instructions";
import { initializeRun } from "./runtime";
import {
  interpretationSchema,
  ResponseEvidence,
  type InterpretationInput,
} from "./responseEvidence";
import { logConversation } from "./conversationLogger";
import { getMonsterResponse } from "../game/monsterResponse";

export interface LiveHooks {
  onVocalize(cue: VocalCue): void;
  onResponse(text: string): void;
  onPause(): void;
  onAction(): void;
}
export interface LiveSession {
  session: AgentSession;
  beginInput(isPlayer: boolean): void;
  ensureResponse?(): void;
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
  const responseEvidence = new ResponseEvidence();
  const withEvidence = <T extends object>(result: T) => ({
    ...result,
    evidenceId: responseEvidence.issue(),
  });
  const empty = z.strictObject({});
  const tools = {
    inspect_room: defineAgentTool({
      description:
        "Inspect the current patient, objects, emotions, rules, and possible material combinations.",
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
          "Perform one physical action, signal an exact patient contact, make a wordless sound, record guidance, set a standing rule, or react to the player. Effects are real and validated. You must inspect the outcome before claiming success.",
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
                "Only the patient can lift a rule under Standing rules in the pause menu. Do not repeat the forbidden action. Wait for the player to change the rule.",
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
            reactionAvailable = false;
          }
          hooks.onAction();
          const result = await store.run(action, context.signal);
          context.signal.throwIfAborted();
          logConversation("TOOL_ACT_RESULT", { action, result });
          if (result.ok && action.kind === "vocalize")
            hooks.onVocalize(action.cue);
          if (result.ok && action.kind === "signal_intent")
            hooks.onVocalize("effort");
          if (result.ok && action.kind !== "vocalize" && action.kind !== "react" && result.message) {
            lastActionDescription = result.message;
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
        "Show one brief patient thought about the actual latest tool outcome. Use the latest evidenceId from this input. This cannot change the world.",
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
        logConversation("TOOL_INTERPRET_RESPONSE_ACCEPTED", decision.text);
        hooks.onResponse(decision.text);
        return { ok: true, message: "Patient thought shown." };
      },
    }),
  };
  const agent = createAgent({
    model: createTextGenTransport(run.textGen, {
      mode: "open",
      modelClass: "quick",
    }),
    models: ["quick"],
    instructions: CREATURE_INSTRUCTIONS,
    tools,
    store: new InMemoryAgentSessionStore(),
    concurrency: "reject",
    maxTurns: 12,
    modelRetry: {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      jitter: 0.1,
      maxFallbackModels: 1,
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
    beginInput(isPlayer) {
      isPlayerTurn = isPlayer;
      respondedThisTurn = false;
      lastActionDescription = null;
      reactionAvailable = isPlayer;
      responseEvidence.beginInput();
    },
    ensureResponse() {
      if (isPlayerTurn && !respondedThisTurn) {
        respondedThisTurn = true;
        const fallback = getMonsterResponse(store.getSnapshot().emotion);
        const text = lastActionDescription
          ? `${lastActionDescription} ${fallback.text}`
          : fallback.text;
        logConversation("ENSURED_FALLBACK_MONSTER_RESPONSE", { ...fallback, text, lastActionDescription });
        hooks.onResponse(text);
        hooks.onVocalize(fallback.cue);
      }
    },
    async close() {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      session.abort("Operation closed");
      await session.close();
    },
  };
}
