import { describe, expect, it, vi } from "vitest";
import {
  createAgent,
  defineAgentTool,
  InMemoryAgentSessionStore,
  type AgentJudgeTransport,
  type AgentToolSet,
} from "@series-inc/rundot-agent";
import { GameStore } from "../game/store";
import { createInitialState } from "../game/model";
import { createCreatureTriage, type TriageIntent } from "./creatureTriage";
import { createInitialTempo, type TempoTracker } from "../game/tempo";

function createMockTools(store: GameStore, onActionRun?: (action: any) => void) {
  return {
    inspect_room: defineAgentTool({
      description: "inspect",
      inputSchema: { type: "object" },
      validate: (v) => ({ success: true, value: v }),
      execute: async () => ({ ok: true, room: "cellar" }),
    }),
    act: defineAgentTool({
      description: "act",
      inputSchema: { type: "object" },
      validate: (v) => ({ success: true, value: v }),
      execute: async (input: any) => {
        onActionRun?.(input);
        return store.run(input, new AbortController().signal, { instant: true });
      },
    }),
    interpret_response: defineAgentTool({
      description: "interpret",
      inputSchema: { type: "object" },
      validate: (v) => ({ success: true, value: v }),
      execute: async () => ({ ok: true }),
    }),
  } as AgentToolSet;
}

function createMockJudge(choice: TriageIntent): AgentJudgeTransport {
  return {
    async judge() {
      return {
        model: "typesafe/jev-1.13",
        answers: {
          intent: {
            type: "choice" as const,
            choice,
            confidence: 0.98,
          },
        },
      } as any;
    },
  };
}

