import {
  actionLabel,
  ActionProblem,
  appendJournal,
  createInitialState,
  Emotion,
  GameAction,
  GameState,
  JournalEntry,
  PhysicalAction,
} from "./model";
import {
  applyAction,
  reconcileDeclaredContact,
  tickPatient,
  validateAction,
} from "./transitions";
import { EMOTION_PROFILES } from "./emotions";
import { actionPerformance, APPROACH_SECONDS } from "./performance";
import { updateTempo } from "./tempo";

export function getActionDuration(
  action: PhysicalAction,
  emotion: Emotion,
): number {
  const performance = actionPerformance(action);
  const speed = Math.max(1, EMOTION_PROFILES[emotion].speedMultiplier);
  return Math.ceil((APPROACH_SECONDS + performance.seconds * speed) * 1000);
}

function isPhysicalAction(action: GameAction): action is PhysicalAction {
  return (
    action.kind === "light_lantern" ||
    action.kind === "lift_debris" ||
    action.kind === "roll_patient" ||
    action.kind === "move_to" ||
    action.kind === "pick_up" ||
    action.kind === "place" ||
    action.kind === "use" ||
    action.kind === "combine" ||
    action.kind === "break" ||
    action.kind === "adjust_lamp"
  );
}

export class GameStore {
  private state: GameState;
  private listeners: Set<() => void> = new Set();
  private generation: number = 0;
  /**
   * Changes only when the running game is replaced (reset or start). A turn
   * that began under an earlier epoch must not settle into the new game.
   */
  private tempoEpoch: number = 0;
  private turnCounter: number = 0;
  private lastSettledTurnId: number = -1;
  private currentTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolver:
    ((res: { ok: boolean; message: string }) => void) | null = null;
  private currentAbortCleanup: (() => void) | null = null;
  private actionDuration: number = 0;
  private actionIdCounter: number = 0;
  private disposed: boolean = false;

  constructor(initialState?: GameState) {
    this.state = initialState ? { ...initialState } : createInitialState();
  }

