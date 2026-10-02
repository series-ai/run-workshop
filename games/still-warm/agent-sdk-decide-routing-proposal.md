# Feature Request: Tiered "Decide-First" Routing for Agent SDK (`createTieredAgent`)

## 1. Problem Statement

In interactive games, voice experiences, and real-time simulations, **over 80% of player turns are deterministic intent classifications or discrete actions**:
- Direct physical commands: *"Lift the cabinet"*, *"Roll me onto my back"*, *"Pick up the scalpel"*.
- Emotional/standing instructions: *"I'm right here, don't be afraid"*, *"Be gentle"*, *"Stop"*.
- Self-actions: *"I stand up"*, *"Can I rise?"*.

Currently, `@series-inc/rundot-agent` forces every input through the full generative streaming loop (`completion-stream`):
1. **High Turn Latency**: The model spends 15–25 seconds emitting internal reasoning tokens before outputting its first tool call delta over SSE.
2. **Multi-Roundtrip Cascades**: To act and then describe the outcome to the player, the agent must take 2 to 3 full network inference roundtrips (`act` -> execute -> send result -> `interpret_response` -> execute -> close).
3. **Fragility & POV Drift**: Generative models frequently drift into third-person narration ("the cabinet pins him") or hallucinate tool ordering.

### The Opportunity with `ai.decide` (Jev's Classifier)
RUN platform provides `run.textGen.decide` (the instant typed classification API). `decide` evaluates typed questions against state in ~200ms without generating free text.

However, `@series-inc/rundot-agent` currently has **no first-class pattern to run `decide` first and only escalate to the generative LLM when open dialogue or complex reasoning is needed**.

---

## 2. Friction Points with Hand-Rolled Hybrid Architectures

When game developers attempt to build a "decide first, LLM fallback" layer on top of `createAgent`, they encounter three SDK limitations:

1. **Session Journal Disconnect**:
   If an application intercepts turns 1 through 4 with `decide` and deterministic responses, the `AgentSessionStore` journal has no record of them. When turn 5 escalates to `session.send()`, the generative model lacks the conversational context and previous action history unless developers manually inject synthetic journal entries.

2. **No Native `escalate` or Router Primitive**:
   There is no lifecycle hook or middleware in `createAgent` to run a fast pre-flight classification before spinning up the model transport.

3. **Loss of Unified Tool & Permission Semantics**:
   Actions executed during the `decide` phase bypass the agent's tool validation, approval hooks, and event logging.

---

## 3. Proposed API: `createTieredAgent` / `decideRouter`

Introduce a first-class tiered routing wrapper in `@series-inc/rundot-agent`:

```ts
import { createTieredAgent } from "@series-inc/rundot-agent";

const agent = createTieredAgent({
  // Phase 1: Fast Typed Classifier (~150-250ms)
  classifier: {
    // Questions formatted for run.textGen.decide
    questions: {
      intent: {
        type: "choice",
        instructions: "What does the player want the creature or themselves to do?",
        criteria: {
          lift: "heave or push the fallen cabinet off the player",
          roll: "turn the player onto their back",
          stand: "attempt to stand up or get on their feet",
          soothe: "comfort, reassure, or calm the creature",
          chat: "open-ended questions, conversational banter, or lore",
          unclear: "anything else ambiguous",
        },
      },
      tone: {
        type: "choice",
        instructions: "What is the emotional tone of the speaker?",
        criteria: {
          gentle: "calm, soothing, loving, reassuring",
          urgent: "panicked, commanding, hurried",
          harsh: "angry, threatening, hostile",
        },
      },
    },

    // Evaluation handler
    handle: async ({ answers, input, session, context }) => {
      // Direct action match: handle immediately without invoking generative LLM
      if (answers.intent.choice !== "chat" && answers.intent.choice !== "unclear") {
        const actionResult = await executeGameAction(answers.intent.choice, answers.tone.choice);
        const narration = selectSensoryTemplate(actionResult);

        // Record the turn directly into the session journal so future LLM turns have full context
        await session.recordExchange({
          userText: input.text,
          classifierAnswers: answers,
          toolCalls: [{ tool: actionResult.kind, input: actionResult.params, output: actionResult.status }],
          assistantText: narration,
        });

        return {
          handled: true,
          response: narration,
        };
      }

      // Hand off to generative LLM
      return { handled: false };
    },
  },

  // Phase 2: Generative LLM Fallback (only called when classifier returns handled: false)
  fallbackAgent: {
    model: textGenTransport,
    models: ["quick"],
    instructions: CREATURE_INSTRUCTIONS,
    tools: gameTools,
  },
});
```

---

## 4. Key Capabilities Needed

### A. Journal Synchronization (`session.recordExchange`)
Allow client code or the classifier router to append validated user/action/response records to the active session transcript without invoking an LLM.
When an unhandled input triggers the generative fallback, the LLM receives the complete, accurate history of both classified turns and generative turns.

### B. Single Interface for Callers
From the perspective of the application (`controller.ts`), `session.send({ text })` remains identical:
- It returns an interactive response immediately if handled by the fast path (<300ms).
- It transparents streams if escalated to the fallback agent.
- Event listeners (`onToolCall`, `onResponse`) emit uniformly regardless of which tier handled the turn.

### C. Direct Integration with `run.textGen.decide`
Allow passing the RUN SDK `textGen` instance directly to the transport so the Agent SDK handles typed question encoding, token budgets, and error fallback automatically:

```ts
const agent = createTieredAgent({
  decideTransport: createDecideTransport(run.textGen),
  modelTransport: createTextGenTransport(run.textGen, { modelClass: "quick" }),
  ...
});
```

---

## 5. Expected Performance & Experience Impact

1. **Latency Reduction**: Turn response time for standard gameplay commands drops from **20–25 seconds down to under 300 milliseconds**.
2. **Deterministic Narrative Quality**: Hand-crafted, immersive first-person sensory prose is delivered for 80%+ of game actions, guaranteeing zero point-of-view drift.
3. **Conversational Grace**: The game retains full open-ended conversational intelligence when players ask unexpected questions or engage in dialogue, without paying the latency penalty on every mechanical command.
4. **Token Cost Savings**: Eliminates ~80% of generative streaming tokens and reasoning overhead across standard game sessions.
