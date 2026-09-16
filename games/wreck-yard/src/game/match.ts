import {
  createSyncplayRunner,
  type SyncplayRoomTransport,
  type SyncplayRunner,
  type SyncplayRunnerStatus,
} from "@series-inc/rundot-syncplay/browser";
import { TICK_RATE } from "../sim/constants";
import {
  decodeYardInput,
  encodeYardInput,
  NEUTRAL_INPUT,
  type YardInput,
} from "../sim/input";
import { createYardRuntime, yardRoomOptions } from "../sim/session";
import type { YardState } from "../sim/state";
import {
  interpolateYard,
  projectYard,
  type YardRender,
} from "../render/presentation";

export type MatchRequest =
  | { readonly kind: "solo" }
  | { readonly kind: "quick" }
  | { readonly kind: "create" }
  | { readonly kind: "join"; readonly code: string };

export type MatchStatus = "idle" | "connecting" | "live" | "error";

export interface MatchErrorDetails {
  readonly title: string;
  readonly message: string;
  readonly technical: string;
  readonly code?: string;
  readonly isServerError: boolean;
  readonly roomCode?: string | null;
}

export interface MatchSnapshot {
  readonly status: MatchStatus;
  readonly error: string | null;
  readonly errorDetails: MatchErrorDetails | null;
  readonly render: YardRender | null;
  readonly localSlot: number;
  readonly roomCode: string | null;
  readonly rollbackCount: number;
}

export interface MatchDeps {
  readonly createRoomTransport: () => Promise<SyncplayRoomTransport>;
  readonly quickMatchTransport: () => Promise<SyncplayRoomTransport>;
  readonly joinRoomTransport: (code: string) => Promise<SyncplayRoomTransport>;
}

const MAX_BURST_TICKS = 5 * TICK_RATE;

export function formatMatchError(
  cause: unknown,
  context?: { roomCode?: string | null },
): { error: string; details: MatchErrorDetails } {
  const technical = cause instanceof Error ? cause.message : String(cause);
  const code =
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    typeof (cause as { code: unknown }).code === "string"
      ? (cause as { code: string }).code
      : undefined;

  const isAbort =
    code === "runner.start-aborted" ||
    technical.includes("Runner start was aborted") ||
    technical.includes("aborted");

  const isNetwork =
    technical.includes("transport") ||
    technical.includes("connection") ||
    technical.includes("WebSocket") ||
    technical.includes("network") ||
    technical.includes("room rejected") ||
    technical.includes("Failed to fetch") ||
    technical.includes("Connection lost") ||
    technical.includes("SYNCPLAY_TRANSPORT");

  if (isAbort) {
    return {
      error: technical,
      details: {
        title: "Multiplayer Server Unavailable",
        message:
          "The multiplayer session could not start because the realtime server was unreachable or the connection was interrupted. You can play offline in Solo mode with full physics, buoyancy, and cutting, or retry connecting.",
        technical,
        code: code ?? "runner.start-aborted",
        isServerError: true,
        roomCode: context?.roomCode,
      },
    };
  }

  if (isNetwork) {
    return {
      error: technical,
      details: {
        title: "Multiplayer Connection Failed",
        message:
          "Could not connect to the multiplayer room. Verify that you have an active network connection and that the game server is reachable.",
        technical,
        code,
        isServerError: true,
        roomCode: context?.roomCode,
      },
    };
  }

  return {
    error: technical,
    details: {
      title: "Game Error",
      message: "An unexpected issue occurred while managing the game session.",
      technical,
      code,
      isServerError: false,
      roomCode: context?.roomCode,
    },
  };
}

function mapStatus(status: SyncplayRunnerStatus): MatchStatus {
  switch (status) {
    case "offline":
    case "live":
      return "live";
    case "connecting":
    case "syncing":
      return "connecting";
    case "error":
      return "error";
    case "stopped":
      return "idle";
    default: {
      const unreachable: never = status;
      throw new Error(`WRECK_YARD_STATUS_INVALID: ${String(unreachable)}`);
    }
  }
}

export class MatchController {
  private readonly runner: SyncplayRunner<YardInput, YardRender, never>;
  private input: YardInput = NEUTRAL_INPUT;
  private render: YardRender | null = null;
  private status: MatchStatus = "idle";
  private error: string | null = null;
  private errorDetails: MatchErrorDetails | null = null;
  private roomCode: string | null = null;
  private lastPumpMs: number | null = null;
  private starting = false;
  private startGeneration = 0;
  private readonly listeners = new Set<() => void>();

