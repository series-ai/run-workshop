import type {
  FullscreenState,
  PointerInput,
  SystemApi,
} from "@series-inc/rundot-game-sdk";
import { initializeRun } from "../agent/runtime";

export interface FullscreenSnapshot {
  active: boolean;
  pointerLocked: boolean;
  supported: boolean;
}

export type FullscreenListener = () => void;

const INITIAL_SNAPSHOT: FullscreenSnapshot = {
  active: false,
  pointerLocked: false,
  supported: false,
};

type FullscreenMode = "none" | "run" | "local";

export class FullscreenController {
  private system: SystemApi | null = null;
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<FullscreenListener>();
  private stopState: (() => void) | null = null;
  private stopInput: (() => void) | null = null;
  private initialization: Promise<FullscreenSnapshot> | null = null;
  private pointerSupported = false;
  private mode: FullscreenMode = "none";
  private disposed = false;

  constructor(
    private readonly onMove: (dx: number, dy: number) => void,
    private readonly preview = false,
  ) {}

  initialize(): Promise<FullscreenSnapshot> {
    if (this.disposed) return Promise.resolve(this.snapshot);
    if (this.system) return Promise.resolve(this.snapshot);
    if (this.preview) {
      if (this.mode !== "local") this.initializeLocalPreview();
      return Promise.resolve(this.snapshot);
    }

    this.initialization ??= this.initializeSystem().catch(() => {
      this.initialization = null;
      return this.snapshot;
    });
    return this.initialization;
  }

  /** Call this before any other awaited work in a direct player action. */
  async enter(capturePointer = true): Promise<FullscreenSnapshot> {
    if (this.mode === "local") return this.enterLocalPreview(capturePointer);

    const system = this.system;
    if (this.mode !== "run" || !system || !this.snapshot.supported) {
      return this.snapshot;
    }

    try {
      const options =
        this.pointerSupported && capturePointer ? { pointerLock: true } : {};
      const state = await system.requestFullscreen(options);
      this.setFullscreenState(state);
    } catch {
      // Fullscreen is optional.
    }
    return this.snapshot;
  }

  /** Call this from the click that resumes mouse look. */
  async capture(): Promise<FullscreenSnapshot> {
    if (this.mode === "local") return this.captureLocalPreview();

    const system = this.system;
    if (this.mode !== "run" || !system || !this.pointerSupported) {
      return this.snapshot;
    }

    try {
      const state = await system.setPointerLock(true);
      this.setFullscreenState(state);
    } catch {
      // A player can refuse pointer capture.
    }
    return this.snapshot;
  }

  release(): Promise<FullscreenSnapshot> {
    if (this.mode === "local") {
      if (this.snapshot.pointerLocked) document.exitPointerLock();
      this.syncLocalPreviewState();
      return Promise.resolve(this.snapshot);
    }

    if (
      this.mode !== "run" ||
      !this.system ||
      !this.pointerSupported ||
      !this.snapshot.pointerLocked
    ) {
      return Promise.resolve(this.snapshot);
    }

    return this.system
      .setPointerLock(false)
      .then((state) => {
        this.setFullscreenState(state);
        return this.snapshot;
      })
      .catch(() => this.snapshot);
  }

  subscribe = (listener: FullscreenListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FullscreenSnapshot => this.snapshot;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopState?.();
    this.stopInput?.();
    this.stopState = null;
    this.stopInput = null;
    this.listeners.clear();

    if (this.mode === "local" && this.snapshot.pointerLocked) {
      document.exitPointerLock();
    } else if (
      this.mode === "run" &&
      this.system &&
      this.snapshot.pointerLocked
    ) {
      void this.system.setPointerLock(false).catch(() => undefined);
    }
  }

