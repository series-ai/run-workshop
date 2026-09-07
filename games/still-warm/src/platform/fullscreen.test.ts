import type {
  FullscreenRequestOptions,
  FullscreenStateListener,
  PointerInputListener,
  SystemApi,
} from "@series-inc/rundot-game-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { initializeRunMock } = vi.hoisted(() => ({
  initializeRunMock: vi.fn(),
}));

vi.mock("../agent/runtime", () => ({
  initializeRun: initializeRunMock,
}));

import { FullscreenController } from "./fullscreen";

interface SystemHarness {
  system: SystemApi;
  emitState(state: { active: boolean; pointerLocked: boolean }): void;
  emitMove(dx: number, dy: number): void;
  stopState: ReturnType<typeof vi.fn>;
  stopInput: ReturnType<typeof vi.fn>;
}

interface LocalBrowserHarness {
  requestFullscreen: ReturnType<typeof vi.fn>;
  requestPointerLock: ReturnType<typeof vi.fn>;
  exitPointerLock: ReturnType<typeof vi.fn>;
  emitMove(dx: number, dy: number): void;
  exitFullscreen(): void;
  restore(): void;
}

function installLocalBrowser(
  hostname = "localhost",
  topLevel = true,
): LocalBrowserHarness {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const documentTarget = new EventTarget();
  const root = new EventTarget() as EventTarget & {
    requestFullscreen(): Promise<void>;
    requestPointerLock(): Promise<void>;
  };
  const browserDocument = documentTarget as EventTarget & {
    documentElement: typeof root;
    fullscreenElement: EventTarget | null;
    pointerLockElement: EventTarget | null;
    exitPointerLock(): void;
  };
  browserDocument.documentElement = root;
  browserDocument.fullscreenElement = null;
  browserDocument.pointerLockElement = null;

  const requestFullscreen = vi.fn(async () => {
    browserDocument.fullscreenElement = root;
    documentTarget.dispatchEvent(new Event("fullscreenchange"));
  });
  const requestPointerLock = vi.fn(async () => {
    browserDocument.pointerLockElement = root;
    documentTarget.dispatchEvent(new Event("pointerlockchange"));
  });
  const exitPointerLock = vi.fn(() => {
    browserDocument.pointerLockElement = null;
    documentTarget.dispatchEvent(new Event("pointerlockchange"));
  });
  root.requestFullscreen = requestFullscreen;
  root.requestPointerLock = requestPointerLock;
  browserDocument.exitPointerLock = exitPointerLock;

  const browserWindow = {
    location: { hostname },
  } as { location: { hostname: string }; top?: unknown };
  browserWindow.top = topLevel ? browserWindow : {};

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browserWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: browserDocument,
  });

  return {
    requestFullscreen,
    requestPointerLock,
    exitPointerLock,
    emitMove: (movementX, movementY) => {
      const event = new Event("mousemove");
      Object.defineProperties(event, {
        movementX: { value: movementX },
        movementY: { value: movementY },
      });
      documentTarget.dispatchEvent(event);
    },
    exitFullscreen: () => {
      browserDocument.fullscreenElement = null;
      browserDocument.pointerLockElement = null;
      documentTarget.dispatchEvent(new Event("fullscreenchange"));
    },
    restore: () => {
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
      if (previousDocument) {
        Object.defineProperty(globalThis, "document", previousDocument);
      } else {
        delete (globalThis as { document?: unknown }).document;
      }
    },
  };
}

function createSystemHarness(
  fullscreen: "unavailable" | "always-on" | "toggleable" = "toggleable",
  pointerLock = true,
): SystemHarness {
  let stateListener: FullscreenStateListener | null = null;
  let inputListener: PointerInputListener | null = null;
  const stopState = vi.fn();
  const stopInput = vi.fn();
  const system = {
    getEnvironment: vi.fn(() => ({
      capabilities: { fullscreen, pointerLock },
    })),
    getFullscreenState: vi.fn(async () => ({
      active: false,
      pointerLocked: false,
    })),
    requestFullscreen: vi.fn(async (options?: FullscreenRequestOptions) => ({
      active: true,
      pointerLocked: options?.pointerLock === true,
    })),
    setPointerLock: vi.fn(async (locked: boolean) => ({
      active: true,
      pointerLocked: locked,
    })),
    onFullscreenStateChange: vi.fn((listener: FullscreenStateListener) => {
      stateListener = listener;
      return stopState;
    }),
    onPointerInput: vi.fn((listener: PointerInputListener) => {
      inputListener = listener;
      return stopInput;
    }),
  } as unknown as SystemApi;

  return {
    system,
    emitState: (state) => stateListener?.(state),
    emitMove: (movementX, movementY) =>
      inputListener?.({ type: "move", movementX, movementY, buttons: 0 }),
    stopState,
    stopInput,
  };
}

