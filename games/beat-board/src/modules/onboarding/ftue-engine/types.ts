/**
 * FTUE (First Time User Experience) Type Definitions
 *
 * Config-driven types for the tutorial engine.
 * Ported from battle_deck — game-specific fields stripped.
 * No game-specific unions — all step/phase definitions come from config.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config types (loaded from JSON or code)
// ─────────────────────────────────────────────────────────────────────────────

/** Phase config */
export interface FtuePhaseConfig {
  readonly id: string
  readonly mode: 'linear' | 'contextual'
  /** When set, phase is considered complete once all non-stub steps are done */
  readonly completesWhen?: 'all_non_stub'
}

/** Trigger config for contextual steps */
export interface FtueTriggerConfig {
  readonly mode: 'on_round_entry' | 'ongoing' | 'on_unlock'
  readonly condition?: string
  /** Required when mode === 'on_unlock'. Matches a progressive-unlocks featureKey. */
  readonly featureKey?: string
  readonly roundMin?: number
  readonly roundMax?: number
  readonly priority?: number
}

/** Gate config — controls when UI elements become available */
export interface FtueGateConfig {
  readonly name: string
  readonly opensOn: 'reach' | 'complete'
}

export interface FtueCompletionParams extends Record<string, unknown> {
  /**
   * Required when `completion.type === 'event'`.
   */
  readonly eventName?: string
  /**
   * When true, the overlay backdrop drops to `pointer-events: none` for this
   * step so gestures can travel beyond the spotlight cutout.
   */
  readonly allowPointerThrough?: boolean
}

/** Step definition */
export interface FtueStepConfig {
  readonly id: string
  readonly phase: string
  readonly spotlight: string | null
  readonly tooltipAnchor?: string | null
  readonly title?: string
  readonly message: string
  readonly tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  readonly tooltipAlign?: 'left' | 'center' | 'right'
  /**
   * Completion contract for this step. The `type` string is the discriminant:
   *
   *  - `'manual'` — the UI dismiss handler calls `completeCurrentStep()`.
   *  - `'tap_target'` — auto-completes when the overlay spotlight is clicked.
   *  - `'event'` — the game fires a named event via
   *    `ftueStore.notifyEvent(eventName)` when the step's prerequisite
   *    action happens. The store matches `params.eventName` to decide
   *    whether to advance. Use this for discrete gameplay triggers
   *    ("solve accepted", "first share", "prompt generated") that don't
   *    map naturally to a pollable game-state predicate. Routes through
   *    `advanceStep()` which is terminal-safe — `notifyEvent` is a no-op
   *    once the flow is skipped or completed.
   *  - any other string — a condition name. The condition runner polls
   *    `adapter.subscribe` and evaluates `adapter.conditions[type](ctx,
   *    params, prev)`; `true` auto-advances.
   *
   * For `type: 'event'`, set `params.eventName` (string) to the event the
   * step is waiting on. For spotlight drag/gesture steps, set
   * `params.allowPointerThrough = true` so the backdrop does not intercept
   * pointer movement outside the cutout.
   */
  readonly completion: { type: string; params?: FtueCompletionParams }
  readonly trigger?: FtueTriggerConfig | FtueTriggerConfig[]
  readonly hint?: string
  readonly customHint?: string
  readonly dismissible?: boolean
  /** Whether this step is a stub (auto-completed, not shown to user) */
  readonly stub?: boolean
  /** Guard condition — step won't activate until this condition is true */
  readonly guard?: string
  readonly next?: string | null | { step: string; condition: string }
  readonly gates?: FtueGateConfig[]
  /** Character ID for character-mode tutorials (avatar + speech bubble) */
  readonly character?: string
  /**
   * When set, this step is a "feature tutorial" bound to a progressive-unlocks
   * featureKey. Enables `isFeatureTutorialComplete(featureKey)` queries,
   * per-feature seedState (`ftue.feature.<featureKey>.complete`), and per-feature
   * browser-verify routing. A step with `featureKey` should typically also have
   * an `on_unlock` trigger targeting the same key.
   */
  readonly featureKey?: string
}

