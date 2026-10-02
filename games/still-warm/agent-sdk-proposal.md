# Agent SDK Proposal: Low-Latency Tool Chaining, Declarative Preconditions, and "Quick" Tier Tool Routing

## Context & Environment
- **SDK Package**: `@series-inc/rundot-agent` (v0.1.0-beta.2)
- **Runtime**: Browser / WebGL (`@series-inc/rundot-game-sdk` v5.29.0) communicating via `createTextGenTransport(run.textGen, { mode: "open", modelClass: "quick" })` with Venus backend.
- **Model Configuration**: Relying solely on `modelClass: "quick"` and `models: ["quick"]`.
- **Use Case**: Voice-controlled interactive agent (*Still Warm*). A player speaks instructions to an in-game NPC; the NPC executes physical game actions through tools, observes outcomes, and streams back first-person sensory narration to the player.

---

## 1. Problem Statement: Multi-Roundtrip Tool Latency in Real-Time Games

### Current Behavior:
To satisfy game state causality (e.g. *"First perform or inspect physical action, then produce sensory narration interpreting the outcome"*), the agent currently has to execute tools sequentially across multiple LLM turns:
1. **Turn 1 (LLM)**: Model decides to call `act({ kind: "vocalize", cue: "fear" })`.
2. Tool execution in client -> generates an outcome + transient evidence ID.
3. **Turn 2 (LLM)**: Client sends tool result back to Venus -> LLM processes output -> Model calls `interpret_response({ evidenceId, text })`.
4. Tool execution in client -> text is accepted and streamed to player UI.
5. **Turn 3 (LLM)**: Client sends tool result back -> LLM outputs finish string (`"Waiting."`) -> Turn closes.

### The Friction:
- **Roundtrip Multiplication**: Each voice turn requires **2 to 3 full network inference roundtrips**.
- **User Experience**: Even with fast models, 3 roundtrips turn an interactive voice interaction into an unbearable 15–30 second delay.
- **Failure Mode**: When developers try to prompt the model to combine these steps into one turn (e.g., instructing a single call or sequence), models hallucinate synthetic tool schemas (e.g. `action_sequence`) or call the downstream narration tool first before the action tool has executed, leading to rejected calls and dead turns.

---

## 2. Feature Requests & Proposed Solutions

### Feature 1: First-Class Composite / Pipelined Tool Schema (`defineCompositeTool` / Multi-Step Tools)
Instead of forcing multiple roundtrips where the model acts, inspects the outcome, and then calls a separate presentation tool:
- Allow declaring composite tools or structured output schemas where an action and its immediate player-facing narration/interpretation are generated in a **single inference call**.
- **Proposed API Concept**:
```ts
const creatureActionTool = defineCompositeAgentTool({
  name: "act_and_narrate",
  description: "Execute a physical action in the world and describe the sensory observation.",
  inputSchema: z.object({
    action: actionSchema,
    narration: z.string().describe("First-person sensory narration of what is heard/felt/observed."),
  }),
  execute: async ({ action, narration }, context) => {
    // 1. Run physical action in engine
    const actionResult = await store.run(action, context.signal);
    // 2. Consume narration immediately
    displayNarrationToPlayer(narration, actionResult);
    return { ok: true, actionResult };
  }
});
```
*Benefits*: Cuts turn roundtrips from 3 down to **1**. Player latency drops by 60–75%.

---

## Feature 2: Declarative Tool Dependencies / Preconditions
Currently, tools are flat and independent in the SDK. If tool B requires state produced by tool A (e.g., `evidenceId`, target object ID, or an active session state), developers must hand-roll custom state machines (like `ResponseEvidence`) and return `{ ok: false, message: "..." }`.
- When an LLM calls tool B prematurely, the roundtrip is wasted, and models frequently fail to recover properly on the subsequent step.
- **Proposed API Concept**:
```ts
const interpretTool = defineAgentTool({
  name: "interpret_response",
  description: "Narrate the sensory outcome of the latest action.",
  // Declarative precondition: SDK suppresses or rejects tool if dependency isn't met
  prerequisites: {
    dependsOnTools: ["act", "inspect_room"],
    withinCurrentTurn: true,
  },
  execute: async (input, context) => { ... }
});
```

---

## Feature 3: Latency & Reasoning Optimization for the "quick" Model Class on Tool Agents
In `node_modules/@series-inc/rundot-agent/dist/venus.js`:
```ts
interface TextGenTransportOptions {
  mode: 'open' | 'templated';
  modelClass?: 'quick' | 'standard' | 'power';
}
```
When configured with `modelClass: "quick"`, the backend routes tool requests to the default model assigned to the "quick" tier.

- **Observations**:
  1. The backend model assigned to `quick` may emit hundreds of tokens of internal chain-of-thought before outputting the first `tool_call` chunk over SSE.
  2. For low-latency games and voice agents, lengthy reasoning phases can exceed interactive turn budgets (e.g. triggering 25-second fallback watchdogs).
- **Proposed Improvement**:
  - Allow `TextGenTransportOptions` to specify `reasoningEffort: "none" | "low" | "medium"`.
  - Ensure the "quick" class for tool-enabled runs prioritizes minimal TTFT and fast-streaming tool execution rather than heavy internal reasoning.

---

## 3. Reproduction & Log Evidence
- Live traces on Venus endpoint `POST /__rundotcloudrun/v1/llm/completion-stream`:
  - When the model attempted to satisfy "narration first" prompt directives, it called `interpret_response` with guessed `evidenceId: 1` before `act`, resulting in rejection and silence when the agent turn completed without re-invoking narration.
  - Restoring strict prompt instructions with explicit tool order (`act` -> wait for tool result -> `interpret_response`) resolved the failure, but at the cost of 2 roundtrips and high turn latency.

---

## Summary of Asks for the SDK Team
1. **Support single-turn composite tool execution** so games don't need 2–3 roundtrips per player command to act and narrate.
2. **Add declarative tool preconditions** to avoid manual `evidenceId` validation hacks.
3. **Optimize the "quick" class for minimal turn latency** when tools are active.
