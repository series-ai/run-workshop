import { describe, expect, it } from "vitest";
import type {
  AgentJudgeQuestionChoice,
  AgentJudgeTransport,
} from "@series-inc/rundot-agent";
import {
  createNormalizingJudgeTransport,
  normalizeJudgeAnswer,
} from "./judgeTransport";

const questions = {
  intent: {
    type: "choice",
    instructions: "Classify the intent.",
    criteria: { soothe: "reassure", chat: "anything else" },
  } satisfies AgentJudgeQuestionChoice<"soothe" | "chat">,
};

describe("normalizeJudgeAnswer", () => {
  it("adds type choice to bare playground decide answers", () => {
    const answer = normalizeJudgeAnswer({
      choice: "soothe",
      confidence: 1,
      probabilities: { soothe: 1, chat: 0 },
    });
    expect(answer).toEqual({
      type: "choice",
      choice: "soothe",
      confidence: 1,
      probabilities: { soothe: 1, chat: 0 },
    });
  });

  it("passes through already typed answers unchanged", () => {
    const typed = { type: "choice" as const, choice: "chat", confidence: 0.4 };
    expect(normalizeJudgeAnswer(typed)).toBe(typed);
  });

  it("normalizes noul and score answers", () => {
    expect(normalizeJudgeAnswer({ noul: 3 })).toEqual({ type: "noul", noul: 3 });
    expect(normalizeJudgeAnswer({ score: 0.5 })).toEqual({
      type: "score",
      score: 0.5,
    });
  });

  it("rejects unrecognized shapes", () => {
    expect(() => normalizeJudgeAnswer({ gibberish: true })).toThrow();
    expect(() => normalizeJudgeAnswer("chat")).toThrow();
    expect(() => normalizeJudgeAnswer(null)).toThrow();
  });
});

describe("createNormalizingJudgeTransport", () => {
  it("normalizes every answer while preserving model and usage", async () => {
    const raw: AgentJudgeTransport = {
      judge: async () =>
        ({
          model: "typesafe/jev-1.13",
          answers: {
            intent: { choice: "soothe", confidence: 1 },
          },
        }) as never,
    };
    const normalized = createNormalizingJudgeTransport(raw);
    const response = await normalized.judge(
      { questions },
      { signal: new AbortController().signal },
    );
    expect(response.model).toBe("typesafe/jev-1.13");
    expect(response.answers.intent).toEqual({
      type: "choice",
      choice: "soothe",
      confidence: 1,
    });
  });

  it("passes through typed responses untouched", async () => {
    const typedResponse = {
      model: "typesafe/jev-1.13",
      answers: { intent: { type: "choice", choice: "chat", confidence: 0.9 } },
    };
    const raw: AgentJudgeTransport = {
      judge: async () => typedResponse as never,
    };
    const normalized = createNormalizingJudgeTransport(raw);
    const response = await normalized.judge(
      { questions },
      { signal: new AbortController().signal },
    );
    expect(response.answers.intent).toBe(typedResponse.answers.intent);
  });
});
