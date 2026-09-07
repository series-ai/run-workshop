import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_USAGE,
  type AgentEvent,
  type AgentRunResult,
  type AgentSession,
} from "@series-inc/rundot-agent";
import { GameStore } from "../game/store";
import { GameAction, VocalCue } from "../game/model";
import {
  ControllerHooks,
  CreatureController,
  SessionFactory,
} from "./controller";
import { LiveSession } from "./liveSession";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createDefaultRunResult(
  overrides?: Partial<AgentRunResult>,
): AgentRunResult {
  return {
    sessionId: "test-session",
    runId: "test-run",
    finishReason: "stop",
    text: "",
    messages: [],
    usage: EMPTY_USAGE,
    turns: 1,
    interruptions: [],
    ...overrides,
  };
}

type ControlledSession = Pick<AgentSession, "send" | "abort" | "subscribe">;

function createFakeLiveSession(overrides?: {
  session?: Partial<ControlledSession>;
  beginInput?: (isPlayer: boolean) => void;
  close?: () => Promise<void>;
}): {
  liveSession: LiveSession;
  fakeSession: ControlledSession;
  beginInputMock: ReturnType<typeof vi.fn>;
  closeMock: ReturnType<typeof vi.fn>;
  emitEvent: (event?: AgentEvent) => void;
  subscribers: Set<(event: AgentEvent) => void | Promise<void>>;
} {
  const subscribers = new Set<(event: AgentEvent) => void | Promise<void>>();

  const defaultSubscribe = vi.fn(
    (listener: (event: AgentEvent) => void | Promise<void>) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
  );

  const fakeSession: ControlledSession = {
    send: vi.fn(async () => createDefaultRunResult()),
    abort: vi.fn(),
    subscribe: defaultSubscribe,
    ...overrides?.session,
  };

  const fullSession: AgentSession = {
    id: "test-session",
    state: {
      schemaVersion: 1,
      sessionId: "test-session",
      status: "idle",
      writerGeneration: 1,
      messages: [],
      entryIds: [],
      runs: [],
      pendingModels: [],
      pendingTools: [],
      interruptions: [],
      queuedInputs: [],
      resolvedDecisionIds: [],
      usage: EMPTY_USAGE,
      turns: 0,
    },
    send: fakeSession.send,
    abort: fakeSession.abort,
    subscribe: fakeSession.subscribe,
    stream: vi.fn(),
    resume: vi.fn(async () => createDefaultRunResult()),
    compact: vi.fn(),
    rename: vi.fn(async () => {}),
    getMessages: vi.fn(async () => []),
    close: vi.fn(async () => {}),
  };

  const beginInputMock = vi.fn(overrides?.beginInput ?? (() => {}));
  const closeMock = vi.fn(overrides?.close ?? (async () => {}));

  const liveSession: LiveSession = {
    session: fullSession,
    beginInput: beginInputMock,
    close: closeMock,
  };

  const defaultEvent: AgentEvent = {
    sequence: 1,
    id: "test-event",
    sessionId: "test-session",
    timestamp: Date.now(),
    type: "usage_updated",
    runId: "test-run",
    usage: EMPTY_USAGE,
  };

  const emitEvent = (event: AgentEvent = defaultEvent) => {
    for (const sub of subscribers) {
      void sub(event);
    }
  };

  return {
    liveSession,
    fakeSession,
    beginInputMock,
    closeMock,
    emitEvent,
    subscribers,
  };
}

