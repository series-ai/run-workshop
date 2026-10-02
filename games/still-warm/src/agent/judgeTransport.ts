import type {
  AgentJudgeQuestion,
  AgentJudgeRequest,
  AgentJudgeResponse,
  AgentJudgeResponseChoice,
  AgentJudgeResponseNoul,
  AgentJudgeResponseScore,
  AgentJudgeTransport,
} from "@series-inc/rundot-agent";

type NormalizedJudgeAnswer =
  | AgentJudgeResponseChoice
  | AgentJudgeResponseNoul
  | AgentJudgeResponseScore;

/**
 * The playground decide endpoint returns choice answers without the `type`
 * discriminator (`{ choice, confidence, probabilities }` instead of
 * `{ type: "choice", choice, confidence }`). The SDK's triage matcher only
 * accepts answers whose `type` matches the question kind, so untyped answers
 * fall through as `no_matching_route` and every turn escalates to the
 * generative model. Normalize the shape here, at the boundary.
 */
export function normalizeJudgeAnswer(answer: unknown): NormalizedJudgeAnswer {
  if (typeof answer === "object" && answer !== null && "type" in answer) {
    return answer as NormalizedJudgeAnswer;
  }
  if (
    typeof answer === "object" &&
    answer !== null &&
    "choice" in answer &&
    typeof (answer as { choice: unknown }).choice === "string"
  ) {
    return {
      type: "choice",
      ...(answer as object),
    } as AgentJudgeResponseChoice;
  }
  if (
    typeof answer === "object" &&
    answer !== null &&
    "noul" in answer &&
    typeof (answer as { noul: unknown }).noul === "number"
  ) {
    return { type: "noul", noul: (answer as { noul: number }).noul };
  }
  if (
    typeof answer === "object" &&
    answer !== null &&
    "score" in answer &&
    typeof (answer as { score: unknown }).score === "number"
  ) {
    return { type: "score", score: (answer as { score: number }).score };
  }
  throw new Error("Judge returned an unrecognized answer shape");
}

export function createNormalizingJudgeTransport(
  transport: AgentJudgeTransport,
): AgentJudgeTransport {
  return {
    async judge<const Q extends Record<string, AgentJudgeQuestion>>(
      request: AgentJudgeRequest<Q>,
      options: { signal: AbortSignal; timeoutMs?: number },
    ): Promise<AgentJudgeResponse<Q>> {
      const response = await transport.judge(request, options);
      const answers = Object.fromEntries(
        Object.entries(response.answers).map(([key, answer]) => [
          key,
          normalizeJudgeAnswer(answer),
        ]),
      );
      return { ...response, answers } as AgentJudgeResponse<Q>;
    },
  };
}
