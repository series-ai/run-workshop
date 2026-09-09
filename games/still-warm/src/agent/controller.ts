import {
  RULES,
  type GameAction,
  type RuleId,
  type VocalCue,
} from "../game/model";
import { GameStore } from "../game/store";
import { observeStatus } from "../game/transitions";
import type { LiveHooks, LiveSession } from "./liveSession";
import { logConversation } from "./conversationLogger";

export type PlayMode = "live" | "rehearsal";
export interface ConnectionState {
  mode: PlayMode;
  status: "idle" | "connecting" | "thinking" | "acting" | "stopping" | "error";
  error: string | null;
  turns: number;
  canResume: boolean;
  needsInstruction: boolean;
  response: { text: string; id: number } | null;
}
interface Input {
  text: string;
  player: boolean;
}
export interface ControllerHooks {
  vocalize(cue: VocalCue): void;
  silence(): void;
}
export type SessionFactory = (
  store: GameStore,
  hooks: LiveHooks,
  signal: AbortSignal,
) => Promise<LiveSession>;

const loadLiveSession: SessionFactory = async (...args) => {
  const { createLiveSession } = await import("./liveSession");
  return createLiveSession(...args);
};

export class CreatureController {
  private snapshot: ConnectionState = {
    mode: "live",
    status: "idle",
    error: null,
    turns: 0,
    canResume: false,
    needsInstruction: false,
    response: null,
  };
  private listeners = new Set<() => void>();
  private live: LiveSession | null = null;
  private connectionAbort: AbortController | null = null;
  private runAbort: AbortController | null = null;
  private running: Promise<void> | null = null;
  private pendingPlayer: string | null = null;
  private pendingRoom: string[] = [];
  private blackoutPending = false;
  private scheduleRetirement: (() => void) | null = null;
  private epoch = 0;
  private interrupted = false;
  private closed = false;
  private eventCursor = 0;
  private blackoutCount = 0;
  private connectionToken: object | null = null;
  private replaceSessionOnResume = false;
  private responseId = 0;

