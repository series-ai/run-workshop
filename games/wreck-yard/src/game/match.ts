import {
  createSyncplayRunner,
  type SyncplayRoomTransport,
  type SyncplayRunner,
  type SyncplayRunnerSnapshot,
  type SyncplayRunnerStatus,
} from "@series-inc/rundot-syncplay/browser";
import {
  decodeYardInput,
  encodeYardInput,
  NEUTRAL_INPUT,
  type YardInput,
} from "../sim/input";
import { MAX_PLAYERS, TICK_RATE } from "../sim/constants";
import { createYardRuntime, yardRoomOptions, YARD_INPUT_OWNERSHIP } from "../sim/session";
import type { YardState } from "../sim/state";
import {
  interpolateYard,
  projectYard,
  type YardRender,
} from "../render/presentation";

/** Networked peers compare state checksums once a second. */
const NETWORK_CHECKSUM_INTERVAL = TICK_RATE;

export type MatchRequest =
  | { readonly kind: "solo" }
  | { readonly kind: "quick" }
  | { readonly kind: "create" }
  | { readonly kind: "join"; readonly code: string };

export type RoomRequest = Exclude<MatchRequest, { readonly kind: "solo" }>;

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
  readonly crew: CrewPresence;
}

export interface CrewPresence {
  readonly occupied: number | null;
  readonly capacity: number;
}

function crewPresence(snapshot: SyncplayRunnerSnapshot<YardRender>): CrewPresence {
  if (snapshot.status === "offline") return { occupied: 1, capacity: 1 };
  const capacity = snapshot.presence?.length || snapshot.occupancy?.maxPlayers || MAX_PLAYERS;
  if (snapshot.status === "stopped" || snapshot.status === "error") {
    return { occupied: null, capacity };
  }
  const presence = snapshot.presence;
  const occupied = presence?.length && !presence.includes("unknown")
    ? presence.filter((seat) => seat === "human" || seat === "substituted").length
    : snapshot.occupancy?.occupied ?? null;
  return { occupied, capacity };
}

function crewRender(render: YardRender, snapshot: SyncplayRunnerSnapshot<YardRender>): YardRender {
  if (snapshot.status === 'offline') return render;
  const players = render.players.filter((player) => {
    const presence = snapshot.presence?.[player.slot];
    return presence === 'human' || presence === 'substituted'
      || ((presence === undefined || presence === 'unknown') && snapshot.ready && player.slot === snapshot.localSlot);
  });
  return players.length === render.players.length ? render : { ...render, players };
}

function rosterChanged(previous: YardRender | null, current: YardRender | null): boolean {
  if (!previous || !current) return previous !== current;
  return previous.players.length !== current.players.length || previous.players.some((player, index) => {
    const next = current.players[index];
    return player.slot !== next?.slot || player.controlEpoch !== next.controlEpoch;
  });
}