  private async initializeSystem(): Promise<FullscreenSnapshot> {
    const run = await initializeRun();
    if (this.disposed) return this.snapshot;

    this.system = run.system;
    const capabilities = this.system.getEnvironment().capabilities;
    const supported =
      capabilities.fullscreen === "toggleable" ||
      capabilities.fullscreen === "always-on";
    this.pointerSupported = capabilities.pointerLock === true;

    if (!supported) {
      if (this.initializeLocalPreview()) return this.snapshot;
      this.setSnapshot({ ...INITIAL_SNAPSHOT, supported: false });
      return this.snapshot;
    }

    this.mode = "run";
    this.setSnapshot({ ...this.snapshot, supported: true });

    let receivedStateEvent = false;
    this.stopState = this.system.onFullscreenStateChange((state) => {
      receivedStateEvent = true;
      this.setFullscreenState(state);
    });
    if (this.pointerSupported) {
      this.stopInput = this.system.onPointerInput((input) => {
        this.handlePointerInput(input);
      });
    }

    const state = await this.system.getFullscreenState();
    if (!this.disposed && !receivedStateEvent) {
      this.setSnapshot({ ...state, supported: true });
    }
    return this.snapshot;
  }

  private initializeLocalPreview(): boolean {
    if (!this.canUseLocalPreview()) return false;

    this.mode = "local";
    this.pointerSupported =
      !this.preview &&
      typeof document.documentElement.requestPointerLock === "function";
    this.syncLocalPreviewState();

    const syncState = () => this.syncLocalPreviewState();
    document.addEventListener("fullscreenchange", syncState);
    document.addEventListener("pointerlockchange", syncState);
    this.stopState = () => {
      document.removeEventListener("fullscreenchange", syncState);
      document.removeEventListener("pointerlockchange", syncState);
    };

    if (this.pointerSupported) {
      const move = (event: MouseEvent) => {
        if (document.pointerLockElement === document.documentElement) {
          this.onMove(event.movementX, event.movementY);
        }
      };
      document.addEventListener("mousemove", move);
      this.stopInput = () => document.removeEventListener("mousemove", move);
    }
    return true;
  }

  private canUseLocalPreview(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    try {
      const isLocalHost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      return (
        window.top === window &&
        (isLocalHost || this.preview) &&
        typeof document.documentElement.requestFullscreen === "function"
      );
    } catch {
      return false;
    }
  }

  private async enterLocalPreview(
    capturePointer: boolean,
  ): Promise<FullscreenSnapshot> {
    const root = document.documentElement;

    try {
      await root.requestFullscreen();
    } catch {
      // Fullscreen is optional.
    }

    if (this.pointerSupported && capturePointer) {
      try {
        await root.requestPointerLock();
      } catch {
        // A player can refuse pointer capture.
      }
    }

    this.syncLocalPreviewState();
    return this.snapshot;
  }

  private async captureLocalPreview(): Promise<FullscreenSnapshot> {
    if (!this.pointerSupported) return this.snapshot;

    try {
      await document.documentElement.requestPointerLock();
    } catch {
      // A player can refuse pointer capture.
    }
    this.syncLocalPreviewState();
    return this.snapshot;
  }

  private syncLocalPreviewState(): void {
    if (this.mode !== "local") return;
    const active = document.fullscreenElement === document.documentElement;
    this.setSnapshot({
      active,
      pointerLocked:
        active && document.pointerLockElement === document.documentElement,
      supported: true,
    });
  }

  private handlePointerInput(input: PointerInput): void {
    if (input.type === "move") {
      this.onMove(input.movementX, input.movementY);
    }
  }

  private setFullscreenState(state: FullscreenState): void {
    this.setSnapshot({ ...state, supported: this.snapshot.supported });
  }

  private setSnapshot(next: FullscreenSnapshot): void {
    if (this.disposed) return;
    if (
      next.active === this.snapshot.active &&
      next.pointerLocked === this.snapshot.pointerLocked &&
      next.supported === this.snapshot.supported
    ) {
      return;
    }

    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
