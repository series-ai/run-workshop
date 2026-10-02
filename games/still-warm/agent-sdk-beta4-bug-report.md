# Bug report: @series-inc/rundot-agent 0.1.0-beta.4 — triage never routes + quick tier rejects reasoningEffort "none"

We wired the beta.4 judge/triage fast path into a live voice game and every
turn stopped responding. Two independent bugs stacked on each other. Repro,
evidence, and suggested fixes below — please review.

## Context

- Package: @series-inc/rundot-agent 0.1.0-beta.4, browser runtime via
  @series-inc/rundot-game-sdk v5.29.0 (PLAYGROUND environment, vite dev
  proxy /__rundotcloudrun/*).
- App shape: player speech is classified by a triage; only open chat
  escalates to the generative model.

    const transport = createTextGenTransport(run.textGen, {
      mode: "open",
      modelClass: "quick",
      reasoningEffort: "none",
    });
    const judge = createTextGenJudgeTransport(run.textGen);
    createAgent({
      model: transport,
      models: ["quick"],
      judge,
      triage: defineTriage(tools, { questions, routes, ... }),
    });

## Bug 1: quick-tier completion endpoint rejects reasoningEffort "none" as an in-stream 400

- Request body sent: model "quick", modelClass "quick", reasoningEffort "none".
- HTTP status was 200 (text/event-stream), but the stream immediately emitted:

    event: error
    data: {"error":"STREAM_FAILED","message":"400 Reasoning is mandatory for this endpoint and cannot be disabled."}

- Impact: every escalated generative turn failed instantly. The app surfaced
  RUN_MODEL_ERROR {"code":"MODEL_FAILED","kind":"unknown","attempts":1,"fallbacks":0}
  for every input — it looked like "the LLMs are down" while the backend was fine.

Issues:

1. TextGenTransportOptions advertises TextGenReasoningEffort =
   "none" | "minimal" | "low" | "medium" | "high", and the doc comment only
   warns that "models without thinking support return 400" for efforts other
   than "none". The inverse broke us: the quick tier MANDATES thinking and
   rejects "none". The type lets you configure a combination that can never work.
2. Error classification gap: because the upstream 400 arrives as an SSE error
   event over a 200 response, it is classified as kind "unknown" (not
   invalid_request / MODEL_UNSUPPORTED). Callers cannot distinguish a
   permanent config error from a transient outage, so no sensible retry or
   user messaging is possible.

Asks:

1. Honor "none"/"minimal" on the quick-tier endpoint, OR validate
   reasoningEffort per model class at transport creation and throw a clear
   INVALID_INPUT instead of failing every run at request time.
2. Map in-stream upstream status codes into the failure kind and preserve the
   upstream message (e.g. kind invalid_request with cause "400 Reasoning is
   mandatory...").
3. Document which model classes support which reasoning efforts.

## Bug 2: createTextGenJudgeTransport passes untyped decide answers through; defineTriage then never matches any route

- The decide endpoint itself works and is fast (~650ms). Response body:

    {"answers":{"intent":{"choice":"soothe","confidence":1,"probabilities":{...}}},"usage":{...}}

- But the answer object carries no "type" discriminator, while
  StructuralDecideAnswerChoice / AgentJudgeResponseAnswer require
  { type: "choice", choice, confidence }.
- The triage route matcher in the agent runtime only reads answers where
  answer.type === "choice" (then checks choice in criteria and choice in
  routes). With the raw endpoint response, every judgment falls through as
  cause "no_matching_route" and the run escalates to the generative model.

Net effect: the integration looks perfectly healthy (judge calls succeed,
judgment_recorded is committed, correct classifications, confidence 1.0) but
the fast path NEVER triggers — every turn silently becomes a full LLM turn.
This cost us a long debugging session because all the individual pieces
looked green in isolation.

Asks (any one of):

1. Normalize answers inside createTextGenJudgeTransport — inject the type
   discriminator from the payload shape (choice: string -> "choice",
   noul: number -> "noul", score: number -> "score").
2. Or have the decide endpoint return answers matching StructuralDecideResult.
3. Or relax the triage matcher to infer the answer kind from the payload shape.

We shipped a local workaround: a wrapper judge transport that restores the
discriminator at the boundary (about 40 lines + tests). Happy to contribute
it upstream if useful.

## Repro summary

1. createAgent with modelClass "quick", reasoningEffort "none",
   judge: createTextGenJudgeTransport(run.textGen), triage with a "choice"
   question and matching routes.
2. Send any input. Observed: decide 200 with correct untyped answer ->
   route_committed cause "no_matching_route" -> escalation -> completion-stream
   SSE error "400 Reasoning is mandatory for this endpoint and cannot be
   disabled."
3. Remove reasoningEffort -> escalation streams normally (full turn in ~8s
   with default reasoning).
4. Add the normalizing judge wrapper -> matching routes commit end-to-end in
   ~0.8s with exactly one decide request and zero completion-stream calls.

## Notes / non-issues

- models: ["quick"] with modelClass "quick" resolved fine (the 400 was only
  about reasoning) — the class fallback covered the non-model id. Confirming
  this is the intended way to target a class default would be appreciated.
- Judge-failure escalation works as designed: when decide itself 429'd under
  the playground rate limit, onJudgeFailure "escalate" correctly handed the
  turn to the model.
- Playground rate limit is 5 req/min per user. A generative turn costs 2-3
  completion requests; a fast-path turn costs 1 decide. Once routing works,
  the fast path meaningfully stretches that budget (most of our turns are
  discrete commands).