  constructor(
    private readonly store: GameStore,
    private readonly hooks: ControllerHooks,
    private readonly factory: SessionFactory = loadLiveSession,
  ) {}
  getSnapshot = (): ConnectionState => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<ConnectionState>): void {
    if (this.closed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private createConnection(
    epoch: number,
    signal: AbortSignal,
  ): Promise<LiveSession> {
    const token = {};
    this.connectionToken = token;
    return this.factory(
      this.store,
      {
        onVocalize: (cue) => {
          if (
            token === this.connectionToken &&
            epoch === this.epoch &&
            !this.closed &&
            this.running !== null &&
            this.runAbort !== null &&
            !this.runAbort.signal.aborted &&
            !this.store.getSnapshot().paused
          )
            this.vocalize(cue);
        },
        onResponse: (text) => {
          if (
            token === this.connectionToken &&
            epoch === this.epoch &&
            !this.closed &&
            this.running !== null &&
            this.runAbort !== null &&
            !this.runAbort.signal.aborted &&
            !this.store.getSnapshot().paused
          ) {
            logConversation("AGENT_RESPONSE", { text });
            this.update({ response: { text, id: ++this.responseId } });
          }
        },
        onPause: () => {
          if (
            token === this.connectionToken &&
            epoch === this.epoch &&
            !this.closed
          )
            this.pause();
        },
        onAction: () => {
          if (
            token === this.connectionToken &&
            epoch === this.epoch &&
            !this.closed &&
            this.running !== null &&
            this.runAbort !== null &&
            !this.runAbort.signal.aborted &&
            !this.store.getSnapshot().paused
          )
            this.update({ status: "acting" });
        },
      },
      signal,
    );
  }

  async start(mode: PlayMode): Promise<void> {
    if (this.closed) return;
    this.stop();
    const epoch = ++this.epoch;
    this.interrupted = false;
    this.running = null;
    this.runAbort = null;
    this.scheduleRetirement = null;
    const old = this.live;
    this.live = null;
    this.store.reset();
    this.eventCursor = 0;
    this.blackoutCount = 0;
    this.connectionToken = null;
    this.replaceSessionOnResume = false;
    this.responseId = 0;
    this.update({
      mode,
      status: mode === "live" ? "connecting" : "idle",
      error: null,
      turns: 0,
      canResume: false,
      needsInstruction: false,
      response: null,
    });
    if (old) void old.close().catch(() => undefined);
    if (epoch !== this.epoch || this.closed) return;
    if (mode === "rehearsal") {
      this.store.start();
      this.store.note(
        "system",
        "Rehearsal. These controls run fixed actions. Live mode follows your own instructions.",
      );
      return;
    }
    const abort = new AbortController();
    this.connectionAbort = abort;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          abort.abort();
          if (epoch === this.epoch && !this.closed) this.connectionToken = null;
          reject(
            new Error(
              "RUN did not connect. Sign in with the RUN toolbar, then try again.",
            ),
          );
        }, 12000);
      });
      const connection = this.createConnection(epoch, abort.signal);
      void connection
        .then((live) => {
          if (abort.signal.aborted || epoch !== this.epoch || this.closed)
            void live.close().catch(() => undefined);
        })
        .catch(() => undefined);
      const live = await Promise.race([connection, timeout]);
      if (abort.signal.aborted || epoch !== this.epoch || this.closed) return;
      this.live = live;
      this.store.start();
      this.update({ status: "idle" });
    } catch (error) {
      if (epoch !== this.epoch || this.closed) return;
      if (abort.signal.aborted && !timedOut) {
        this.connectionToken = null;
        this.update({ status: "idle" });
        return;
      }
      this.connectionToken = null;
      this.fail(error);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (this.connectionAbort === abort) this.connectionAbort = null;
    }
  }

  private vocalize(cue: VocalCue): void {
    this.hooks.vocalize(cue);
  }

  command(raw: string): void {
    const text = raw.trim().slice(0, 1000);
    logConversation("PLAYER_COMMAND", { text });
    if (!text) return;
    if (
      /^(stop|stop now|stop please|please stop|stop stop)[.!?]*$/i.test(text)
    ) {
      this.stop();
      return;
    }
    const state = this.store.getSnapshot();
    if (
      this.snapshot.mode !== "live" ||
      !this.live ||
      state.paused ||
      state.phase !== "playing"
    )
      return;
    this.store.note("patient", text);
    if (
      this.running &&
      /^(good[,.]? (keep going|job)|good|well done|thank you|you can do this|you are safe|it['’]?s okay)[.!]*$/i.test(
        text,
      )
    ) {
      this.pendingPlayer = this.pendingPlayer
        ? `${this.pendingPlayer} ${text}`.slice(0, 1000)
        : text;
      return;
    }
    this.pendingPlayer = text;
    if (this.running) {
      this.interrupted = true;
      this.runAbort?.abort();
      this.live.session.abort("Player correction");
      this.store.cancel();
      this.hooks.silence();
      this.update({ status: "stopping" });
      this.scheduleRetirement?.();
    } else this.drain();
  }

  private drain(): void {
    if (
      (!this.blackoutPending &&
        this.pendingRoom.length === 0 &&
        this.pendingPlayer === null) ||
      this.running ||
      !this.live ||
      this.closed
    )
      return;
    const state = this.store.getSnapshot();
    if (
      state.paused ||
      (state.phase !== "playing" && state.phase !== "blackout")
    ) {
      this.pendingPlayer = null;
      this.pendingRoom = [];
      this.blackoutPending = false;
      return;
    }
    if (state.phase === "blackout") this.pendingPlayer = null;
    if (
      !this.blackoutPending &&
      this.pendingRoom.length === 0 &&
      this.pendingPlayer === null
    )
      return;
    let input: Input;
    if (this.blackoutPending) {
      const room = [
        "The patient has lost consciousness. Follow their existing restrictions. Do not invent new instructions.",
        ...this.pendingRoom,
      ];
      this.blackoutPending = false;
      this.pendingRoom = [];
      input = { text: room.join("\n"), player: false };
    } else if (this.pendingPlayer !== null) {
      input = { text: this.pendingPlayer, player: true };
      this.pendingPlayer = null;
    } else {
      input = { text: this.pendingRoom.join("\n"), player: false };
      this.pendingRoom = [];
    }
    const epoch = this.epoch;
    const live = this.live;
    const connectionToken = this.connectionToken;
    const abort = new AbortController();
    this.runAbort = abort;
    live.beginInput(input.player);
    const observation = {
      ...observeStatus(state),
      previousActionInterrupted: this.interrupted,
    };
    this.interrupted = false;
    this.update({ status: "thinking", error: null, needsInstruction: false });
    let capped = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retirementTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectTimeout!: (error: Error) => void;
    let rejectRetirement!: (error: Error) => void;
    const timeout = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const retirement = new Promise<never>((_resolve, reject) => {
      rejectRetirement = reject;
    });
    const resetTimeout = () => {
      clearTimeout(timer);
      if (epoch !== this.epoch || this.closed) return;
      timer = setTimeout(() => {
        if (epoch !== this.epoch || this.closed || abort.signal.aborted) return;
        timedOut = true;
        abort.abort();
        live.session.abort("Connection timeout");
        if (this.live === live) this.live = null;
        this.connectionToken = null;
        this.replaceSessionOnResume = true;
        void live.close().catch(() => undefined);
        rejectTimeout(
          new Error("The connection took too long. Your operation is paused."),
        );
      }, 45000);
    };
    resetTimeout();
    const unsubscribe = live.session.subscribe(resetTimeout);
    let retired = false;
    let task!: Promise<void>;
    const scheduleRetirement = () => {
      if (retirementTimer !== undefined) return;
      retirementTimer = setTimeout(() => {
        if (
          this.running !== task ||
          epoch !== this.epoch ||
          this.closed ||
          this.runAbort !== abort
        )
          return;
        retired = true;
        if (this.live === live) this.live = null;
        if (this.connectionToken === connectionToken)
          this.connectionToken = null;
        this.replaceSessionOnResume = true;
        void live.close().catch(() => undefined);
        rejectRetirement(
          new Error(
            "The previous request did not stop. Continue to reconnect.",
          ),
        );
      }, 3000);
    };
    this.scheduleRetirement = scheduleRetirement;
    task = (async () => {
      try {
        const result = await Promise.race([
          live.session.send(
            {
              text: `${input.player ? "PLAYER COMMAND" : "ROOM EVENT"}: ${input.text}\nCURRENT OBSERVATION: ${JSON.stringify(observation)}`,
            },
            { signal: abort.signal },
          ),
          timeout,
          retirement,
        ]);
        if (epoch !== this.epoch || this.closed) return;
        if (timedOut)
          throw new Error(
            "The connection took too long. Your operation is paused.",
          );
        if (abort.signal.aborted) return;
        if (result.error)
          throw new Error(
            `RUN could not answer (${result.error.code}). Check the RUN sign-in and retry.`,
          );
        capped = result.finishReason === "max_turns";
        this.update({ turns: this.snapshot.turns + result.turns });
        live.ensureResponse?.();
      } catch (error) {
        if (
          epoch === this.epoch &&
          !this.closed &&
          (!abort.signal.aborted || timedOut || retired)
        )
          this.fail(error, retired);
      } finally {
        clearTimeout(timer);
        clearTimeout(retirementTimer);
        unsubscribe();
      }
    })();
    this.running = task;
    void task.finally(() => {
      const ownsRun = this.running === task;
      if (ownsRun) this.running = null;
      if (this.runAbort === abort) this.runAbort = null;
      if (this.scheduleRetirement === scheduleRetirement)
        this.scheduleRetirement = null;
      if (!ownsRun || epoch !== this.epoch || this.closed) return;
      if (this.snapshot.status !== "error") {
        const state = this.store.getSnapshot();
        const needsInstruction =
          capped &&
          this.pendingPlayer === null &&
          this.pendingRoom.length === 0 &&
          !this.blackoutPending &&
          this.live === live &&
          connectionToken !== null &&
          this.connectionToken === connectionToken &&
          !abort.signal.aborted &&
          !state.paused &&
          state.phase === "playing";
        this.update({ status: "idle", needsInstruction });
        if (needsInstruction)
          this.store.note(
            "system",
            "He pauses to listen. Give the next instruction.",
          );
      } else
        this.update({
          canResume: this.live !== null || this.replaceSessionOnResume,
        });
      this.drain();
    });
  }

  observeEvents(): void {
    if (
      this.snapshot.mode !== "live" ||
      !this.live ||
      this.snapshot.status === "error"
    )
      return;
    const state = this.store.getSnapshot();
    if (
      state.paused ||
      (state.phase !== "playing" && state.phase !== "blackout")
    )
      return;
    let changed = false;
    if (state.patient.blackoutCount > this.blackoutCount) {
      this.blackoutCount = state.patient.blackoutCount;
      this.pendingPlayer = null;
      this.blackoutPending = true;
      changed = true;
    }
    const events = state.environment.events.slice(this.eventCursor);
    if (events.length > 0) {
      this.eventCursor = state.environment.events.length;
      this.pendingRoom.push(...events.map((event) => event.text));
      changed = true;
    }
    if (!changed) return;
    this.drain();
  }

  stop(): void {
    this.pendingPlayer = null;
    this.pendingRoom = [];
    this.blackoutPending = false;
    this.interrupted ||=
      this.running !== null || this.store.getSnapshot().pending !== null;
    this.connectionAbort?.abort();
    this.runAbort?.abort();
    this.live?.session.abort("Player stopped work");
    this.store.cancel();
    this.hooks.silence();
    if (!this.closed)
      this.update({ status: this.running ? "stopping" : "idle" });
    this.scheduleRetirement?.();
  }

  pause(): void {
    this.stop();
    this.store.pause(true);
  }
  resume(): void {
    if (
      this.closed ||
      (this.running !== null && this.runAbort?.signal.aborted) ||
      (this.snapshot.status === "error" && !this.snapshot.canResume)
    )
      return;
    if (this.replaceSessionOnResume) {
      void this.replaceTimedOutSession();
      return;
    }
    this.store.pause(false);
    this.update({ status: "idle", error: null, needsInstruction: true });
  }

  private async replaceTimedOutSession(): Promise<void> {
    if (this.closed || !this.replaceSessionOnResume || this.connectionAbort)
      return;
    const epoch = this.epoch;
    const abort = new AbortController();
    this.connectionAbort = abort;
    this.update({ status: "connecting", error: null, canResume: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          abort.abort();
          if (epoch === this.epoch && !this.closed) this.connectionToken = null;
          reject(
            new Error(
              "RUN did not reconnect. Sign in with the RUN toolbar, then try again.",
            ),
          );
        }, 12000);
      });
      const connection = this.createConnection(epoch, abort.signal);
      void connection
        .then((live) => {
          if (abort.signal.aborted || epoch !== this.epoch || this.closed)
            void live.close().catch(() => undefined);
        })
        .catch(() => undefined);
      const live = await Promise.race([connection, timeout]);
      if (abort.signal.aborted || epoch !== this.epoch || this.closed) return;
      this.live = live;
      this.replaceSessionOnResume = false;
      this.store.pause(false);
      this.update({
        status: "idle",
        error: null,
        canResume: false,
        needsInstruction: true,
      });
      this.drain();
    } catch (error) {
      if (epoch !== this.epoch || this.closed) return;
      if (abort.signal.aborted && !timedOut) {
        this.update({ status: "idle" });
        return;
      }
      this.connectionToken = null;
      this.fail(error, true);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (this.connectionAbort === abort) this.connectionAbort = null;
    }
  }

  changeRule(rule: RuleId, enabled: boolean): void {
    const state = this.store.getSnapshot();
    if (this.closed || state.paused || state.phase !== "playing") return;
    this.stop();
    void this.store.run({ kind: "set_rule", rule, enabled });
    this.store.note(
      "patient",
      `${enabled ? "Keep" : "Lift"} rule: ${RULES[rule].label}.`,
    );
  }

  async rehearse(actions: GameAction[]): Promise<void> {
    if (this.closed || this.snapshot.mode !== "rehearsal" || this.running)
      return;
    const epoch = this.epoch;
    const abort = new AbortController();
    this.runAbort = abort;
    this.update({ status: "acting", error: null, needsInstruction: false });
    const task = (async () => {
      for (const action of actions) {
        if (abort.signal.aborted) return;
        const result = await this.store.run(action, abort.signal);
        if (!result.ok) {
          this.store.note("system", result.message);
          this.update({ error: result.message });
          return;
        }
        if (action.kind === "vocalize") this.vocalize(action.cue);
        if (action.kind === "signal_intent") this.vocalize("effort");
      }
    })();
    this.running = task;
    try {
      await task;
    } catch (error) {
      if (!abort.signal.aborted) this.fail(error);
    } finally {
      if (this.running === task) this.running = null;
      if (this.runAbort === abort) this.runAbort = null;
      if (epoch === this.epoch && this.snapshot.status !== "error")
        this.update({ status: "idle" });
    }
  }

  private fail(error: unknown, preservePending = false): void {
    if (!preservePending) {
      this.pendingPlayer = null;
      this.pendingRoom = [];
      this.blackoutPending = false;
    }
    this.interrupted = true;
    this.store.cancel();
    this.store.pause(true);
    const message =
      error instanceof Error
        ? error.message
        : "The connection failed. Sign in to RUN and try again.";
    this.update({
      status: "error",
      error: message,
      canResume: this.live !== null || this.replaceSessionOnResume,
    });
  }

  async dispose(): Promise<void> {
    this.stop();
    this.closed = true;
    ++this.epoch;
    this.connectionToken = null;
    this.replaceSessionOnResume = false;
    this.listeners.clear();
    const live = this.live;
    this.live = null;
    if (live) await live.close().catch(() => undefined);
  }
}