  getSnapshot = (): GameState => {
    return this.state;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private recordProblem(problem: ActionProblem): void {
    if (
      this.state.paused ||
      (this.state.phase !== "playing" && this.state.phase !== "blackout")
    ) {
      return;
    }
    this.state = { ...this.state, problem };
    this.notify();
  }

  start(): void {
    if (this.disposed) return;
    if (this.state.phase === "ready") {
      this.state = { ...this.state, phase: "playing" };
      this.notify();
    }
  }

  reset(): void {
    if (this.disposed) return;
    this.cancel("Operation reset");
    this.state = createInitialState();
    this.tempoEpoch += 1;
    this.lastSettledTurnId = -1;
    this.notify();
  }

  pause(paused: boolean): void {
    if (this.disposed) return;
    if (this.state.paused === paused) return;
    if (this.state.phase === "won" || this.state.phase === "lost") return;

    if (paused) {
      this.cancel("Action cancelled due to pause");
    }

    this.state = { ...this.state, paused };
    this.notify();
  }

  tick(dt: number): void {
    if (this.disposed) return;
    if (
      this.state.paused ||
      this.state.phase === "ready" ||
      this.state.phase === "won" ||
      this.state.phase === "lost"
    ) {
      return;
    }

    let next = reconcileDeclaredContact(tickPatient(this.state, dt));

    // If game became terminal during tick, cancel pending actions and ensure pending is cleared
    if (next.phase === "won" || next.phase === "lost") {
      if (this.state.pending !== null) {
        this.cancel("Operation ended");
      }
      next = { ...next, pending: null };
    }

    // Update pending action progress visually
    if (next.pending !== null && this.actionDuration > 0) {
      const addedProgress = (dt * 1000) / this.actionDuration;
      const progress = Math.min(1, next.pending.progress + addedProgress);
      next = {
        ...next,
        pending: { ...next.pending, progress },
      };
    }

    this.state = next;
    this.notify();
  }

  note(kind: JournalEntry["kind"], text: string): void {
    if (this.disposed) return;
    this.state = appendJournal(this.state, kind, text);
    this.notify();
  }

  cancel(reason: string = "Action cancelled"): void {
    this.generation++;
    if (this.currentTimer !== null) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    if (this.currentAbortCleanup) {
      this.currentAbortCleanup();
      this.currentAbortCleanup = null;
    }

    const resolver = this.pendingResolver;
    this.pendingResolver = null;
    this.actionDuration = 0;

    let shouldNotify = false;
    if (this.state.pending !== null) {
      this.state = { ...this.state, pending: null };
      shouldNotify = true;
    }
    if (this.state.declaredContact !== null) {
      this.state = { ...this.state, declaredContact: null };
      shouldNotify = true;
    }
    if (this.state.problem !== null) {
      this.state = { ...this.state, problem: null };
      shouldNotify = true;
    }

    if (shouldNotify) {
      this.notify();
    }

    if (resolver) {
      resolver({ ok: false, message: reason });
    }
  }

  run(
    action: GameAction,
    signal?: AbortSignal,
    options?: { instant?: boolean },
  ): Promise<{ ok: boolean; message: string }> {
    if (this.disposed) {
      return Promise.resolve({
        ok: false,
        message: "Store has been disposed.",
      });
    }

    if (signal?.aborted) {
      return Promise.resolve({
        ok: false,
        message: signal.reason ? String(signal.reason) : "Action aborted",
      });
    }

    // Initial validation against current state (checks paused, ready, ended, rules, hand, etc.)
    const initialError = validateAction(this.state, action);
    if (initialError) {
      this.recordProblem(initialError);
      return Promise.resolve({ ok: false, message: initialError.reason });
    }

    // Abstract / Non-physical actions execute immediately
    if (!isPhysicalAction(action)) {
      const result = applyAction(this.state, action);
      if (result.ok) {
        this.state = result.state;
        this.notify();
        return Promise.resolve({ ok: true, message: result.message });
      }
      return Promise.resolve({
        ok: false,
        message: result.reason,
      });
    }

    // Only one physical action at a time
    if (this.state.pending !== null) {
      const pendingProblem: ActionProblem = {
        reason: "Another physical action is already in progress.",
        thought: "He is already doing something. I must wait for it to finish.",
      };
      this.recordProblem(pendingProblem);
      return Promise.resolve({
        ok: false,
        message: pendingProblem.reason,
      });
    }

    // Prepare pending action
    const currentGen = ++this.generation;
    this.actionDuration = options?.instant
      ? 0
      : getActionDuration(action, this.state.emotion);
    this.actionIdCounter++;

    this.state = {
      ...this.state,
      problem: null,
      pending: {
        id: this.actionIdCounter,
        action,
        label: actionLabel(action),
        progress: 0,
      },
    };
    this.notify();

    return new Promise((resolve) => {
      let settled = false;
      const safeResolve = (res: { ok: boolean; message: string }) => {
        if (!settled) {
          settled = true;
          if (this.currentAbortCleanup) {
            this.currentAbortCleanup();
            this.currentAbortCleanup = null;
          }
          this.pendingResolver = null;
          resolve(res);
        }
      };

      this.pendingResolver = safeResolve;

      if (signal) {
        const onAbort = () => {
          if (this.generation === currentGen) {
            this.cancel(
              signal.reason ? String(signal.reason) : "Action aborted",
            );
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
        this.currentAbortCleanup = () => {
          signal.removeEventListener("abort", onAbort);
        };
      }

      this.currentTimer = setTimeout(() => {
        this.currentTimer = null;

        // Generation check
        if (this.generation !== currentGen) {
          return;
        }

        // Context / terminal / paused checks
        if (signal?.aborted) {
          this.cancel(signal.reason ? String(signal.reason) : "Action aborted");
          return;
        }

        if (this.state.paused) {
          this.cancel("Action cancelled due to pause");
          return;
        }

        if (this.state.phase === "won" || this.state.phase === "lost") {
          this.cancel("Operation ended");
          return;
        }

        // Re-validate state at commit time
        const commitError = validateAction(this.state, action);
        if (commitError) {
          this.state = {
            ...this.state,
            pending: null,
            problem: commitError,
          };
          this.notify();
          safeResolve({ ok: false, message: commitError.reason });
          return;
        }

        // Commit action
        const result = applyAction(this.state, action);
        if (result.ok) {
          this.state = { ...result.state, pending: null };
          this.notify();
          safeResolve({ ok: true, message: result.message });
        } else {
          this.state = {
            ...this.state,
            pending: null,
            problem: result,
          };
          this.notify();
          safeResolve({
            ok: false,
            message: result.reason,
          });
        }
      }, this.actionDuration);
    });
  }

  /**
   * Settles the pacing tracker for a completed turn. This is the only writer:
   * individual actions never move the tracker, so subscribers only ever see
   * the settled value for a turn.
   *
   * `turnId` makes settlement idempotent and ordered: only a strictly newer
   * turn than the last settled one moves the tracker, so a retry or a
   * duplicate is ignored. `epoch` rejects a turn that began before the
   * running game was replaced. See beginTurn for the one-turn-in-flight rule.
   */
  settleTurn(input: {
    turnId: number;
    stateBefore: GameState;
    actionSucceeded: boolean;
    gateFailed: boolean;
    epoch: number;
  }): void {
    if (this.disposed) return;
    if (input.epoch !== this.tempoEpoch) return;
    // Monotonic: a duplicate or late retry of an already-settled turn is
    // ignored rather than counted twice.
    if (input.turnId <= this.lastSettledTurnId) return;
    this.lastSettledTurnId = input.turnId;

    const after = this.state;
    this.state = {
      ...after,
      // Advance from the store's current tracker rather than the caller's
      // snapshot, so the move follows the settled order. The monotonic turn
      // guard above keeps this to one move per turn.
      tempo: updateTempo(after.tempo, {
        actionSucceeded: input.actionSucceeded,
        gateFailed: input.gateFailed,
        stateBefore: {
          stage: input.stateBefore.stage,
          emotion: input.stateBefore.emotion,
          disposition: { ...input.stateBefore.disposition },
          holding: input.stateBefore.holding,
        },
        stateAfter: {
          stage: after.stage,
          emotion: after.emotion,
          disposition: { ...after.disposition },
          holding: after.holding,
        },
      }),
    };
    this.notify();
  }

  /**
   * Opens a turn and returns its identity. The caller passes the id and epoch
   * back to settleTurn so the tracker moves exactly once per turn.
   *
   * Contract: one turn is in flight at a time. The agent runtime already
   * rejects concurrent turns; settlement is monotonic and a newer turn that
   * settles first closes the window for earlier ones. Settlement of two
   * turns that are open at once is not supported.
   */
  beginTurn(): { turnId: number; epoch: number } {
    this.turnCounter += 1;
    return { turnId: this.turnCounter, epoch: this.tempoEpoch };
  }

  /** Epoch of the running game; a turn captures it and passes it to settleTurn. */
  getTempoEpoch(): number {
    return this.tempoEpoch;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel("Store disposed");
    this.listeners.clear();
  }
}
