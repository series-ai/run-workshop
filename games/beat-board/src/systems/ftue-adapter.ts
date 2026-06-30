/**
 * ftue-adapter — bridges the `onboarding/ftue-engine` module to BeatBoard
 * game state, and exposes a Zustand-shaped FTUE store the UI can consume.
 *
 * Issue beat-board-25-ftue-engine owns this file. Source-of-truth is
 * `src/systems/ftue-config.ts` + prd.md § FTUE Specification.
 *
 * Responsibilities:
 *   1. Provide an `FtueAdapter` with condition evaluators for every
 *      `step.completion.type` referenced in `ftue-config.ts`.
 *   2. Subscribe to the watched stores (padGridStore, recordingStore,
 *      navigationStore) so the engine's condition runner re-evaluates on
 *      every relevant state change.
 *   3. Bridge `progressive-unlocks.subscribeUnlock` into the adapter so
 *      `on_unlock` triggers fire for `mute_pad` + `pack_drawer`.
 *   4. Persist FTUE state via `RundotAPI.appStorage` under
 *      `beatboard_ftue` (force-quit recovery).
 *   5. Set the project-side gates (`navigationStore.tabBarGate`,
 *      `recordButtonDisabled`) as the engine advances steps.
 *   6. Emit `ftue_started` / `ftue_completed` analytics + the one-time
 *      "Nice — your first mix is saved." toast when capture finishes after
 *      step 3.
 *
 * Pure TypeScript — no React, no R3F.
 */

import { create } from 'zustand'

import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  createFtueStoreInstance,
  type FtueStoreInstance,
} from '../modules/onboarding/ftue-engine/FtueStoreFactory'
import {
  createConditionRunner,
  getStepById,
} from '../modules/onboarding/ftue-engine/FtueEngine'
import type {
  FtueAdapter,
  FtueConditionEvaluator,
  FtuePersistence,
  FtuePersistedState,
  FtueStepConfig,
} from '../modules/onboarding/ftue-engine/types'
import { unlockStore } from '../modules/onboarding/progressive-unlocks/ProgressiveUnlocks'

import { usePadGridStore } from '../stores/padGridStore'
import { useRecordingStore } from '../stores/recordingStore'
import { useNavigationStore } from '../stores/navigationStore'

import {
  recordCustomEvent,
  recordFtueCompleted,
  recordFtueStarted,
} from './analytics'

import {
  BEATBOARD_FTUE_CONFIG,
  BEATBOARD_FTUE_FEATURE_KEYS,
  BEATBOARD_FTUE_KIT_SCREEN,
  BEATBOARD_FTUE_VARIANT,
} from './ftue-config'

// ── Persistence — RundotAPI.appStorage adapter ───────────────────────────

export const beatboardFtuePersistence: FtuePersistence = {
  async load(key: string): Promise<FtuePersistedState | null> {
    try {
      const raw = await RundotAPI.appStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as FtuePersistedState
    } catch (err) {
      RundotAPI.error('[ftue-adapter] persistence load failed', { err: String(err) })
      return null
    }
  },
  save(key: string, state: FtuePersistedState): void {
    void RundotAPI.appStorage
      .setItem(key, JSON.stringify(state))
      .catch((err: unknown) =>
        RundotAPI.error('[ftue-adapter] persistence save failed', { err: String(err) }),
      )
  },
  remove(key: string): void {
    void RundotAPI.appStorage
      .removeItem(key)
      .catch((err: unknown) =>
        RundotAPI.error('[ftue-adapter] persistence remove failed', { err: String(err) }),
      )
  },
}

// ── Context snapshot ─────────────────────────────────────────────────────

export interface BeatBoardFtueContext {
  /** Pads currently active in `padGridStore`. */
  readonly activePadCount: number
  /** Recording status (`'idle' | 'pending-bar' | 'capturing' | …`). */
  readonly recordingStatus: string
}

function buildContext(): BeatBoardFtueContext {
  const padGrid = usePadGridStore.getState()
  const recording = useRecordingStore.getState()
  return {
    activePadCount: padGrid.activePadIds.length,
    recordingStatus: recording.status,
  }
}

// ── Condition evaluators ─────────────────────────────────────────────────
//
// Every key here matches a `completion.type` in `BEATBOARD_FTUE_CONFIG`.
// The engine's `validateFtueConfig` cross-checks this set at init.

const conditions: Record<string, FtueConditionEvaluator<BeatBoardFtueContext>> = {
  pad_activated: (ctx) => ctx.activePadCount >= 1,
  second_pad_activated: (ctx) => ctx.activePadCount >= 2,
}