describe("CreatureController", () => {
  let store: GameStore;
  let hooks: ControllerHooks;

  beforeEach(() => {
    store = new GameStore();
    hooks = {
      vocalize: vi.fn(),
      silence: vi.fn(),
    };
  });

  afterEach(() => {
    store.dispose();
    vi.restoreAllMocks();
  });

  it("STOP clears pending before new command", async () => {
    const deferredSend1 = createDeferred<AgentRunResult>();
    const sendMock = vi.fn(
      (_prompt: { text: string }) => deferredSend1.promise,
    );

    const { liveSession } = createFakeLiveSession({
      session: { send: sendMock },
    });

    const factory: SessionFactory = vi.fn(async () => liveSession);
    const controller = new CreatureController(store, hooks, factory);

    await controller.start("live");

    // Send active command 1
    controller.command("examine incision");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Queue command 2 while command 1 is still active/running
    controller.command("pick up scalpel");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Player says STOP: should clear pending queue and cancel store action
    controller.command("stop");
    expect(hooks.silence).toHaveBeenCalled();

    // Settle command 1
    deferredSend1.resolve(
      createDefaultRunResult({ text: "Stopped previous observation." }),
    );
    await deferredSend1.promise;

    // Settle and verify command 2 was not sent
    await vi.waitFor(() => {
      expect(controller.getSnapshot().status).toBe("idle");
    });
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Now issue a brand new command after STOP settled
    const deferredSend3 = createDeferred<AgentRunResult>();
    sendMock.mockImplementationOnce(
      (_prompt: { text: string }) => deferredSend3.promise,
    );

    controller.command("check patient pulse");
    expect(sendMock).toHaveBeenCalledTimes(2);

    deferredSend3.resolve(createDefaultRunResult({ text: "Pulse is stable." }));
    await deferredSend3.promise;
  });

  it("only latest correction after active send settles", async () => {
    const deferredSend1 = createDeferred<AgentRunResult>();
    const sendCalls: string[] = [];

    const sendMock = vi.fn(async (prompt: { text: string }) => {
      sendCalls.push(prompt.text);
      if (sendCalls.length === 1) {
        return deferredSend1.promise;
      }
      return createDefaultRunResult({ text: "Done latest correction." });
    });

    const { liveSession } = createFakeLiveSession({
      session: { send: sendMock },
    });

    const factory: SessionFactory = vi.fn(async () => liveSession);
    const controller = new CreatureController(store, hooks, factory);

    await controller.start("live");

    // Initial command
    controller.command("cut with scissors");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Rapid corrections while send 1 is in-flight
    controller.command("no use scalpel");
    controller.command("wait hold forceps instead");
    controller.command("actually clamp the bleeder");

    // Settle send 1
    deferredSend1.resolve(
      createDefaultRunResult({ text: "Interrupted initial action." }),
    );
    await deferredSend1.promise;

    // Drain should pick up ONLY the latest correction
    await vi.waitFor(() => {
      expect(sendMock).toHaveBeenCalledTimes(2);
    });

    expect(sendCalls[0]).toContain("cut with scissors");
    expect(sendCalls[1]).toContain("actually clamp the bleeder");
    expect(sendCalls[1]).not.toContain("no use scalpel");
    expect(sendCalls[1]).not.toContain("wait hold forceps instead");
  });

  it("pause drops pending", async () => {
    const deferredSend1 = createDeferred<AgentRunResult>();
    const sendMock = vi.fn(async () => deferredSend1.promise);

    const { liveSession } = createFakeLiveSession({
      session: { send: sendMock },
    });

    const factory: SessionFactory = vi.fn(async () => liveSession);
    const controller = new CreatureController(store, hooks, factory);

    await controller.start("live");

    // Active command
    controller.command("probe wound");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Queue pending command
    controller.command("apply bandage");

    // Pause the game / controller
    controller.pause();
    expect(store.getSnapshot().paused).toBe(true);

    // Settle send 1
    deferredSend1.resolve(
      createDefaultRunResult({ text: "Paused task finished." }),
    );
    await deferredSend1.promise;

    await vi.waitFor(() => {
      expect(controller.getSnapshot().status).toBe("idle");
    });

    // Pending 'apply bandage' must not be sent
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Resume the game
    controller.resume();
    expect(store.getSnapshot().paused).toBe(false);

    // Resuming must not trigger dropped pending command
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("aborted next send has previousActionInterrupted observation", async () => {
    const deferredSend1 = createDeferred<AgentRunResult>();
    const deferredSend2 = createDeferred<AgentRunResult>();
    const promptsSent: string[] = [];

    const sendMock = vi.fn(async (prompt: { text: string }) => {
      promptsSent.push(prompt.text);
      if (promptsSent.length === 1) {
        return deferredSend1.promise;
      }
      if (promptsSent.length === 2) {
        return deferredSend2.promise;
      }
      return createDefaultRunResult({ text: "Uninterrupted result." });
    });

    const { liveSession } = createFakeLiveSession({
      session: { send: sendMock },
    });

    const factory: SessionFactory = vi.fn(async () => liveSession);
    const controller = new CreatureController(store, hooks, factory);

    await controller.start("live");

    // 1. Send command 1
    controller.command("first action");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // 2. Interrupt command 1 with command 2 while command 1 is still running
    controller.command("correction action");

    // 3. Settle command 1
    deferredSend1.resolve(
      createDefaultRunResult({ text: "First action response" }),
    );
    await deferredSend1.promise;

    // Command 2 has now been sent
    await vi.waitFor(() => {
      expect(sendMock).toHaveBeenCalledTimes(2);
    });

    const command2Prompt = promptsSent[1];
    expect(command2Prompt).toContain("correction action");

    // Extract observation JSON
    const match2 = command2Prompt.match(/CURRENT OBSERVATION: (\{.*\})/);
    expect(match2).not.toBeNull();
    const obs2 = JSON.parse(match2![1]) as {
      previousActionInterrupted?: boolean;
    };
    expect(obs2.previousActionInterrupted).toBe(true);

    // 4. Settle command 2
    deferredSend2.resolve(
      createDefaultRunResult({ text: "Correction response" }),
    );
    await deferredSend2.promise;

    await vi.waitFor(() => {
      expect(controller.getSnapshot().status).toBe("idle");
    });

    // 5. Send command 3 without interrupting any active command
    controller.command("third action normal");

    await vi.waitFor(() => {
      expect(sendMock).toHaveBeenCalledTimes(3);
    });

    const command3Prompt = promptsSent[2];
    const match3 = command3Prompt.match(/CURRENT OBSERVATION: (\{.*\})/);
    expect(match3).not.toBeNull();
    const obs3 = JSON.parse(match3![1]) as {
      previousActionInterrupted?: boolean;
    };
    expect(obs3.previousActionInterrupted).toBe(false);
  });

  it("live restart starts while old send and close remain pending", async () => {
    let session1Hooks!: {
      onVocalize(cue: VocalCue): void;
      onPause(): void;
      onAction(): void;
    };
    const deferredSendSession1 = createDeferred<AgentRunResult>();
    const deferredCloseSession1 = createDeferred<void>();
    const deferredSendSession2 = createDeferred<AgentRunResult>();

    const { liveSession: session1, closeMock: closeSession1 } =
      createFakeLiveSession({
        session: {
          send: vi.fn(async () => deferredSendSession1.promise),
        },
        close: async () => deferredCloseSession1.promise,
      });

    const { liveSession: session2 } = createFakeLiveSession({
      session: {
        send: vi.fn(async () => deferredSendSession2.promise),
      },
    });

    let factoryCallCount = 0;
    const factory: SessionFactory = vi.fn(async (_store, h) => {
      factoryCallCount++;
      if (factoryCallCount === 1) {
        session1Hooks = h;
        return session1;
      }
      return session2;
    });

    const controller = new CreatureController(store, hooks, factory);

    // Start session 1
    await controller.start("live");
    controller.command("command in session 1");

    // Restart into session 2 while session 1 send is in-flight
    await controller.start("live");
    expect(closeSession1).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().turns).toBe(0);
    controller.command("command in session 2");
    expect(controller.getSnapshot().status).toBe("thinking");

    // Old hooks cannot alter the active replacement session.
    session1Hooks.onVocalize("fear");
    session1Hooks.onAction();
    session1Hooks.onPause();
    expect(store.getSnapshot().paused).toBe(false);
    expect(controller.getSnapshot().status).toBe("thinking");

    // The old send can settle after restart without changing the new operation.
    deferredSendSession1.resolve(
      createDefaultRunResult({
        text: "Stale session 1 speech that must be discarded",
        turns: 5,
      }),
    );
    await deferredSendSession1.promise;

    // Old session cues must not reach the active hook.
    expect(hooks.vocalize).not.toHaveBeenCalledWith(
      "Stale session 1 speech that must be discarded",
    );
    expect(hooks.vocalize).not.toHaveBeenCalledWith("fear");
    expect(controller.getSnapshot().turns).toBe(0);
    expect(controller.getSnapshot().status).toBe("thinking");

    deferredSendSession2.resolve(createDefaultRunResult({ turns: 1 }));
    await vi.waitFor(() => {
      expect(controller.getSnapshot().status).toBe("idle");
    });
    expect(controller.getSnapshot().turns).toBe(1);

    await controller.dispose();
  });

  it("rehearsal restart starts while old live close remains pending", async () => {
    let oldHooks!: {
      onVocalize(cue: VocalCue): void;
      onPause(): void;
      onAction(): void;
    };
    const deferredClose = createDeferred<void>();
    const { liveSession, closeMock } = createFakeLiveSession({
      close: async () => deferredClose.promise,
    });
    const factory: SessionFactory = vi.fn(async (_store, receivedHooks) => {
      oldHooks = receivedHooks;
      return liveSession;
    });
    const controller = new CreatureController(store, hooks, factory);

    await controller.start("live");
    await controller.start("rehearsal");

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      mode: "rehearsal",
      status: "idle",
    });
    expect(store.getSnapshot()).toMatchObject({
      phase: "playing",
      paused: false,
    });

    oldHooks.onVocalize("anger");
    oldHooks.onAction();
    oldHooks.onPause();

    expect(hooks.vocalize).not.toHaveBeenCalledWith("anger");
    expect(controller.getSnapshot().status).toBe("idle");
    expect(store.getSnapshot().paused).toBe(false);

    await controller.dispose();
  });

  describe("connection abort/timedout late resolution cannot start game", () => {
    it("aborted connection late resolution does not start game and closes session", async () => {
      const deferredConnection = createDeferred<LiveSession>();
      const factory: SessionFactory = vi.fn(
        (_store, _hooks, _signal) => deferredConnection.promise,
      );

      const controller = new CreatureController(store, hooks, factory);

      // Start connecting
      const startPromise = controller.start("live");
      expect(controller.getSnapshot().status).toBe("connecting");

      // Abort connection before it resolves
      controller.stop();

      // Late resolution arrives
      const { liveSession, closeMock } = createFakeLiveSession();
      deferredConnection.resolve(liveSession);
      await startPromise;
      await deferredConnection.promise;
      await Promise.resolve();
      await Promise.resolve();

      // Game must not have started and late session must be closed
      expect(store.getSnapshot().phase).not.toBe("playing");
      expect(closeMock).toHaveBeenCalled();

      // Controller must not be able to command the closed/aborted late session
      controller.command("do surgery");
      expect(liveSession.session.send).not.toHaveBeenCalled();
    });

    it("timed out connection late resolution does not start game and closes session", async () => {
      vi.useFakeTimers();
      try {
        const deferredConnection = createDeferred<LiveSession>();
        const factory: SessionFactory = vi.fn(() => deferredConnection.promise);

        const controller = new CreatureController(store, hooks, factory);

        const startPromise = controller.start("live");
        expect(controller.getSnapshot().status).toBe("connecting");

        // Advance past 12s timeout
        vi.advanceTimersByTime(12000);
        await startPromise;

        // Status should be error
        expect(controller.getSnapshot().status).toBe("error");
        expect(controller.getSnapshot().error).toContain("RUN did not connect");
        expect(store.getSnapshot().phase).not.toBe("playing");

        // Late resolution arrives after timeout
        const { liveSession, closeMock } = createFakeLiveSession();
        deferredConnection.resolve(liveSession);
        await deferredConnection.promise;
        await Promise.resolve();
        await Promise.resolve();

        // Game must still not be playing and late session closed
        expect(store.getSnapshot().phase).not.toBe("playing");
        expect(closeMock).toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("error");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("dispose blocks start/rehearse", () => {
    it("blocks start and rehearse after dispose", async () => {
      const { liveSession } = createFakeLiveSession();
      const factory: SessionFactory = vi.fn(async () => liveSession);

      const controller = new CreatureController(store, hooks, factory);

      // Start in rehearsal mode first
      await controller.start("rehearsal");
      expect(store.getSnapshot().phase).toBe("playing");

      // Dispose controller
      await controller.dispose();
      store.reset();
      expect(store.getSnapshot().phase).toBe("ready");

      // 1. Attempting start after dispose must not start game or call factory
      await controller.start("live");
      expect(factory).not.toHaveBeenCalled();
      expect(store.getSnapshot().phase).toBe("ready");

      await controller.start("rehearsal");
      expect(store.getSnapshot().phase).toBe("ready");

      // 2. Attempting rehearse after dispose must not run actions
      const runSpy = vi.spyOn(store, "run");
      const sampleAction: GameAction = {
        kind: "adjust_lamp",
        position: "wound",
      };

      await controller.rehearse([sampleAction]);

      expect(runSpy).not.toHaveBeenCalled();
      expect(controller.getSnapshot().status).not.toBe("acting");
    });
  });

  describe("encouragement and state safety", () => {
    it("good, keep going does not abort active", async () => {
      let currentHooks!: {
        onVocalize(cue: VocalCue): void;
        onPause(): void;
        onAction(): void;
      };
      const deferredSend = createDeferred<AgentRunResult>();
      const sendMock = vi.fn(
        (_prompt: { text: string }) => deferredSend.promise,
      );

      const { liveSession, fakeSession } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async (_store, hooksArg) => {
        currentHooks = hooksArg;
        return liveSession;
      });
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");
      const silenceMock = hooks.silence as ReturnType<typeof vi.fn>;
      silenceMock.mockClear();

      // 1. Start an active command
      controller.command("incise along guide line");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot().status).toBe("thinking");

      // 2. Encouragements should NOT abort or interrupt the active task
      controller.command("good, keep going");
      controller.command("well done");
      controller.command("you are safe");

      expect(fakeSession.abort).not.toHaveBeenCalled();
      expect(silenceMock).not.toHaveBeenCalled();
      expect(controller.getSnapshot().status).toBe("thinking");

      // 3. A validated wordless cue emitted via the tool hook.
      currentHooks.onVocalize("relief");
      expect(hooks.vocalize).toHaveBeenCalledWith("relief");

      // 4. Complete the active task successfully with raw planning thoughts in result.text
      deferredSend.resolve(
        createDefaultRunResult({
          text: "Planning thoughts: Cut along guideline.",
        }),
      );
      await deferredSend.promise;

      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });

      // Raw planning text never emits a cue.
      expect(hooks.vocalize).not.toHaveBeenCalledWith(
        "Planning thoughts: Cut along guideline.",
      );
    });

    it("idle STOP does not claim previousActionInterrupted", async () => {
      const promptsSent: string[] = [];
      const sendMock = vi.fn(async (prompt: { text: string }) => {
        promptsSent.push(prompt.text);
        return createDefaultRunResult({ text: "Done." });
      });

      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async () => liveSession);
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");
      expect(controller.getSnapshot().status).toBe("idle");

      // STOP while completely idle (no running task, no pending action)
      controller.stop();
      expect(controller.getSnapshot().status).toBe("idle");

      // Send next command
      controller.command("inspect patient status");

      await vi.waitFor(() => {
        expect(sendMock).toHaveBeenCalledTimes(1);
      });

      const match = promptsSent[0].match(/CURRENT OBSERVATION: (\{.*\})/);
      expect(match).not.toBeNull();
      const obs = JSON.parse(match![1]) as {
        previousActionInterrupted?: boolean;
      };
      expect(obs.previousActionInterrupted).toBe(false);
    });

    it("SDK activity every30s keeps active past55s", async () => {
      vi.useFakeTimers();
      try {
        const deferredSend = createDeferred<AgentRunResult>();
        const sendMock = vi.fn(async () => deferredSend.promise);

        const { liveSession, fakeSession, emitEvent } = createFakeLiveSession({
          session: { send: sendMock },
        });

        const factory: SessionFactory = vi.fn(async () => liveSession);
        const controller = new CreatureController(store, hooks, factory);

        await controller.start("live");

        controller.command("long continuous operation");
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot().status).toBe("thinking");

        // At 30s: SDK activity arrives
        vi.advanceTimersByTime(30000);
        emitEvent();
        expect(fakeSession.abort).not.toHaveBeenCalled();

        // At 60s (> 55s total): SDK activity arrives again
        vi.advanceTimersByTime(30000);
        emitEvent();
        expect(fakeSession.abort).not.toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("thinking");

        // At 70s: Resolve the send
        vi.advanceTimersByTime(10000);
        deferredSend.resolve(
          createDefaultRunResult({ text: "Finished long op" }),
        );
        await deferredSend.promise;

        expect(controller.getSnapshot().status).toBe("thinking");
      } finally {
        vi.useRealTimers();
      }
    });

    it("new live session can run before stale oldsend settles", async () => {
      let session1Hooks!: {
        onVocalize(cue: VocalCue): void;
        onPause(): void;
        onAction(): void;
      };
      let session2Hooks!: {
        onVocalize(cue: VocalCue): void;
        onPause(): void;
        onAction(): void;
      };

      const deferredSendOld = createDeferred<AgentRunResult>();
      const sendMockSession1 = vi.fn(async () => deferredSendOld.promise);
      const sendMockSession2 = vi.fn(async () =>
        createDefaultRunResult({
          text: "Session 2 planning thoughts",
          turns: 2,
        }),
      );

      const { liveSession: session1 } = createFakeLiveSession({
        session: { send: sendMockSession1 },
      });

      const { liveSession: session2 } = createFakeLiveSession({
        session: { send: sendMockSession2 },
      });

      let factoryCount = 0;
      const factory: SessionFactory = vi.fn(async (_store, hooksArg) => {
        factoryCount++;
        if (factoryCount === 1) {
          session1Hooks = hooksArg;
          return session1;
        }
        session2Hooks = hooksArg;
        return session2;
      });

      const controller = new CreatureController(store, hooks, factory);

      // Start session 1
      await controller.start("live");
      controller.command("command on session 1");
      expect(sendMockSession1).toHaveBeenCalledTimes(1);

      // Restart into session 2 while session 1 send is STILL pending
      await controller.start("live");
      expect(controller.getSnapshot().turns).toBe(0);

      // Run a command on session 2 BEFORE session 1 send settles
      controller.command("command on session 2");
      expect(sendMockSession2).toHaveBeenCalledTimes(1);

      // A validated cue emitted on session 2 via the tool hook.
      session2Hooks.onVocalize("relief");

      await vi.waitFor(() => {
        expect(controller.getSnapshot().turns).toBe(2);
      });
      expect(hooks.vocalize).toHaveBeenCalledWith("relief");

      // Now stale old send from session 1 settles and attempts hook
      session1Hooks.onVocalize("fear");
      deferredSendOld.resolve(
        createDefaultRunResult({
          text: "Stale ghost words from raw text",
          turns: 99,
        }),
      );
      await deferredSendOld.promise;
      await Promise.resolve();

      // Session 2 state must remain intact; old session cannot emit or mutate.
      expect(hooks.vocalize).not.toHaveBeenCalledWith("fear");
      expect(hooks.vocalize).not.toHaveBeenCalledWith(
        "Stale ghost words from raw text",
      );
      expect(controller.getSnapshot().turns).toBe(2);
    });

    it("old connection hooks cannot change new world", async () => {
      let oldHooks!: {
        onVocalize(cue: VocalCue): void;
        onPause(): void;
        onAction(): void;
      };

      const { liveSession: session1 } = createFakeLiveSession();
      const { liveSession: session2 } = createFakeLiveSession();

      let factoryCall = 0;
      const factory: SessionFactory = vi.fn(async (_s, h) => {
        factoryCall++;
        if (factoryCall === 1) {
          oldHooks = h;
          return session1;
        }
        return session2;
      });

      const controller = new CreatureController(store, hooks, factory);

      // Connect session 1 and capture its connection hooks
      await controller.start("live");
      expect(oldHooks).toBeDefined();

      // Restart into session 2
      await controller.start("live");
      // Try invoking old hooks from session 1
      oldHooks.onVocalize("pain");
      expect(hooks.vocalize).not.toHaveBeenCalledWith("pain");
      oldHooks.onPause();
      expect(store.getSnapshot().paused).toBe(false);

      oldHooks.onAction();
      expect(controller.getSnapshot().status).toBe("idle");
    });

    it("raw result text never emits a cue but validated cues do", async () => {
      let connectionHooks!: {
        onVocalize(cue: VocalCue): void;
        onPause(): void;
        onAction(): void;
      };
      const deferredSend = createDeferred<AgentRunResult>();
      const sendMock = vi.fn(async () => deferredSend.promise);

      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async (_store, hooksArg) => {
        connectionHooks = hooksArg;
        return liveSession;
      });

      const controller = new CreatureController(store, hooks, factory);
      await controller.start("live");
      // Issue player command
      controller.command("what do you see");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot().status).toBe("thinking");

      // A validated cue arrives through liveHooks.onVocalize.
      connectionHooks.onVocalize("pain");
      expect(hooks.vocalize).toHaveBeenCalledWith("pain");

      // AgentRunResult resolves with raw backend planning/reasoning text
      const planningText =
        "Internal planning: examine bleeding vessels before cutting.";
      deferredSend.resolve(
        createDefaultRunResult({ text: planningText, turns: 1 }),
      );
      await deferredSend.promise;

      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });

      // Raw result text must never emit a cue.
      expect(hooks.vocalize).not.toHaveBeenCalledWith(planningText);

      // Raw result text must not be recorded as creature dialogue notes or journal in store
      expect(
        store.getSnapshot().notes.some((n) => n.includes(planningText)),
      ).toBe(false);
      expect(
        store.getSnapshot().journal.some((j) => j.text.includes(planningText)),
      ).toBe(false);
    });

    it("blackout between queued correction and oldsend settlement (no PLAYER COMMAND from unconscious)", async () => {
      const deferredSend1 = createDeferred<AgentRunResult>();
      const promptsSent: string[] = [];
      const sendMock = vi.fn(async (prompt: { text: string }) => {
        promptsSent.push(prompt.text);
        if (promptsSent.length === 1) {
          return deferredSend1.promise;
        }
        return createDefaultRunResult({ text: "Observation handled" });
      });

      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async () => liveSession);
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");

      // Send initial command
      controller.command("inspect wound");
      expect(sendMock).toHaveBeenCalledTimes(1);

      // Queue player correction while send 1 is active
      controller.command("use scalpel carefully");

      // Before send 1 settles, patient enters blackout
      vi.spyOn(store, "getSnapshot").mockReturnValue({
        ...store.getSnapshot(),
        phase: "blackout",
        patient: {
          ...store.getSnapshot().patient,
          blackoutCount: 1,
        },
      });

      // Settle send 1
      deferredSend1.resolve(
        createDefaultRunResult({ text: "Finished initial inspection." }),
      );
      await deferredSend1.promise;

      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });

      // Queued player correction must be dropped because patient is in blackout (unconscious)
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(
        promptsSent.some((p) =>
          p.includes("PLAYER COMMAND: use scalpel carefully"),
        ),
      ).toBe(false);

      // Trigger observeEvents: emits ROOM EVENT regarding blackout, NOT the queued player command
      controller.observeEvents();

      await vi.waitFor(() => {
        expect(sendMock).toHaveBeenCalledTimes(2);
      });

      expect(promptsSent[1]).toContain("ROOM EVENT");
      expect(promptsSent[1]).toContain("The patient has lost consciousness");
      expect(promptsSent[1]).not.toContain("PLAYER COMMAND");
    });

    it("auto-drains a queued room event without a false capped wait hint", async () => {
      const firstSend = createDeferred<AgentRunResult>();
      const secondSend = createDeferred<AgentRunResult>();
      const promptsSent: string[] = [];
      const sendMock = vi.fn(async (prompt: { text: string }) => {
        promptsSent.push(prompt.text);
        return promptsSent.length === 1 ? firstSend.promise : secondSend.promise;
      });
      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });
      const factory: SessionFactory = vi.fn(async () => liveSession);
      const noteSpy = vi.spyOn(store, "note");
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");
      controller.command("care for the patient");
      expect(sendMock).toHaveBeenCalledTimes(1);

      const state = store.getSnapshot();
      const snapshotSpy = vi.spyOn(store, "getSnapshot").mockReturnValue({
        ...state,
        environment: {
          ...state.environment,
          eventCount: 1,
          lastEvent: "A small fire has broken out in the corner!",
        },
      });
      controller.observeEvents();
      snapshotSpy.mockRestore();

      firstSend.resolve(
        createDefaultRunResult({ finishReason: "max_turns", turns: 12 }),
      );

      await vi.waitFor(() => {
        expect(sendMock).toHaveBeenCalledTimes(2);
      });
      expect(promptsSent[1]).toContain("ROOM EVENT");
      expect(promptsSent[1]).toContain("small fire");
      expect(controller.getSnapshot()).toMatchObject({
        status: "thinking",
        needsInstruction: false,
      });
      expect(noteSpy).not.toHaveBeenCalledWith(
        "system",
        "He pauses to listen. Give the next instruction.",
      );

      secondSend.resolve(createDefaultRunResult({ turns: 2 }));
      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });
      expect(controller.getSnapshot().needsInstruction).toBe(false);
      expect(noteSpy).not.toHaveBeenCalledWith(
        "system",
        "He pauses to listen. Give the next instruction.",
      );
    });

    it("requests a new instruction when a capped run has no queued input", async () => {
      const send = createDeferred<AgentRunResult>();
      const sendMock = vi.fn(async () => send.promise);
      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });
      const factory: SessionFactory = vi.fn(async () => liveSession);
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");
      controller.command("care for the patient");
      send.resolve(
        createDefaultRunResult({ finishReason: "max_turns", turns: 12 }),
      );

      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });
      expect(controller.getSnapshot()).toMatchObject({
        turns: 12,
        needsInstruction: true,
      });
      expect(
        store
          .getSnapshot()
          .journal.filter(
            (entry) =>
              entry.kind === "system" &&
              entry.text === "He pauses to listen. Give the next instruction.",
          ),
      ).toHaveLength(1);
    });

    it("correction then good retainscorrection", async () => {
      const deferredSend1 = createDeferred<AgentRunResult>();
      const promptsSent: string[] = [];
      const sendMock = vi.fn(async (prompt: { text: string }) => {
        promptsSent.push(prompt.text);
        if (promptsSent.length === 1) {
          return deferredSend1.promise;
        }
        return createDefaultRunResult({ text: "Handled combined correction" });
      });

      const { liveSession } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async () => liveSession);
      const controller = new CreatureController(store, hooks, factory);

      await controller.start("live");

      // 1. Send active command
      controller.command("cut incision");
      expect(sendMock).toHaveBeenCalledTimes(1);

      // 2. While running, player sends correction
      controller.command("hold clamp instead");

      // 3. While still running, player adds encouragement
      controller.command("good, keep going");

      // 4. Settle initial command
      deferredSend1.resolve(createDefaultRunResult({ text: "Aborted cut" }));
      await deferredSend1.promise;

      // 5. Drain should send the retained correction appended with encouragement
      await vi.waitFor(() => {
        expect(sendMock).toHaveBeenCalledTimes(2);
      });

      const prompt2 = promptsSent[1];
      expect(prompt2).toContain(
        "PLAYER COMMAND: hold clamp instead good, keep going",
      );
      expect(prompt2).toContain("hold clamp instead");
    });

    it("inactivity timeout preserves the operation and resumes with a replacement session", async () => {
      vi.useFakeTimers();
      try {
        const timedOutSend = createDeferred<AgentRunResult>();
        const timedOutCloseResult = createDeferred<void>();
        const resumedSend = createDeferred<AgentRunResult>();
        const timedOutSendMock = vi.fn(async () => timedOutSend.promise);
        const resumedSendMock = vi.fn(async () => resumedSend.promise);
        const {
          liveSession: timedOutSession,
          fakeSession: timedOutAgentSession,
          closeMock: timedOutClose,
        } = createFakeLiveSession({
          session: { send: timedOutSendMock },
          close: async () => timedOutCloseResult.promise,
        });
        const { liveSession: resumedSession, closeMock: resumedClose } =
          createFakeLiveSession({
            session: { send: resumedSendMock },
          });
        let factoryCalls = 0;
        const connectionHooks: Array<{
          onVocalize(cue: VocalCue): void;
          onPause(): void;
          onAction(): void;
        }> = [];
        const factory: SessionFactory = vi.fn(async (_store, receivedHooks) => {
          factoryCalls++;
          connectionHooks.push(receivedHooks);
          return factoryCalls === 1 ? timedOutSession : resumedSession;
        });
        const controller = new CreatureController(store, hooks, factory);

        await controller.start("live");
        await store.run({ kind: "set_rule", rule: "gentle", enabled: true });
        controller.command("check the wound");

        await vi.advanceTimersByTimeAsync(45000);

        expect(controller.getSnapshot()).toMatchObject({
          status: "error",
          canResume: true,
        });
        expect(controller.getSnapshot().error).toContain("took too long");
        expect(store.getSnapshot().paused).toBe(true);
        expect(store.getSnapshot().rules.gentle).toBe(true);
        expect(timedOutAgentSession.abort).toHaveBeenCalledWith(
          "Connection timeout",
        );
        expect(timedOutClose).toHaveBeenCalledTimes(1);
        expect(resumedClose).not.toHaveBeenCalled();
        expect(factory).toHaveBeenCalledTimes(1);

        controller.resume();
        await vi.waitFor(() => {
          expect(controller.getSnapshot().status).toBe("idle");
        });
        expect(store.getSnapshot().paused).toBe(false);
        expect(controller.getSnapshot()).toMatchObject({
          status: "idle",
          error: null,
          canResume: false,
          needsInstruction: true,
        });
        expect(store.getSnapshot().rules.gentle).toBe(true);
        expect(factory).toHaveBeenCalledTimes(2);

        controller.command("continue carefully");
        expect(timedOutSendMock).toHaveBeenCalledTimes(1);
        expect(resumedSendMock).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot().status).toBe("thinking");

        connectionHooks[0].onVocalize("anger");
        connectionHooks[0].onAction();
        connectionHooks[0].onPause();
        expect(hooks.vocalize).not.toHaveBeenCalledWith("anger");
        expect(store.getSnapshot().paused).toBe(false);
        expect(controller.getSnapshot().status).toBe("thinking");

        timedOutSend.resolve(
          createDefaultRunResult({ turns: 99, text: "Late old result" }),
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(controller.getSnapshot().status).toBe("thinking");
        expect(controller.getSnapshot().turns).toBe(0);
        expect(store.getSnapshot().rules.gentle).toBe(true);

        resumedSend.resolve(createDefaultRunResult({ turns: 2 }));
        await resumedSend.promise;
        await vi.waitFor(() => {
          expect(controller.getSnapshot().status).toBe("idle");
        });
        expect(controller.getSnapshot().turns).toBe(2);

        await controller.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it("timeout blocks stale action and old connection hooks after resume", async () => {
      vi.useFakeTimers();
      try {
        let oldConnectionHooks!: {
          onVocalize(cue: VocalCue): void;
          onPause(): void;
          onAction(): void;
        };
        const timedOutSend = createDeferred<AgentRunResult>();
        const { liveSession: timedOutSession } = createFakeLiveSession({
          session: { send: vi.fn(async () => timedOutSend.promise) },
        });
        const { liveSession: resumedSession } = createFakeLiveSession();
        let factoryCalls = 0;
        const factory: SessionFactory = vi.fn(async (_store, receivedHooks) => {
          factoryCalls++;
          if (factoryCalls === 1) {
            oldConnectionHooks = receivedHooks;
            return timedOutSession;
          }
          return resumedSession;
        });
        const controller = new CreatureController(store, hooks, factory);

        await controller.start("live");
        controller.command("light the lantern");
        await vi.advanceTimersByTimeAsync(44000);

        const staleAction = store.run({ kind: "light_lantern" });
        expect(store.getSnapshot().pending?.action.kind).toBe("light_lantern");
        await vi.advanceTimersByTimeAsync(1000);

        await expect(staleAction).resolves.toMatchObject({ ok: false });
        expect(store.getSnapshot().pending).toBeNull();
        expect(store.getSnapshot().environment.lanternLit).toBe(false);
        expect(controller.getSnapshot().canResume).toBe(true);

        controller.resume();
        await vi.waitFor(() => {
          expect(controller.getSnapshot().status).toBe("idle");
        });
        const resumedSnapshot = controller.getSnapshot();
        oldConnectionHooks.onVocalize("fear");
        oldConnectionHooks.onAction();
        oldConnectionHooks.onPause();
        await vi.advanceTimersByTimeAsync(20000);

        expect(hooks.vocalize).not.toHaveBeenCalledWith("fear");
        expect(controller.getSnapshot()).toEqual(resumedSnapshot);
        expect(store.getSnapshot().environment.lanternLit).toBe(false);
        expect(store.getSnapshot().pending).toBeNull();

        timedOutSend.resolve(createDefaultRunResult({ turns: 12 }));
        await Promise.resolve();
        await Promise.resolve();
        expect(controller.getSnapshot()).toEqual(resumedSnapshot);
        expect(store.getSnapshot().environment.lanternLit).toBe(false);

        await controller.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it("stale oldrun45s timer cannotcancel newworldaction", async () => {
      vi.useFakeTimers();
      try {
        const deferredSendOld = createDeferred<AgentRunResult>();
        const deferredSendNew = createDeferred<AgentRunResult>();

        const sendMock1 = vi.fn(async () => deferredSendOld.promise);
        const sendMock2 = vi.fn(async () => deferredSendNew.promise);

        const { liveSession: session1 } = createFakeLiveSession({
          session: { send: sendMock1 },
        });

        const { liveSession: session2, fakeSession: fakeSession2 } =
          createFakeLiveSession({
            session: { send: sendMock2 },
          });

        let factoryCount = 0;
        const factory: SessionFactory = vi.fn(async () => {
          factoryCount++;
          return factoryCount === 1 ? session1 : session2;
        });

        const controller = new CreatureController(store, hooks, factory);

        // Epoch 1: start and run command
        await controller.start("live");
        controller.command("session 1 action");
        expect(sendMock1).toHaveBeenCalledTimes(1);

        // Advance 30s so session 1 timer will fire in 15s
        vi.advanceTimersByTime(30000);

        // Epoch 2: restart into session 2 while session 1 run is in-flight
        await controller.start("live");
        controller.command("session 2 new world action");
        expect(sendMock2).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot().status).toBe("thinking");

        // Advance 16s (session 1 elapsed = 46s > 45s, but session 2 elapsed = only 16s)
        vi.advanceTimersByTime(16000);

        // Session 1 timeout must NOT cancel or fail session 2's new world action
        expect(fakeSession2.abort).not.toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("thinking");
        expect(controller.getSnapshot().error).toBeNull();
        expect(store.getSnapshot().paused).toBe(false);

        // Session 2 settles cleanly
        deferredSendNew.resolve(
          createDefaultRunResult({ text: "New action succeeded" }),
        );
        await deferredSendNew.promise;
      } finally {
        vi.useRealTimers();
      }
    });

    it("modelerror resume preservesstageanditems", async () => {
      const deferredSend1 = createDeferred<AgentRunResult>();
      const deferredSend2 = createDeferred<AgentRunResult>();

      let sendCalls = 0;
      const sendMock = vi.fn(async () => {
        sendCalls++;
        return sendCalls === 1 ? deferredSend1.promise : deferredSend2.promise;
      });

      const { liveSession, closeMock } = createFakeLiveSession({
        session: { send: sendMock },
      });

      const factory: SessionFactory = vi.fn(async () => liveSession);

      const controller = new CreatureController(store, hooks, factory);
      await controller.start("live");

      vi.useFakeTimers();
      const lampAction = store.run({ kind: "adjust_lamp", position: "wound" });
      await vi.advanceTimersByTimeAsync(25000);
      await lampAction;
      const pickupAction = store.run({ kind: "pick_up", item: "scalpel" });
      await vi.advanceTimersByTimeAsync(25000);
      await pickupAction;
      vi.useRealTimers();
      expect(store.getSnapshot().holding).toBe("scalpel");
      expect(store.getSnapshot().lamp).toBe("wound");

      // Issue command that triggers thinking
      controller.command("make precise cut");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot().status).toBe("thinking");

      // Model returns an error finish reason
      deferredSend1.resolve(
        createDefaultRunResult({
          finishReason: "error",
          error: {
            code: "MODEL_FAILED",
            message: "Model failed to generate valid response",
          },
          turns: 1,
        }),
      );
      await deferredSend1.promise;

      // Settlement: status becomes error and canResume becomes true
      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("error");
      });
      expect(controller.getSnapshot().canResume).toBe(true);
      expect(controller.getSnapshot().error).toContain("RUN could not answer");
      expect(store.getSnapshot().paused).toBe(true);

      // Live session was NOT closed, store holding & lamp preserved
      expect(closeMock).not.toHaveBeenCalled();
      expect(store.getSnapshot().holding).toBe("scalpel");
      expect(store.getSnapshot().lamp).toBe("wound");
      expect(store.getSnapshot().phase).toBe("playing");

      // Player resumes after model error
      controller.resume();

      expect(controller.getSnapshot().status).toBe("idle");
      expect(controller.getSnapshot().error).toBeNull();
      expect(controller.getSnapshot().needsInstruction).toBe(true);
      expect(store.getSnapshot().paused).toBe(false);

      // World state is preserved after resume
      expect(store.getSnapshot().holding).toBe("scalpel");
      expect(store.getSnapshot().lamp).toBe("wound");
      expect(store.getSnapshot().phase).toBe("playing");

      // Player can issue the next instruction on the same preserved live session
      controller.command("continue surgery");
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(controller.getSnapshot().status).toBe("thinking");

      deferredSend2.resolve(createDefaultRunResult({ text: "Continuing now" }));
      await deferredSend2.promise;

      await vi.waitFor(() => {
        expect(controller.getSnapshot().status).toBe("idle");
      });
    });
  });
});

it("reports a blocked guided action and clears the error on the next action", async () => {
  const store = new GameStore();
  const controller = new CreatureController(store, {
    vocalize: vi.fn(),
    silence: vi.fn(),
  });
  await controller.start("rehearsal");
  await store.run({ kind: "set_rule", rule: "noSharp", enabled: true });
  await controller.rehearse([{ kind: "pick_up", item: "needle" }]);
  expect(controller.getSnapshot().error).toMatch(/sharp/i);
  expect(controller.getSnapshot().status).toBe("idle");
  await controller.rehearse([{ kind: "react", stimulus: "reassure" }]);
  expect(controller.getSnapshot().error).toBeNull();
  await controller.dispose();
  store.dispose();
});
