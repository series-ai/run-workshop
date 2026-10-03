# Request: playground rate limits are unusable for tool-loop agents — please raise or re-shape them

Not a bug — a usability wall. The playground's per-user rate limit makes an
agent game effectively untestable after two or three commands. Numbers and a
concrete proposal below.

## What we observed

- Endpoints: POST /__rundotcloudrun/v1/ai/decide and
  POST /__rundotcloudrun/v1/llm/completion-stream (PLAYGROUND environment,
  authenticated dev session).
- Headers: x-ratelimit-limit: 5, with x-ratelimit-remaining and
  x-ratelimit-reset. 429 Too Many Requests beyond that.
- The limit counts raw HTTP requests, and the agent SDK's design multiplies
  requests per player command:

    One generative turn (tool loop):   decide + 2-3 completion-streams  = 3-4 requests
    One triage fast-path turn:         decide only                      = 1 request
    One failed turn with 1 SDK retry:  doubles the burn                 = 6-8 requests

- Real session: three player commands in ~40 seconds — one chat turn, one
  fast-path turn, one more command — hit the ceiling; the third turn 429'd
  twice and died as a hard MODEL_FAILED modal mid-gameplay. A voice-driven
  game naturally produces a command every 10-20 seconds; 5 req/min allows
  roughly 1-2 turns per minute for tool-loop agents.

## Why this hurts disproportionately

1. Tool-loop agents (the SDK's own recommended architecture: act -> tool
   result -> interpret -> close) cost 2-3 requests per turn by design. The
   limit penalizes using the SDK's core loop.
2. The judge/triage fast path we built specifically to REDUCE load (1 request
   per command instead of 3) is what keeps the game playable at all — but
   only for commands the routes cover.
3. Test sessions burn budget on setup traffic too (game session mint,
   telemetry), and any transient error that triggers the SDK's fast retry
   (500ms-2s backoff) wastes the window against a fixed reset.

## Asks

1. Raise the playground per-user limit substantially for authenticated dev
   sessions — 60-120 req/min, or at minimum 30. Playgrounds exist to
   exercise the agent loop; 5/min does not survive contact with it.
2. Consider shaping the limit around agent runs or token/credit spend
   instead of raw HTTP requests. Counting requests penalizes exactly the
   multi-roundtrip tool pattern the SDK encourages.
3. Expose the budget to the SDK: when a 429 happens, surface
   x-ratelimit-reset / retryAfterMs on the TransportError (kind rate_limit)
   so apps can pace themselves or show an in-game cooldown instead of a
   failure modal. Today the SDK's quick retry just burns the window faster.
4. Optional: a per-game override in the playground config for load testing
   (e.g. game.config.playground.json), defaulting to the standard limit.

## Context

- App: Still Warm (voice-controlled agent game) on @series-inc/rundot-agent
  0.1.0-beta.5, browser via rundot-game-sdk playground.
- We already fixed our side where we could: triage routes keep most commands
  at 1 request, and failure messaging no longer blames the user's sign-in.
  The ceiling itself is the remaining problem.