export interface MatchDeps {
  readonly createRoomTransport: () => Promise<SyncplayRoomTransport>;
  readonly quickMatchTransport: () => Promise<SyncplayRoomTransport>;
  readonly joinRoomTransport: (code: string) => Promise<SyncplayRoomTransport>;
}

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
    technical.includes("server bundle") ||
    technical.includes("Failed to fetch") ||
    technical.includes("Connection lost") ||
    technical.includes("SYNCPLAY_TRANSPORT");

  if (isAbort) {
    return {
      error: technical,
      details: {
        title: "Multiplayer Server Unavailable",
        message:
          "The room could not start because the server was unavailable or the connection stopped. Check the connection. Then retry or create a new room.",
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

import { beginPhase, endPhase } from '../perf/recorder';
import { recordSampledInput, resetPerfInput } from '../perf/localInput';

export class MatchController {
  private readonly runner: SyncplayRunner<YardInput, YardRender, never>;
  private input: YardInput = NEUTRAL_INPUT;
  private sampled: { readonly input: YardInput; readonly frame: number } | null = null;
  private render: YardRender | null = null;
  private status: MatchStatus = "idle";
  private error: string | null = null;
  private errorDetails: MatchErrorDetails | null = null;
  private roomCode: string | null = null;
  private crew: CrewPresence = { occupied: null, capacity: MAX_PLAYERS };
  private lastPumpMs: number | null = null;
  /** Solo only: the pause menu holds the yard still (src/game/playGate.ts soloPaused). */
  private paused = false;
  private solo = false;
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
      inputOwnership: YARD_INPUT_OWNERSHIP,
      runtimeFactory: createYardRuntime,
      defaultInput: NEUTRAL_INPUT,
      encodeInput: encodeYardInput,
      decodeInput: decodeYardInput,
      localInputForTick: (slot, frame) => {
        this.sampled = { input: this.input, frame };
        recordSampledInput(this.input, frame, slot);
        return this.input;
      },
      presentation: { project: projectYard, interpolate: interpolateYard },
      maxOfflineStepsPerUpdate: 2,
      maxConfirmedFramesPerTurn: 2,
      pacing: { targetLeadTicks: 2, maxStepsPerPump: 2 },
      inputDelay: { minTicks: 1, maxTicks: 3 },
    });
    this.runner.subscribe((snapshot) => {
      const previous = this.render;
      const selected = snapshot.interpolatedRenderState ?? snapshot.renderState;
      if (selected) this.render = crewRender(selected, snapshot);
      const changedRoster = rosterChanged(previous, this.render);
      if (this.starting) return;
      // Offline start reports stopped while it acquires the runtime.
      // The controller remains connecting until the runtime is ready or fails.
      if (this.status === "connecting" && snapshot.status === "stopped") return;
      const next = mapStatus(snapshot.status);
      const nextCrew = crewPresence(snapshot);
      const nextError =
        snapshot.status === "error"
          ? (snapshot.error?.message ?? "Connection lost")
          : next === "live"
            ? null
            : this.error;
      if (next !== this.status || nextError !== this.error
        || nextCrew.occupied !== this.crew.occupied || nextCrew.capacity !== this.crew.capacity || changedRoster) {
        this.status = next;
        this.crew = nextCrew;
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

  /** Status, room, and crew changes. Read frame updates through getRender(). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The input that Syncplay read during the last pump, or null if it read none. */
  get sampledInput(): { readonly input: YardInput; readonly frame: number } | null { return this.sampled; }

  /** A new session clears presentation effects. Rollback keeps this value. */
  get sessionGeneration(): number { return this.startGeneration; }

  setInput(input: YardInput): void {
    this.input = input;
  }

  /** The latest render state. Returns sub-tick interpolated state when active. */
  getRender(): YardRender | null {
    return this.render;
  }

  async start(request: MatchRequest): Promise<void> {
    resetPerfInput();
    const generation = ++this.startGeneration;
    this.starting = true;
    this.runner.stop();
    this.starting = false;
    this.render = null;
    this.roomCode = null;
    this.lastPumpMs = null;
    this.sampled = null;
    this.paused = false;
    this.solo = request.kind === "solo";
    this.crew = { occupied: null, capacity: this.solo ? 1 : MAX_PLAYERS };
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
      if (this.startGeneration !== generation) {
        transport.close();
        return;
      }
      this.roomCode = transport.roomCode ?? null;
      this.publish();
      await this.runner.start({
        mode: "networked",
        connect: async () => transport,
        // A checksum encodes the full state (~1.7 ms) and hashes ~400 KB. Once a
        // second still finds a desync; Syncplay's networked default is every tick.
        checksumMode: "interval",
        checksumIntervalFrames: NETWORK_CHECKSUM_INTERVAL,
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
      this.crew = { occupied: null, capacity: this.crew.capacity };
      this.publish();
    }
  }

  /**
   * Holds a solo match still, or lets it run again. A room cannot pause for one
   * player, so this has no effect there. start() and stop() clear it.
   */
  setPaused(paused: boolean): void {
    this.paused = paused && this.solo;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Advance by wall clock. Returns true when at least one frame was produced. */
  pump(nowMs: number): boolean {
    this.sampled = null;
    if (this.runner.status === "stopped" || this.paused) {
      // No clock while paused, so the first pump after resume does not catch up.
      this.lastPumpMs = null;
      return false;
    }
    const before = this.render?.frame ?? -1;
    const deltaMs =
      this.lastPumpMs === null ? 0 : Math.max(0, nowMs - this.lastPumpMs);
    this.lastPumpMs = nowMs;
    // A throwing step halts the runner, which publishes its "error" status
    // to the subscriber above, then rethrows here.
    const timing = beginPhase('frame.pump');
    try { this.runner.update(deltaMs); }
    finally { endPhase('frame.pump', timing); }
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
      crew: this.crew,
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
    resetPerfInput();
    this.startGeneration += 1;
    this.starting = true;
    this.runner.stop();
    this.starting = false;
    this.render = null;
    this.roomCode = null;
    this.lastPumpMs = null;
    this.sampled = null;
    this.paused = false;
    this.solo = false;
    this.crew = { occupied: null, capacity: MAX_PLAYERS };
    this.status = "idle";
    this.error = null;
    this.errorDetails = null;
    this.publish();
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