  constructor(public deps: MatchDeps) {
    this.runner = createSyncplayRunner<
      YardState,
      YardInput,
      unknown,
      YardState,
      YardRender
    >({
      runtimeFactory: createYardRuntime,
      defaultInput: NEUTRAL_INPUT,
      encodeInput: encodeYardInput,
      decodeInput: decodeYardInput,
      localInputForTick: () => this.input,
      presentation: { project: projectYard, interpolate: interpolateYard },
      maxOfflineStepsPerUpdate: MAX_BURST_TICKS,
      pacing: { targetLeadTicks: 2, maxStepsPerPump: 4 },
      inputDelay: { minTicks: 1, maxTicks: 3 },
    });
    this.runner.subscribe((snapshot) => {
      if (snapshot.interpolatedRenderState) {
        this.render = snapshot.interpolatedRenderState;
      } else if (snapshot.renderState) {
        this.render = snapshot.renderState;
      }
      if (this.starting) return;
      const next = mapStatus(snapshot.status);
      const nextError =
        snapshot.status === "error"
          ? (snapshot.error?.message ?? "Connection lost")
          : next === "live"
            ? null
            : this.error;
      if (next !== this.status || nextError !== this.error) {
        this.status = next;
        this.error = nextError;
        if (snapshot.status === "error" && snapshot.error) {
          this.errorDetails = formatMatchError(snapshot.error, {
            roomCode: this.roomCode,
          }).details;
        } else if (next === "live") {
          this.errorDetails = null;
        }
        this.publish();
      }
    });
  }

  /** Status and room changes only. Frame updates are read through `getRender()` each frame. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setInput(input: YardInput): void {
    this.input = input;
  }

  /** The latest render state. Returns sub-tick interpolated state when active. */
  getRender(): YardRender | null {
    if (this.runner.status === "live" || this.runner.status === "offline") {
      try {
        const interpolated = this.runner.getRenderState();
        if (interpolated) return interpolated;
      } catch {
        // Runner not ready or interpolation failed; fall back to last snapshot
      }
    }
    return this.render;
  }

  async start(request: MatchRequest): Promise<void> {
    const generation = ++this.startGeneration;
    this.starting = true;
    this.runner.stop();
    this.starting = false;
    this.render = null;
    this.roomCode = null;
    this.lastPumpMs = null;
    this.error = null;
    this.errorDetails = null;
    this.status = "connecting";
    this.publish();
    try {
      if (request.kind === "solo") {
        const room = yardRoomOptions(1);
        if (this.startGeneration !== generation) return;
        await this.runner.start({
          mode: "offline",
          identity: room.runtimeIdentity,
          sessionConfigBytes: room.sessionConfigBytes,
          playerCount: 1,
          localSlot: 0,
        });
        if (this.startGeneration !== generation) return;
        this.status = "live";
        this.publish();
        return;
      }
      const transport =
        request.kind === "quick"
          ? await this.deps.quickMatchTransport()
          : request.kind === "create"
            ? await this.deps.createRoomTransport()
            : await this.deps.joinRoomTransport(request.code);
      if (this.startGeneration !== generation) return;
      this.roomCode = transport.roomCode ?? null;
      this.publish();
      await this.runner.start({
        mode: "networked",
        connect: async () => transport,
      });
      if (this.startGeneration !== generation) return;
    } catch (cause) {
      if (this.startGeneration !== generation) return;
      this.starting = true;
      this.runner.stop();
      this.starting = false;
      const formatted = formatMatchError(cause, { roomCode: this.roomCode });
      this.error = formatted.error;
      this.errorDetails = formatted.details;
      this.status = "error";
      this.publish();
    }
  }

  /** Advance by wall clock. Returns true when at least one frame was produced. */
  pump(nowMs: number): boolean {
    if (this.runner.status === "stopped") {
      this.lastPumpMs = null;
      return false;
    }
    const before = this.render?.frame ?? -1;
    const deltaMs =
      this.lastPumpMs === null ? 0 : Math.max(0, nowMs - this.lastPumpMs);
    this.lastPumpMs = nowMs;
    this.runner.update(deltaMs);
    return (this.render?.frame ?? -1) > before;
  }

  snapshot(): MatchSnapshot {
    return {
      status: this.status,
      error: this.error,
      errorDetails: this.errorDetails,
      render: this.render,
      localSlot: this.runner.localSlot,
      roomCode: this.roomCode,
      rollbackCount: this.runner.rollbackCount,
    };
  }

  dismissError(): void {
    if (this.status === "error") {
      this.status = "idle";
      this.error = null;
      this.errorDetails = null;
      this.publish();
    }
  }

  stop(): void {
    this.startGeneration += 1;
    this.starting = true;
    this.runner.stop();
    this.starting = false;
    this.render = null;
    this.roomCode = null;
    this.lastPumpMs = null;
    this.status = "idle";
    this.error = null;
    this.errorDetails = null;
    this.publish();
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
