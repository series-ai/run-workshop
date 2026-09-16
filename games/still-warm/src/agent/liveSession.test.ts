import { describe, expect, it, vi } from "vitest";
import { createFastTurnTransport } from "./liveSession";

describe("createFastTurnTransport", () => {
  it("delegates stream to baseTransport when shouldFastClose returns false", async () => {
    let fastClose = false;
    const baseStreamMock = vi.fn(async function* () {
      yield { type: "text_delta" as const, delta: "Thinking..." };
      yield {
        type: "finish" as const,
        reason: "stop" as const,
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      };
    });

    const dummyBaseTransport: any = {
      stream: baseStreamMock,
      complete: vi.fn(),
      listModels: vi.fn(),
    };

    const fastTransport = createFastTurnTransport(
      dummyBaseTransport,
      () => fastClose,
    );

    const abortController = new AbortController();
    const chunks: any[] = [];
    for await (const chunk of fastTransport.stream(
      { model: "test-model", messages: [] } as any,
      { signal: abortController.signal },
    )) {
      chunks.push(chunk);
    }

    expect(baseStreamMock).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual([
      { type: "text_delta", delta: "Thinking..." },
      {
        type: "finish",
        reason: "stop",
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      },
    ]);
  });

  it("fast-closes stream with 'Waiting.' and 0ms stop when shouldFastClose returns true", async () => {
    let fastClose = true;
    const baseStreamMock = vi.fn(async function* () {
      yield { type: "text_delta" as const, delta: "Should not be called" };
    });

    const dummyBaseTransport: any = {
      stream: baseStreamMock,
      complete: vi.fn(),
      listModels: vi.fn(),
    };

    const fastTransport = createFastTurnTransport(
      dummyBaseTransport,
      () => fastClose,
    );

    const abortController = new AbortController();
    const chunks: any[] = [];
    for await (const chunk of fastTransport.stream(
      { model: "test-model", messages: [] } as any,
      { signal: abortController.signal },
    )) {
      chunks.push(chunk);
    }

    expect(baseStreamMock).not.toHaveBeenCalled();
    expect(chunks).toEqual([
      { type: "text_delta", delta: "Waiting." },
      {
        type: "finish",
        reason: "stop",
        usage: { inputTokens: 0, outputTokens: 1, totalTokens: 1 },
      },
    ]);
  });

  it("delegates complete to baseTransport when shouldFastClose returns false", async () => {
    let fastClose = false;
    const expectedResponse: any = {
      model: "test-model",
      content: [{ type: "text", text: "Regular answer" }],
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    };
    const baseCompleteMock = vi.fn().mockResolvedValue(expectedResponse);

    const dummyBaseTransport: any = {
      stream: vi.fn(),
      complete: baseCompleteMock,
      listModels: vi.fn(),
    };

    const fastTransport = createFastTurnTransport(
      dummyBaseTransport,
      () => fastClose,
    );

    const res = await fastTransport.complete(
      { model: "test-model", messages: [] } as any,
      { signal: new AbortController().signal },
    );

    expect(baseCompleteMock).toHaveBeenCalledTimes(1);
    expect(res).toBe(expectedResponse);
  });

  it("fast-closes complete with 'Waiting.' without calling baseTransport when shouldFastClose returns true", async () => {
    let fastClose = true;
    const baseCompleteMock = vi.fn();

    const dummyBaseTransport: any = {
      stream: vi.fn(),
      complete: baseCompleteMock,
      listModels: vi.fn(),
    };

    const fastTransport = createFastTurnTransport(
      dummyBaseTransport,
      () => fastClose,
    );

    const res = await fastTransport.complete(
      { model: "test-model", messages: [] } as any,
      { signal: new AbortController().signal },
    );

    expect(baseCompleteMock).not.toHaveBeenCalled();
    expect(res).toEqual({
      model: "test-model",
      content: [{ type: "text", text: "Waiting." }],
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 1, totalTokens: 1 },
    });
  });
});
