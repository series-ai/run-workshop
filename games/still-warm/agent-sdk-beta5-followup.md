# Follow-up: beta.5 confirmed the triage fix — two open items from our report

Thanks for the quick turnaround on 0.1.0-beta.5. We upgraded, deleted our
local workaround, and verified live: the judge fast path now routes
correctly (single decide call, sub-second turns, zero completion-stream
requests for discrete commands) and open chat escalates and streams
normally. The answer normalization inside createTextGenJudgeTransport is
exactly what we hoped for.

Two items from our earlier bug report are still open. Current setup:
@series-inc/rundot-agent 0.1.0-beta.5 in the browser via rundot-game-sdk
playground (PLAYGROUND environment), createTextGenTransport with
mode "open" and modelClass "quick".

## 1. reasoningEffort "none" is still rejected by the quick tier

- beta.5 forwards reasoningEffort verbatim (no per-model-class validation),
  and the quick-tier completion endpoint still answers with an in-stream 400:

    event: error
    data: {"error":"STREAM_FAILED","message":"400 Reasoning is mandatory for this endpoint and cannot be disabled."}

- The type still advertises "none" as valid:
  TextGenReasoningEffort = "none" | "minimal" | "low" | "medium" | "high",
  and the doc comment only warns about the inverse case (efforts other than
  "none" on models without thinking support).
- Impact: any app that sets "none" — as the beta.4 reasoningEffort addition
  invites for latency control — loses every generative turn at runtime with
  no compile-time or setup-time signal. This alone made our whole game look
  like "the LLMs are down".

Asks (any one):

1. Honor "none"/"minimal" on the quick-tier endpoint (map to the model's
   minimum effort), or
2. Validate reasoningEffort against the resolved model class at transport
   creation and throw INVALID_INPUT with a clear message, or
3. Update the TextGenTransportOptions docs/types to state which model
   classes support which efforts.

## 2. In-stream upstream 400s classify as kind "unknown"

- Because the failure arrives as an SSE error event over an HTTP 200
  response, it surfaces as MODEL_FAILED with kind "unknown" —
  indistinguishable from a transient outage or rate limit. We burned real
  time asking "is RUN down?" before inspecting the raw stream.
- Ask: classify in-stream error payloads by their embedded upstream status
  (e.g. 400 -> invalid_request or MODEL_UNSUPPORTED, preserving the
  upstream message in the code/cause), so callers can distinguish permanent
  configuration errors from retryable failures.

## Small confirmation request

- We target the quick class with models: ["quick"] plus modelClass: "quick".
  It resolves fine today (the backend's class fallback covers the non-model
  id), but that relies on the "exact model is invalid or retired" fallback
  path. Is models: ["quick"] the intended way to target a class default, or
  should apps pass a concrete model id? If the latter, what is the stable
  way to discover the current quick-tier model id
  (transport.listModels / getAvailableCompletionModels?)?

Happy to contribute our reasoningEffort validation or test cases upstream
if useful.
