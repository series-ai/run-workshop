import { RULES, type GameAction, type RuleId } from "../game/model";
import { GameStore } from "../game/store";
import { observeStatus } from "../game/transitions";
import type { LiveSession } from "./liveSession";

export type PlayMode = "live" | "rehearsal";
export interface ConnectionState {
  mode: PlayMode;
  status: "idle" | "connecting" | "thinking" | "acting" | "stopping" | "error";
  error: string | null;
  speech: string;
  turns: number;
  canResume: boolean;
  needsInstruction: boolean;
}
interface Input {
  text: string;
  player: boolean;
}
export interface ControllerHooks {
  speak(text: string): void;
  silence(): void;
}
export type SessionFactory = (
  store: GameStore,
  hooks: {
    onSpeech(text: string): void;
    onPause(): void;
    onAction(): void;
  },
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
    speech: "",
    turns: 0,
    canResume: false,
    needsInstruction: false,
  };
  private listeners = new Set<() => void>();
  private live: LiveSession | null = null;
  private connectionAbort: AbortController | null = null;
  private runAbort: AbortController | null = null;
  private running: Promise<void> | null = null;
  private pending: Input | null = null;
  private epoch = 0;
  private interrupted = false;
  private closed = false;
  private eventCount = 0;
  private blackoutCount = 0;
  private connectionToken: object | null = null;
  private replaceSessionOnResume = false;

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
        onSpeech: (text) => {
          if (
            token === this.connectionToken &&
            epoch === this.epoch &&
            !this.closed &&
            this.running !== null &&
            this.runAbort !== null &&
            !this.runAbort.signal.aborted &&
            !this.store.getSnapshot().paused
          )
            this.say(text);
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
    const old = this.live;
    this.live = null;
    this.store.reset();
    this.eventCount = 0;
    this.blackoutCount = 0;
    this.connectionToken = null;
    this.replaceSessionOnResume = false;
    this.update({
      mode,
      status: mode === "live" ? "connecting" : "idle",
      error: null,
      speech: "",
      turns: 0,
      canResume: false,
      needsInstruction: false,
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
      this.update({ status: "idle", speech: "" });
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

  private say(text: string): void {
    this.update({ speech: text });
    this.hooks.speak(text);
  }

  command(raw: string): void {
    const text = raw.trim().slice(0, 1000);
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
      if (this.pending?.player)
        this.pending = {
          ...this.pending,
          text: `${this.pending.text} ${text}`.slice(0, 1000),
        };
      else if (!this.pending) this.pending = { text, player: true };
      return;
    }
    this.pending = { text, player: true };
    if (this.running) {
      this.interrupted = true;
      this.runAbort?.abort();
      this.live.session.abort("Player correction");
      this.store.cancel();
      this.hooks.silence();
      this.update({ status: "stopping" });
    } else this.drain();
  }

  private drain(): void {
    if (!this.pending || this.running || !this.live || this.closed) return;
    const state = this.store.getSnapshot();
    if (
      state.paused ||
      (state.phase !== "playing" && state.phase !== "blackout")
    ) {
      this.pending = null;
      return;
    }
    if (this.pending.player && state.phase === "blackout") {
      this.pending = null;
      return;
    }
    const input = this.pending;
    this.pending = null;
    const epoch = this.epoch;
    const live = this.live;
    const abort = new AbortController();
    this.runAbort = abort;
    live.beginInput(input.player);
    const observation = {
      ...observeStatus(state),
      previousActionInterrupted: this.interrupted,
    };
    this.interrupted = false;
    this.update({ status: "thinking", error: null, needsInstruction: false });
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectTimeout!: (error: Error) => void;
    const timeout = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
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
    const task = (async () => {
      try {
        const result = await Promise.race([
          live.session.send(
            {
              text: `${input.player ? "PLAYER COMMAND" : "ROOM EVENT"}: ${input.text}\nCURRENT OBSERVATION: ${JSON.stringify(observation)}`,
            },
            { signal: abort.signal },
          ),
          timeout,
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
        this.update({
          turns: this.snapshot.turns + result.turns,
          needsInstruction: result.finishReason === "max_turns",
        });
        if (result.finishReason === "max_turns")
          this.store.note(
            "system",
            "He pauses to listen. Give the next instruction.",
          );
      } catch (error) {
        if (
          epoch === this.epoch &&
          !this.closed &&
          (!abort.signal.aborted || timedOut)
        )
          this.fail(error);
      } finally {
        clearTimeout(timer);
        unsubscribe();
      }
    })();
    this.running = task;
    void task.finally(() => {
      if (this.running === task) this.running = null;
      if (this.runAbort === abort) this.runAbort = null;
      if (epoch !== this.epoch || this.closed) return;
      if (this.snapshot.status !== "error") this.update({ status: "idle" });
      else
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
    let text = "";
    if (state.patient.blackoutCount > this.blackoutCount) {
      this.blackoutCount = state.patient.blackoutCount;
      if (this.pending?.player) this.pending = null;
      text =
        "The patient has lost consciousness. Follow their existing restrictions. Do not invent new instructions.";
    }
    if (state.environment.eventCount > this.eventCount) {
      this.eventCount = state.environment.eventCount;
      text += ` ${state.environment.lastEvent}`;
    }
    if (!text.trim()) return;
    if (!this.pending?.player) this.pending = { text, player: false };
    this.drain();
  }

  stop(): void {
    this.pending = null;
    this.interrupted ||=
      this.running !== null || this.store.getSnapshot().pending !== null;
    this.connectionAbort?.abort();
    this.runAbort?.abort();
    this.live?.session.abort("Player stopped work");
    this.store.cancel();
    this.hooks.silence();
    if (!this.closed)
      this.update({ status: this.running ? "stopping" : "idle" });
  }

  pause(): void {
    this.stop();
    this.store.pause(true);
  }
  resume(): void {
    if (
      this.closed ||
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
    } catch (error) {
      if (epoch !== this.epoch || this.closed) return;
      if (abort.signal.aborted && !timedOut) {
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
        if (action.kind === "vocalize") this.say(action.cue);
        if (action.kind === "signal_intent") this.say("effort");
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

  private fail(error: unknown): void {
    this.pending = null;
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
