/**
 * Terminal-safety contract test for BeatBoard's FTUE store.
 *
 * The lint rule `ftue-reimplementation-terminal-safety` requires every
 * FTUE-shaped store outside the canonical `ftue-engine` module to prove
 * that its `notify*` / `advance*` / `start*` / `show*` / `complete*` methods
 * are no-ops once the flow has been skipped or completed. Without this,
 * a post-FTUE button could re-activate the onboarding overlay on top of
 * normal gameplay (the "re-triggering FTUE on replay" bug class).
 *
 * The bridge store `useFtueStore` defined in `ftue-adapter.ts` delegates to
 * `moduleFtueStore` (an `FtueStoreFactory` instance). The factory's
 * `advanceStep` / `notifyEvent` / `showStep` / `completeCurrentStep` /
 * `startFtue` are guarded with `if (state.currentPhase === 'completed' ||
 * state.currentPhase === 'skipped') return` (see `FtueStoreFactory.ts`).
 * We pin that contract here so any future edit to either the wrapper or
 * the underlying factory that drops the guard fails this test loudly.
 */

import { describe, it } from 'vitest'
import { assertFtueStoreIsTerminalSafe } from '../modules/onboarding/ftue-engine/testing/assertTerminalSafe'
import {
  moduleFtueStore,
  resetFtueAdapterForTests,
  useFtueStore,
} from './ftue-adapter'
import { BEATBOARD_FTUE_CONFIG } from './ftue-config'

const FIRST_STEP_ID = BEATBOARD_FTUE_CONFIG.steps[0]?.id ?? ''
const FIRST_PHASE_ID = BEATBOARD_FTUE_CONFIG.phases[0]?.id ?? ''

/**
 * Force the underlying module store into a fresh non-terminal "linear"
 * state. We deliberately avoid `initialize()` because we don't want the
 * persistence layer or condition runner running in this test.
 */
function resetToInitial(): void {
  resetFtueAdapterForTests()
  moduleFtueStore.setState({
    currentPhase: FIRST_PHASE_ID,
    currentStepId: FIRST_STEP_ID,
    isActive: true,
    isStepHidden: false,
    isInitialized: true,
    completedSteps: new Set<string>(),
    openGates: new Set<string>(),
    completedFeatureTutorials: new Set<string>(),
  })
}

function forceSkipped(): void {
  moduleFtueStore.setState({
    currentPhase: 'skipped',
    currentStepId: null,
    isActive: false,
    isStepHidden: false,
    isInitialized: true,
    completedSteps: new Set<string>(),
    openGates: new Set<string>(),
    completedFeatureTutorials: new Set<string>(),
  })
}

function forceCompleted(): void {
  moduleFtueStore.setState({
    currentPhase: 'completed',
    currentStepId: null,
    isActive: false,
    isStepHidden: false,
    isInitialized: true,
    completedSteps: new Set<string>(),
    openGates: new Set<string>(),
    completedFeatureTutorials: new Set<string>(),
  })
}

describe('ftue-adapter terminal safety', () => {
  it('useFtueStore (BeatBoard FTUE bridge) is a no-op in skipped/completed phases', () => {
    assertFtueStoreIsTerminalSafe({
      storeLabel: 'BeatBoard useFtueStore',
      getState: () => useFtueStore.getState() as unknown as Record<string, unknown>,
      guardedMethods: [
        'advanceStep',
        'notifyEvent',
        'showStep',
        'completeCurrentStep',
        'startFtue',
      ],
      argsForMethod: (name) => {
        if (name === 'notifyEvent') return ['recording_started']
        if (name === 'showStep') return [FIRST_STEP_ID]
        return []
      },
      forceSkipped,
      forceCompleted,
      resetToInitial,
    })
  })
})