/** Full FTUE config */
export interface FtueConfig {
  readonly storageKey?: string
  readonly phases: readonly FtuePhaseConfig[]
  readonly steps: readonly FtueStepConfig[]
  /**
   * The screen/tab the user MUST be on when `startFtue()` is called.
   * Required when any phase has `mode: 'linear'`. `startFtue(currentScreen)`
   * refuses to start if `currentScreen !== kitScreen`.
   */
  readonly kitScreen?: string
  /**
   * Show the "Skip Tutorial" button from step 0 (default: true).
   * Set to false only if you provide a custom skip mechanism.
   * The overlay MUST always render a skip affordance — users must never
   * be trapped in a tutorial they can't exit.
   */
  readonly alwaysShowSkip?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types (game implements these)
// ─────────────────────────────────────────────────────────────────────────────

/** Condition evaluator — receives current context, completion params, and previous context */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FtueConditionEvaluator<TCtx = any> = (
  ctx: TCtx,
  params: Record<string, unknown>,
  prev: TCtx | null,
) => boolean

/** Adapter interface — game implements this to bridge FTUE engine and game state */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FtueAdapter<TCtx = any> {
  conditions: Record<string, FtueConditionEvaluator<TCtx>>
  getContext: () => TCtx
  subscribe: (onChange: () => void) => () => void
  isNewPlayer: () => { isLoaded: boolean; isNewPlayer: boolean }
  hints: readonly string[]
  getRound: () => number
  resetState?: () => void
  /**
   * Optional: subscribe to progressive-unlocks `featureUnlocked` events.
   * Required if any config step declares an `on_unlock` trigger — `validateFtueConfig`
   * rejects configs that use `on_unlock` without an adapter that provides this.
   * Games typically delegate this to `progressive-unlocks.subscribeUnlock`.
   */
  subscribeUnlock?: (cb: (featureKey: string) => void) => () => void
  /** Optional: returns true if the given featureKey is currently unlocked. Used for resume-on-init. */
  isFeatureUnlocked?: (featureKey: string) => boolean
  /**
   * Optional: the full set of featureKeys declared in the game's progressive-unlocks gates.
   * When provided, `validateFtueConfig` rejects any `on_unlock` trigger whose featureKey
   * is not in this set. When absent, featureKeys are trusted at config time and failures
   * surface at runtime instead.
   */
  getKnownUnlockKeys?: () => readonly string[]
  /** Optional: emit an analytics event. Used by `ftue_feature_tutorial_skipped_target_missing`. */
  emitAnalytics?: (event: string, payload: Record<string, unknown>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store types
// ─────────────────────────────────────────────────────────────────────────────

/** FTUE store state */
export interface FtueState {
  /** Current tutorial phase (phase ID from config, or sentinel: 'completed' | 'skipped') */
  readonly currentPhase: string
  /** Current active step ID (null if no step active) */
  readonly currentStepId: string | null
  /** Set of completed step IDs */
  readonly completedSteps: ReadonlySet<string>
  /** Set of open gate names */
  readonly openGates: ReadonlySet<string>
  /** Whether FTUE is currently active (showing UI) */
  readonly isActive: boolean
  /** Whether current step's tooltip is hidden (step still active for auto-complete) */
  readonly isStepHidden: boolean
  /** Whether FTUE has been initialized */
  readonly isInitialized: boolean
}

/** FTUE store actions */
export interface FtueActions {
  initialize: (config: FtueConfig, adapter: FtueAdapter) => Promise<void>
  /**
   * Start the FTUE. `currentScreen` must match `config.kitScreen`
   * or the call is a no-op (prevents starting FTUE on the wrong screen).
   */
  startFtue: (currentScreen: string) => void
  advanceStep: () => void
  completeCurrentStep: () => void
  /**
   * Fire a named game event. If the current step's `completion.type` is
   * `'event'` and its `completion.params.eventName` matches `name`, the
   * store calls `advanceStep()`. Otherwise, the call is a no-op.
   *
   * Terminal-safe: once the flow is `'skipped'` or `'completed'`, every
   * `notifyEvent` is a no-op (routes through `advanceStep`, which bails on
   * `!isActive || !currentStepId`). This is the correct primitive for
   * discrete-event flows and replaces the anti-pattern of hand-rolling a
   * state machine with per-event `notifyX()` setters.
   */
  notifyEvent: (name: string) => void
  skipAll: () => void
  reset: () => void
  showStep: (stepId: string) => void
  hideCurrentStep: () => void
  pauseFtue: () => void
  resumeLinearPhase: () => void
  getGateOpen: (gateName: string) => boolean
  /**
   * Returns true if every step configured with the given featureKey is present in
   * completedSteps. Used for per-feature tutorial completion queries. Returns false
   * for unknown featureKeys or keys with no configured steps.
   */
  isFeatureTutorialComplete: (featureKey: string) => boolean
  /**
   * Marks a specific step completed without activating it. Used by the condition
   * runner to auto-skip on_unlock steps whose spotlight target is missing at
   * fire-time (emits `ftue_feature_tutorial_skipped_target_missing` analytics).
   * Reserved for runner-internal use.
   */
  markStepAutoSkipped: (stepId: string) => void
  /**
   * Marks every step configured with the given featureKey as complete. Exposed
   * for the `seedState('ftue.feature.<featureKey>.complete')` e2e bypass path.
   * Throws synchronously on an unknown featureKey — the unknown-key contract
   * is consistent with the seedState caller side.
   */
  markFeatureTutorialComplete: (featureKey: string) => void
}

/** Combined FTUE store type */
export type FtueStore = FtueState & FtueActions

/** Persisted state shape for storage */
export interface FtuePersistedState {
  readonly currentPhase: string
  readonly currentStepId: string | null
  readonly completedSteps: string[]
  readonly openGates: string[]
  readonly isActive: boolean
}

/** Pluggable persistence interface */
export interface FtuePersistence {
  load(key: string): FtuePersistedState | null | Promise<FtuePersistedState | null>
  save(key: string, state: FtuePersistedState): void
  remove?(key: string): void
}
