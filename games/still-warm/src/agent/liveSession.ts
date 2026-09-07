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

export interface LiveHooks {
  onVocalize(cue: VocalCue): void;
  onPause(): void;
  onAction(): void;
}
export interface LiveSession {
  session: AgentSession;
  beginInput(isPlayer: boolean): void;
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
  const empty = z.strictObject({});
  const tools = {
    inspect_room: defineAgentTool({
      description:
        "Inspect the current patient, objects, emotions, rules, and possible material combinations.",
      inputSchema: z.toJSONSchema(empty),
      validate: validator(empty),
      execute: (_input, context) => {
        context.signal.throwIfAborted();
        return observeRoom(store.getSnapshot());
      },
    }),
    act: defineAgentTool<GameAction, unknown>({
      description:
        "Perform one physical action, signal an exact patient contact, make a wordless sound, record guidance, set a standing rule, or react to the player. Effects are real and validated. You must inspect the outcome before claiming success.",
      inputSchema: z.toJSONSchema(actionSchema),
      validate: validator(actionSchema),
      timeoutMs: 25000,
      idempotency: "none",
      execute: async (action: GameAction, context: AgentToolContext) => {
        context.signal.throwIfAborted();
        if (action.kind === "set_rule" && !action.enabled) {
          return {
            ok: false,
            message:
              "Only the patient can lift a rule under Standing rules in the pause menu. Do not repeat the forbidden action. Wait for the player to change the rule.",
          };
        }
        if (action.kind === "react") {
          if (!reactionAvailable)
            return {
              ok: false,
              message:
                "Tone can be interpreted only once for each player command.",
            };
          reactionAvailable = false;
        }
        hooks.onAction();
        const result = await store.run(action, context.signal);
        context.signal.throwIfAborted();
        if (result.ok && action.kind === "vocalize")
          hooks.onVocalize(action.cue);
        if (result.ok && action.kind === "signal_intent")
          hooks.onVocalize("effort");
        return { ...result, observation: observeStatus(store.getSnapshot()) };
      },
    }),
  };
  const agent = createAgent({
    model: createTextGenTransport(run.textGen, {
      mode: "open",
      modelClass: "standard",
    }),
    models: ["gpt-5.6-luna"],
    instructions: CREATURE_INSTRUCTIONS,
    tools,
    store: new InMemoryAgentSessionStore(),
    concurrency: "reject",
    maxTurns: 12,
    modelRetry: {
      maxAttempts: 1,
      baseDelayMs: 500,
      maxDelayMs: 1000,
      jitter: 0,
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
    beginInput(isPlayer) {
      reactionAvailable = isPlayer;
    },
    async close() {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      session.abort("Operation closed");
      await session.close();
    },
  };
}