describe("FullscreenController", () => {
  beforeEach(() => {
    initializeRunMock.mockReset();
  });

  it("enters RUN fullscreen with pointer lock and tracks host state", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const listener = vi.fn();
    const controller = new FullscreenController(vi.fn());
    controller.subscribe(listener);

    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({
      active: false,
      pointerLocked: false,
      supported: true,
    });

    await controller.enter();
    expect(harness.system.requestFullscreen).toHaveBeenCalledWith({
      pointerLock: true,
    });
    expect(controller.getSnapshot()).toEqual({
      active: true,
      pointerLocked: true,
      supported: true,
    });

    harness.emitState({ active: true, pointerLocked: false });
    expect(controller.getSnapshot().pointerLocked).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("routes only relative move input to the look callback", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const onMove = vi.fn();
    const controller = new FullscreenController(onMove);

    await controller.initialize();
    harness.emitMove(12, -7);

    expect(onMove).toHaveBeenCalledWith(12, -7);
  });

  it("keeps fullscreen available when pointer lock is unavailable", async () => {
    const harness = createSystemHarness("toggleable", false);
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    await controller.initialize();
    await controller.enter();
    await controller.capture();

    expect(controller.getSnapshot()).toEqual({
      active: true,
      pointerLocked: false,
      supported: true,
    });
    expect(harness.system.requestFullscreen).toHaveBeenCalledWith({});
    expect(harness.system.setPointerLock).not.toHaveBeenCalled();
    expect(harness.system.onPointerInput).not.toHaveBeenCalled();
  });

  it("keeps support and a host event that arrives during initialization", async () => {
    const harness = createSystemHarness();
    let resolveState!: (state: {
      active: boolean;
      pointerLocked: boolean;
    }) => void;
    vi.mocked(harness.system.getFullscreenState).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveState = resolve;
        }),
    );
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    const initialization = controller.initialize();
    await vi.waitFor(() => {
      expect(harness.system.onFullscreenStateChange).toHaveBeenCalled();
    });
    harness.emitState({ active: true, pointerLocked: true });
    resolveState({ active: false, pointerLocked: false });
    await initialization;

    expect(controller.getSnapshot()).toEqual({
      active: true,
      pointerLocked: true,
      supported: true,
    });
  });

  it("keeps subscribe bound for useSyncExternalStore", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());
    const subscribe = controller.subscribe;
    const listener = vi.fn();

    const unsubscribe = subscribe(listener);
    await controller.initialize();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();
    harness.emitState({ active: true, pointerLocked: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it("releases and recaptures the pointer without leaving fullscreen", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    await controller.initialize();
    await controller.enter();
    await controller.release();
    await controller.capture();

    expect(harness.system.setPointerLock).toHaveBeenNthCalledWith(1, false);
    expect(harness.system.setPointerLock).toHaveBeenNthCalledWith(2, true);
    expect(controller.getSnapshot()).toMatchObject({
      active: true,
      pointerLocked: true,
    });
  });

  it("does not call unsupported APIs and cleans up host subscriptions", async () => {
    const harness = createSystemHarness("unavailable", false);
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    await controller.initialize();
    await controller.enter();
    await controller.capture();

    expect(controller.getSnapshot().supported).toBe(false);
    expect(harness.system.requestFullscreen).not.toHaveBeenCalled();
    expect(harness.system.setPointerLock).not.toHaveBeenCalled();

    controller.dispose();
    expect(harness.stopState).not.toHaveBeenCalled();
    expect(harness.stopInput).not.toHaveBeenCalled();
  });

  it("can release safely before initialization finishes", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    await expect(controller.release()).resolves.toEqual({
      active: false,
      pointerLocked: false,
      supported: false,
    });
    expect(harness.system.setPointerLock).not.toHaveBeenCalled();
  });

  it("stops subscriptions and releases a captured cursor on dispose", async () => {
    const harness = createSystemHarness();
    initializeRunMock.mockResolvedValue({ system: harness.system });
    const controller = new FullscreenController(vi.fn());

    await controller.initialize();
    await controller.enter();
    controller.dispose();

    expect(harness.stopState).toHaveBeenCalledOnce();
    expect(harness.stopInput).toHaveBeenCalledOnce();
    expect(harness.system.setPointerLock).toHaveBeenCalledWith(false);
  });

  it("uses native fullscreen for an unsupported top-level local preview", async () => {
    const browser = installLocalBrowser();
    try {
      const harness = createSystemHarness("unavailable", false);
      initializeRunMock.mockResolvedValue({ system: harness.system });
      const onMove = vi.fn();
      const controller = new FullscreenController(onMove);

      await controller.initialize();
      expect(controller.getSnapshot().supported).toBe(true);
      await controller.enter();
      expect(browser.requestFullscreen).toHaveBeenCalledOnce();
      expect(browser.requestPointerLock).toHaveBeenCalledOnce();
      expect(harness.system.requestFullscreen).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toEqual({
        active: true,
        pointerLocked: true,
        supported: true,
      });

      browser.emitMove(8, -3);
      expect(onMove).toHaveBeenCalledWith(8, -3);

      await controller.release();
      expect(browser.exitPointerLock).toHaveBeenCalledOnce();
      expect(controller.getSnapshot()).toMatchObject({
        active: true,
        pointerLocked: false,
      });

      await controller.capture();
      browser.exitFullscreen();
      expect(controller.getSnapshot()).toMatchObject({
        active: false,
        pointerLocked: false,
      });

      await controller.enter();
      controller.dispose();
      expect(browser.exitPointerLock).toHaveBeenCalledTimes(2);
      browser.emitMove(2, 4);
      expect(onMove).toHaveBeenCalledOnce();
    } finally {
      browser.restore();
    }
  });

  it("waits for local fullscreen before it requests pointer lock", async () => {
    const browser = installLocalBrowser();
    try {
      const harness = createSystemHarness("unavailable", false);
      let finishFullscreen!: () => void;
      browser.requestFullscreen.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFullscreen = resolve;
          }),
      );
      initializeRunMock.mockResolvedValue({ system: harness.system });
      const controller = new FullscreenController(vi.fn());

      await controller.initialize();
      const entering = controller.enter();

      expect(browser.requestFullscreen).toHaveBeenCalledOnce();
      expect(browser.requestPointerLock).not.toHaveBeenCalled();
      finishFullscreen();
      await entering;
      expect(browser.requestPointerLock).toHaveBeenCalledOnce();
      controller.dispose();
    } finally {
      browser.restore();
    }
  });

  it("uses the local fallback when an old host omits fullscreen capabilities", async () => {
    const browser = installLocalBrowser();
    try {
      const harness = createSystemHarness();
      vi.mocked(harness.system.getEnvironment).mockReturnValue({
        capabilities: {
          ads: true,
          purchases: true,
          subscriptions: true,
        },
      } as unknown as ReturnType<SystemApi["getEnvironment"]>);
      initializeRunMock.mockResolvedValue({ system: harness.system });
      const controller = new FullscreenController(vi.fn());

      await controller.initialize();
      await controller.enter();

      expect(controller.getSnapshot()).toEqual({
        active: true,
        pointerLocked: true,
        supported: true,
      });
      expect(browser.requestFullscreen).toHaveBeenCalledOnce();
      expect(browser.requestPointerLock).toHaveBeenCalledOnce();
      expect(harness.system.requestFullscreen).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      browser.restore();
    }
  });

  it("keeps the cursor free in the guided preview without starting RUN", async () => {
    const browser = installLocalBrowser();
    try {
      const controller = new FullscreenController(vi.fn(), true);
      await controller.initialize();
      await controller.enter();
      await controller.capture();
      expect(initializeRunMock).not.toHaveBeenCalled();
      expect(browser.requestFullscreen).toHaveBeenCalledOnce();
      expect(browser.requestPointerLock).not.toHaveBeenCalled();
      expect(controller.getSnapshot().pointerLocked).toBe(false);
      controller.dispose();
    } finally {
      browser.restore();
    }
  });

  it("prefers RUN fullscreen over the local browser fallback", async () => {
    const browser = installLocalBrowser();
    try {
      const harness = createSystemHarness("toggleable", true);
      initializeRunMock.mockResolvedValue({ system: harness.system });
      const controller = new FullscreenController(vi.fn());

      await controller.initialize();
      await controller.enter();

      expect(harness.system.requestFullscreen).toHaveBeenCalledOnce();
      expect(browser.requestFullscreen).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      browser.restore();
    }
  });

  it.each([
    ["a hosted page", "run.game", true],
    ["an embedded localhost page", "localhost", false],
  ])(
    "does not use native fullscreen for %s",
    async (_name, hostname, topLevel) => {
      const browser = installLocalBrowser(hostname, topLevel);
      try {
        const harness = createSystemHarness("unavailable", false);
        initializeRunMock.mockResolvedValue({ system: harness.system });
        const controller = new FullscreenController(vi.fn());

        await controller.initialize();
        await controller.enter();

        expect(controller.getSnapshot().supported).toBe(false);
        expect(browser.requestFullscreen).not.toHaveBeenCalled();
        expect(harness.system.requestFullscreen).not.toHaveBeenCalled();
        controller.dispose();
      } finally {
        browser.restore();
      }
    },
  );
});