// ── Subscribe bridge ─────────────────────────────────────────────────────
//
// Aggregates Zustand subscriptions for every store that contributes to the
// context. The engine fans out re-evaluations through this single entry.

function subscribeEverything(onChange: () => void): () => void {
  const unsubs: Array<() => void> = [
    usePadGridStore.subscribe(onChange),
    useRecordingStore.subscribe(onChange),
    useNavigationStore.subscribe(onChange),
  ]
  return () => {
    for (const u of unsubs) {
      try {
        u()
      } catch {
        // Best-effort teardown.
      }
    }
  }
}

// ── Adapter factory ──────────────────────────────────────────────────────

export function createBeatBoardFtueAdapter(): FtueAdapter<BeatBoardFtueContext> {
  return {
    conditions,
    getContext: buildContext,
    subscribe: subscribeEverything,
    isNewPlayer: () => ({ isLoaded: true, isNewPlayer: true }),
    hints: [] as readonly string[],
    getRound: () => 1,
    subscribeUnlock: (cb) => unlockStore.getState().subscribeUnlock(cb),
    isFeatureUnlocked: (featureKey) => unlockStore.getState().isUnlocked(featureKey),
    emitAnalytics: (event, payload) => {
      recordCustomEvent(event, payload as Record<string, never>)
    },
  }
}

// ── Module-store instance + lifecycle hooks ──────────────────────────────

let ftueStartedAt = 0
let firstMixToastFired = false

const moduleInstance: FtueStoreInstance = createFtueStoreInstance({
  persistence: beatboardFtuePersistence,
  onStarted: () => {
    ftueStartedAt = Date.now()
    recordFtueStarted({ ftue_variant: BEATBOARD_FTUE_VARIANT })
  },
  onCompleted: () => {
    const duration = Math.max(0, (Date.now() - ftueStartedAt) / 1000)
    recordFtueCompleted({
      ftue_variant: BEATBOARD_FTUE_VARIANT,
      duration_seconds: duration,
      skipped: false,
    })
  },
  onSkipped: () => {
    const duration = Math.max(0, (Date.now() - ftueStartedAt) / 1000)
    recordFtueCompleted({
      ftue_variant: BEATBOARD_FTUE_VARIANT,
      duration_seconds: duration,
      skipped: true,
    })
  },
})

const moduleFtueStore = moduleInstance.store

// One adapter per session.
const ftueAdapter: FtueAdapter<BeatBoardFtueContext> = createBeatBoardFtueAdapter()

// Mirror engine state into the BeatBoard side: TabBar gate + record-button
// gate. Subscribed once at module load.
moduleFtueStore.subscribe((s) => {
  const stepId = s.currentStepId
  const completed = s.completedSteps
  const phase = s.currentPhase
  const ftueDone = phase === 'completed' || phase === 'skipped'

  // tabBarGate.disabled while step 1 or step 2 is active. After step 3
  // completion, gate flips back to enabled.
  const tabBarDisabled =
    !ftueDone && (stepId === 'tap_first_pad' || stepId === 'tap_second_pad')

  const navStore = useNavigationStore.getState()
  const desiredTabGate = tabBarDisabled ? 'disabled' : 'enabled'
  if (navStore.tabBarGate !== desiredTabGate) {
    navStore.setTabBarGate(desiredTabGate)
  }

  // Record-button gate: disabled until step 2 is completed (so the player
  // has at least 2 pads active). After full skip / completion, flip false.
  const recordDisabled = !ftueDone && !completed.has('tap_second_pad')
  if (recordButtonDisabled !== recordDisabled) {
    recordButtonDisabled = recordDisabled
    notifyRecordGateListeners(recordDisabled)
  }

  // One-time "Nice — your first mix is saved." toast — fires exactly once
  // per session when the recording finishes AFTER step 3 was completed.
  // The actual fire happens through a recording-store subscription below
  // because the engine flips currentStepId before capture finishes.
})

// Watch recordingStore for two transitions:
//   1. status moves out of 'idle' → fire `recording_started` notifyEvent
//      (advances FTUE step 3 if it's the active step).
//   2. capture-complete → one-time "Nice — your first mix is saved." toast
//      after step 3 was reached or completed.
let mixSavedToastListener: (() => void) | null = null
let recordingPrevStatus = 'idle'
useRecordingStore.subscribe((s) => {
  const next = s.status
  const prev = recordingPrevStatus
  recordingPrevStatus = next

  // 1) recording_started — transition out of idle.
  if (prev === 'idle' && next !== 'idle' && next !== 'error') {
    moduleFtueStore.getState().notifyEvent('recording_started')
  }

  // 2) one-time toast when capture finishes.
  if (firstMixToastFired) return
  const ms = moduleFtueStore.getState()
  const hadStep3 =
    ms.completedSteps.has('tap_record_button') ||
    ms.currentStepId === 'tap_record_button'
  if (!hadStep3) return
  if (
    (prev === 'capturing' || prev === 'completing') &&
    (next === 'idle' || next === 'completing')
  ) {
    firstMixToastFired = true
    mixSavedToastListener?.()
  }
})