describe("creatureTriage", () => {
  it("routes soothe intent to reassurance, relief vocalization, and first-person sensory narration", async () => {
    const store = new GameStore();
    store.start();
    let tempo: TempoTracker = createInitialTempo("pinned");
    let responded = false;
    let lastResponseText = "";
    let actionSucceeded = false;
    let gateFailureReason: any = undefined;

    const mockTools = createMockTools(store);
    const triage = createCreatureTriage(mockTools, {
      store,
      getTempo: () => tempo,
      setTempo: (t) => {
        tempo = t;
      },
      getSnapshotBefore: () => store.getSnapshot(),
      getPlayerInputText: () => "It is okay, I am here.",
      isPlayerTurn: () => true,
      getActionSucceeded: () => actionSucceeded,
      setActionSucceeded: (s) => {
        actionSucceeded = s;
      },
      getGateFailureReason: () => gateFailureReason,
      setGateFailureReason: (r) => {
        gateFailureReason = r;
      },
      onResponse: (text) => {
        lastResponseText = text;
      },
      onTempoChange: (t) => {
        tempo = t;
      },
      onVocalize: vi.fn(),
      markResponded: () => {
        responded = true;
      },
    });

    const agent = createAgent({
      model: {
        stream: async function* () {},
        complete: async () => ({
          model: "test",
          content: [],
          finishReason: "stop",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }),
      },
      models: ["quick"],
      tools: mockTools,
      judge: createMockJudge("soothe"),
      triage,
      store: new InMemoryAgentSessionStore(),
    });

    const session = await agent.createSession();
    const result = await session.send({
      text: "PLAYER COMMAND: It is okay, I am here.",
    });

    expect(result.finishReason).toBe("stop");
    expect(result.text).toBeTruthy();
    expect(responded).toBe(true);
    expect(lastResponseText).toBe(result.text);
    // Emotion should have transitioned from scared
    expect(store.getSnapshot().emotion).not.toBe("scared");
  });

  it("routes lift intent with announce rule: emits signal_intent first, then lift_debris", async () => {
    const base = createInitialState();
    const store = new GameStore({
      ...base,
      emotion: "focused",
      disposition: { trust: 60, confidence: 30, agitation: 10 },
      rules: { ...base.rules, announce: true },
    });
    store.start();

    let tempo: TempoTracker = createInitialTempo("pinned");
    let actionSucceeded = false;
    const executedActions: any[] = [];

    const mockTools = createMockTools(store, (action) => {
      executedActions.push(action);
      if (action.kind === "lift_debris") {
        actionSucceeded = true;
      }
    });

    const triage = createCreatureTriage(mockTools, {
      store,
      getTempo: () => tempo,
      setTempo: (t) => {
        tempo = t;
      },
      getSnapshotBefore: () => store.getSnapshot(),
      getPlayerInputText: () => "Lift the cabinet",
      isPlayerTurn: () => true,
      getActionSucceeded: () => actionSucceeded,
      setActionSucceeded: (s) => {
        actionSucceeded = s;
      },
      getGateFailureReason: () => undefined,
      setGateFailureReason: () => {},
      onResponse: vi.fn(),
      onTempoChange: vi.fn(),
      onVocalize: vi.fn(),
      markResponded: vi.fn(),
    });

    const agent = createAgent({
      model: {
        stream: async function* () {},
        complete: async () => ({
          model: "test",
          content: [],
          finishReason: "stop",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }),
      },
      models: ["quick"],
      tools: mockTools,
      judge: createMockJudge("lift"),
      triage,
      store: new InMemoryAgentSessionStore(),
    });

    const session = await agent.createSession();
    const result = await session.send({
      text: "PLAYER COMMAND: Lift the cabinet",
    });

    expect(result.finishReason).toBe("stop");
    // Verify signal_intent preceded lift_debris
    expect(executedActions[0]).toEqual({
      kind: "signal_intent",
      contact: { kind: "lift_debris", style: "gentle" },
    });
    expect(executedActions[1]).toEqual({
      kind: "lift_debris",
      style: "gentle",
    });
    // Stage should have transitioned to covered
    expect(store.getSnapshot().stage).toBe("covered");
  });

  it("routes stand_self intent to agonizing physical sensory line without moving", async () => {
    const store = new GameStore();
    store.start();
    let tempo: TempoTracker = createInitialTempo("pinned");
    let gateFailureReason: any = undefined;

    const mockTools = createMockTools(store);
    const triage = createCreatureTriage(mockTools, {
      store,
      getTempo: () => tempo,
      setTempo: (t) => {
        tempo = t;
      },
      getSnapshotBefore: () => store.getSnapshot(),
      getPlayerInputText: () => "I try to stand up",
      isPlayerTurn: () => true,
      getActionSucceeded: () => false,
      setActionSucceeded: () => {},
      getGateFailureReason: () => gateFailureReason,
      setGateFailureReason: (r) => {
        gateFailureReason = r;
      },
      onResponse: vi.fn(),
      onTempoChange: vi.fn(),
      onVocalize: vi.fn(),
      markResponded: () => {},
    });

    const agent = createAgent({
      model: {
        stream: async function* () {},
        complete: async () => ({
          model: "test",
          content: [],
          finishReason: "stop",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }),
      },
      models: ["quick"],
      tools: mockTools,
      judge: createMockJudge("stand_self"),
      triage,
      store: new InMemoryAgentSessionStore(),
    });

    const session = await agent.createSession();
    const result = await session.send({
      text: "PLAYER COMMAND: I try to stand up",
    });

    expect(result.finishReason).toBe("stop");
    expect(result.text).toContain("agony");
    expect(gateFailureReason).toBe("stand_injured");
  });

  it("escalates chat intent to the generative model transport", async () => {
    const store = new GameStore();
    store.start();
    let tempo: TempoTracker = createInitialTempo("pinned");

    const mockTools = createMockTools(store);
    const triage = createCreatureTriage(mockTools, {
      store,
      getTempo: () => tempo,
      setTempo: (t) => {
        tempo = t;
      },
      getSnapshotBefore: () => store.getSnapshot(),
      getPlayerInputText: () => "Who created you?",
      isPlayerTurn: () => true,
      getActionSucceeded: () => false,
      setActionSucceeded: () => {},
      getGateFailureReason: () => undefined,
      setGateFailureReason: () => {},
      onResponse: vi.fn(),
      onTempoChange: vi.fn(),
      onVocalize: vi.fn(),
      markResponded: vi.fn(),
    });

    const modelStreamMock = vi.fn(async function* () {
      yield { type: "text_delta" as const, delta: "You did, father." };
      yield {
        type: "finish" as const,
        reason: "stop" as const,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    });

    const agent = createAgent({
      model: {
        stream: modelStreamMock,
        complete: async () => ({
          model: "quick",
          content: [{ type: "text", text: "You did, father." }],
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        }),
      },
      models: ["quick"],
      tools: mockTools,
      judge: createMockJudge("chat"),
      triage,
      store: new InMemoryAgentSessionStore(),
    });

    const session = await agent.createSession();
    const result = await session.send({
      text: "PLAYER COMMAND: Who created you?",
    });

    expect(modelStreamMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("You did, father.");
  });
});