/** Wire the toast listener (UI binds via App or PadGridScreen). */
export function setMixSavedToastListener(listener: (() => void) | null): void {
  mixSavedToastListener = listener
}

// ── Record-button gate listeners ─────────────────────────────────────────
//
// PadGridScreen reads this gate and passes it to TransportBar. Because the
// gate lives in this module (not in navigationStore), we expose a tiny
// pub/sub so the screen can subscribe with `useSyncExternalStore`-style.

let recordButtonDisabled = true
const recordGateListeners = new Set<(disabled: boolean) => void>()

function notifyRecordGateListeners(disabled: boolean): void {
  for (const cb of recordGateListeners) {
    try {
      cb(disabled)
    } catch (err) {
      RundotAPI.error('[ftue-adapter] record-gate listener failed', { err: String(err) })
    }
  }
}

export function isRecordButtonDisabled(): boolean {
  // Compute live from the engine state on every call, not from the
  // cached `recordButtonDisabled` flag. The cached flag only updates on
  // store *transitions*; if persistence loads with FTUE already
  // completed/skipped (returning player), the load may not produce a
  // visible transition from a fresh module-init state, leaving the
  // cached flag at its initial `true`. Reading live keeps the gate
  // honest no matter how the engine got into its current state.
  const s = moduleFtueStore.getState()
  const ftueDone = s.currentPhase === 'completed' || s.currentPhase === 'skipped'
  if (ftueDone) return false
  if (s.completedSteps.has('tap_second_pad')) return false
  return true
}

export function subscribeRecordGate(cb: (disabled: boolean) => void): () => void {
  recordGateListeners.add(cb)
  return () => {
    recordGateListeners.delete(cb)
  }
}

// ── Project-side store bridge ────────────────────────────────────────────
//
// The overlay needs both module state and convenience getters
// (`getCurrentStepConfig`, `getSpotlightTarget`, `getGuideMessage`,
// `isOverlayActive`, `dismissContextual`). We re-export here so the
// FtueOverlayShell binds to a single store hook.

export interface BeatBoardFtueState {
  // Module state mirror
  readonly currentPhase: string
  readonly currentStepId: string | null
  readonly completedSteps: ReadonlySet<string>
  readonly openGates: ReadonlySet<string>
  readonly isActive: boolean
  readonly isStepHidden: boolean
  readonly isInitialized: boolean

  // Module actions
  initialize: () => Promise<void>
  startFtue: (currentScreen?: string) => void
  advanceStep: () => void
  completeCurrentStep: () => void
  notifyEvent: (name: string) => void
  skipAll: () => void
  reset: () => void
  showStep: (stepId: string) => void
  hideCurrentStep: () => void
  pauseFtue: () => void
  resumeLinearPhase: () => void
  getGateOpen: (gateName: string) => boolean
  isFeatureTutorialComplete: (featureKey: string) => boolean
  markFeatureTutorialComplete: (featureKey: string) => void

  // Convenience getters used by `FtueOverlayShell`
  getCurrentStepConfig: () => FtueStepConfig | null
  getSpotlightTarget: () => string | null
  getGuideMessage: () => string
  isOverlayActive: () => boolean
  dismissContextual: () => void
}

function snapshotModule(): Pick<
  BeatBoardFtueState,
  | 'currentPhase'
  | 'currentStepId'
  | 'completedSteps'
  | 'openGates'
  | 'isActive'
  | 'isStepHidden'
  | 'isInitialized'
> {
  const s = moduleFtueStore.getState()
  return {
    currentPhase: s.currentPhase,
    currentStepId: s.currentStepId,
    completedSteps: s.completedSteps,
    openGates: s.openGates,
    isActive: s.isActive,
    isStepHidden: s.isStepHidden,
    isInitialized: s.isInitialized,
  }
}

let conditionRunner: ReturnType<typeof createConditionRunner> | null = null

export const useFtueStore = create<BeatBoardFtueState>((set, get) => {
  // Mirror module → bridge on every change.
  moduleFtueStore.subscribe(() => {
    set(snapshotModule())
  })

  return {
    ...snapshotModule(),

    async initialize() {
      if (get().isInitialized) return
      await moduleFtueStore.getState().initialize(BEATBOARD_FTUE_CONFIG, ftueAdapter)

      if (!conditionRunner) {
        conditionRunner = createConditionRunner(
          BEATBOARD_FTUE_CONFIG,
          ftueAdapter,
          {
            getState: () => moduleFtueStore.getState(),
            advanceStep: () => moduleFtueStore.getState().advanceStep(),
            showStep: (id: string) => moduleFtueStore.getState().showStep(id),
            hideCurrentStep: () => moduleFtueStore.getState().hideCurrentStep(),
          },
        )
        conditionRunner.start()
      }

      set(snapshotModule())
    },

    startFtue(currentScreen?: string) {
      moduleFtueStore.getState().startFtue(currentScreen ?? BEATBOARD_FTUE_KIT_SCREEN)
      set(snapshotModule())
    },

    advanceStep() {
      moduleFtueStore.getState().advanceStep()
      set(snapshotModule())
    },

    completeCurrentStep() {
      moduleFtueStore.getState().completeCurrentStep()
      set(snapshotModule())
    },

    notifyEvent(name: string) {
      moduleFtueStore.getState().notifyEvent(name)
      set(snapshotModule())
    },

    skipAll() {
      moduleFtueStore.getState().skipAll()
      set(snapshotModule())
    },

    reset() {
      moduleFtueStore.getState().reset()
      set(snapshotModule())
    },

    showStep(stepId: string) {
      moduleFtueStore.getState().showStep(stepId)
      set(snapshotModule())
    },

    hideCurrentStep() {
      moduleFtueStore.getState().hideCurrentStep()
      set(snapshotModule())
    },

    pauseFtue() {
      moduleFtueStore.getState().pauseFtue()
      set(snapshotModule())
    },

    resumeLinearPhase() {
      moduleFtueStore.getState().resumeLinearPhase()
      set(snapshotModule())
    },

    getGateOpen(gateName: string): boolean {
      return moduleFtueStore.getState().getGateOpen(gateName)
    },

    isFeatureTutorialComplete(featureKey: string): boolean {
      return moduleFtueStore.getState().isFeatureTutorialComplete(featureKey)
    },

    markFeatureTutorialComplete(featureKey: string): void {
      moduleFtueStore.getState().markFeatureTutorialComplete(featureKey)
      set(snapshotModule())
    },

    getCurrentStepConfig(): FtueStepConfig | null {
      const id = moduleFtueStore.getState().currentStepId
      if (!id) return null
      return getStepById(BEATBOARD_FTUE_CONFIG, id) ?? null
    },

    getSpotlightTarget(): string | null {
      const step = get().getCurrentStepConfig()
      return step?.spotlight ?? null
    },

    getGuideMessage(): string {
      const step = get().getCurrentStepConfig()
      return step?.message ?? ''
    },

    isOverlayActive(): boolean {
      const s = moduleFtueStore.getState()
      if (!s.isInitialized || !s.isActive || s.isStepHidden) return false
      if (s.currentPhase === 'completed' || s.currentPhase === 'skipped') return false
      return true
    },

    dismissContextual(): void {
      // Manual / dismissible step → completeCurrentStep().
      moduleFtueStore.getState().completeCurrentStep()
      set(snapshotModule())
    },
  }
})

// ── Module exports for tests + debug ─────────────────────────────────────

export { moduleFtueStore }

/** Test-only: rebuild the runner / clear timers between unit tests. */
export function resetFtueAdapterForTests(): void {
  moduleFtueStore.getState().reset()
  conditionRunner?.stop()
  conditionRunner = null
  ftueStartedAt = 0
  firstMixToastFired = false
  recordingPrevStatus = 'idle'
  recordButtonDisabled = true
  recordGateListeners.clear()
  mixSavedToastListener = null
}

/**
 * Live-app reset for debug `ftue.reset()` callers (smoke specs that need
 * to re-anchor to step 1 mid-run). Identical to
 * `resetFtueAdapterForTests` EXCEPT it preserves
 * `recordGateListeners` and `mixSavedToastListener` — the live React
 * tree subscribed those at mount and won't re-subscribe just because
 * persistence got wiped. Without this preservation the record button
 * stays disabled forever in the live app after a debug reset, because
 * the engine flips `recordButtonDisabled=false` but no one's listening.
 */
export function resetFtueAdapterPreservingListeners(): void {
  moduleFtueStore.getState().reset()
  conditionRunner?.stop()
  conditionRunner = null
  ftueStartedAt = 0
  firstMixToastFired = false
  recordingPrevStatus = 'idle'
  recordButtonDisabled = true
  // recordGateListeners + mixSavedToastListener intentionally NOT cleared.
}

/** Debug API entry — known feature keys for typed assertions. */
export const BEATBOARD_FTUE_KNOWN_FEATURES: ReadonlyArray<string> =
  BEATBOARD_FTUE_FEATURE_KEYS
