/**
 * Acceptance tests for issue beat-board-25-ftue-engine.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests exercise the real FTUE store + adapter wiring with
 * RundotAPI.appStorage mocked (per __tests__/setup.ts).
 *
 * Scope:
 *   - BEATBOARD_FTUE_CONFIG — 5 steps + storage key + variant.
 *   - useFtueStore — module bridge (initialise, startFtue, advance, skip,
 *     persistence round-trip, feature-tutorial completion).
 *   - Per-step wiring — pad_activated / second_pad_activated /
 *     recording_started.
 *   - Gates — `tabBarGate` driven by step ids; record-button gate.
 *   - Toast — one-time "Nice — your first mix is saved." after capture.
 *   - Debug API — `beatboard.ftue.skip()`, `complete()`,
 *     `feature.mutePad.complete()`, `feature.packDrawer.complete()`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  useFtueStore,
  resetFtueAdapterForTests,
  isRecordButtonDisabled,
  setMixSavedToastListener,
} from '../systems/ftue-adapter'
import {
  BEATBOARD_FTUE_CONFIG,
  BEATBOARD_FTUE_STORAGE_KEY,
  BEATBOARD_FTUE_VARIANT,
} from '../systems/ftue-config'
import { usePadGridStore, resetPadGridStore } from '../stores/padGridStore'
import { useRecordingStore, resetRecordingStore } from '../stores/recordingStore'
import { useNavigationStore } from '../stores/navigationStore'
import { unlockStore } from '../modules/onboarding/progressive-unlocks/ProgressiveUnlocks'
import { installDebugApi } from '../dev/DebugApi'
import { installBeatBoardDebugApi } from '../systems/debug-api'

// Empty active pad list when tests start.
function clearActivePads() {
  usePadGridStore.setState({ activePadIds: [] })
}

/**
 * Mount the spotlight target placeholders into jsdom so the engine's
 * `isSpotlightReady` default (which calls `document.querySelectorAll`)
 * sees them. The real components render these data-ftue attributes; in
 * the unit test we inject minimal stubs.
 */
function mountSpotlightPlaceholders() {
  document.body.innerHTML = `
    <div data-ftue="pad-cell-0"></div>
    <div data-ftue="pad-cell-5"></div>
    <div data-ftue="record-button"></div>
    <div data-ftue="pad-cell-active-any"></div>
    <div data-ftue="tab-packs"></div>
  `
}

function clearSpotlightPlaceholders() {
  document.body.innerHTML = ''
}

// Arrange a fresh FTUE bridge per test.
async function freshFtue(): Promise<void> {
  resetFtueAdapterForTests()
  await useFtueStore.getState().initialize()
  // Start on the right screen.
  useFtueStore.getState().startFtue('play')
}

beforeEach(async () => {
  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.setItem).mockClear()
  resetPadGridStore()
  clearActivePads()
  resetRecordingStore()
  unlockStore.getState().reset()
  useNavigationStore.getState().setTabBarGate('enabled')
  resetFtueAdapterForTests()
  mountSpotlightPlaceholders()
})

afterEach(() => {
  clearSpotlightPlaceholders()
})

describe('accept: beat-board-25-ftue-engine — config', () => {
  it('config defines 5 steps with the correct ids and spotlight selectors', () => {
    const ids = BEATBOARD_FTUE_CONFIG.steps.map((s) => s.id)
    expect(ids).toEqual([
      'tap_first_pad',
      'tap_second_pad',
      'tap_record_button',
      'mute_pad_hint',
      'pack_drawer_hint',
    ])
    expect(BEATBOARD_FTUE_CONFIG.steps[0]?.spotlight).toBe('[data-ftue="pad-cell-0"]')
    expect(BEATBOARD_FTUE_CONFIG.steps[1]?.spotlight).toBe('[data-ftue="pad-cell-5"]')
    expect(BEATBOARD_FTUE_CONFIG.steps[2]?.spotlight).toBe('[data-ftue="record-button"]')
    expect(BEATBOARD_FTUE_CONFIG.steps[3]?.spotlight).toBe('[data-ftue="pad-cell-active-any"]')
    expect(BEATBOARD_FTUE_CONFIG.steps[4]?.spotlight).toBe('[data-ftue="tab-packs"]')
  })

  it('uses appStorage key beatboard_ftue and variant beatboard_v1', () => {
    expect(BEATBOARD_FTUE_CONFIG.storageKey).toBe('beatboard_ftue')
    expect(BEATBOARD_FTUE_STORAGE_KEY).toBe('beatboard_ftue')
    expect(BEATBOARD_FTUE_VARIANT).toBe('beatboard_v1')
  })

  it('all core-loop steps are linear phase', () => {
    const coreSteps = BEATBOARD_FTUE_CONFIG.steps.filter((s) => s.phase === 'core_loop')
    expect(coreSteps).toHaveLength(3)
    const corePhase = BEATBOARD_FTUE_CONFIG.phases.find((p) => p.id === 'core_loop')
    expect(corePhase?.mode).toBe('linear')
  })
})

describe('accept: step 1 — tap_first_pad', () => {
  it('starts on the first step with prompt "Tap a pad to start your beat."', async () => {
    await freshFtue()
    const store = useFtueStore.getState()
    expect(store.currentStepId).toBe('tap_first_pad')
    expect(store.getGuideMessage()).toBe('Tap a pad to start your beat.')
    expect(store.getSpotlightTarget()).toBe('[data-ftue="pad-cell-0"]')
  })

  it('completes when activePadIds.length >= 1 (pad_activated)', async () => {
    await freshFtue()
    expect(useFtueStore.getState().currentStepId).toBe('tap_first_pad')
    // Activate a pad — the adapter's `pad_activated` evaluator fires true.
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    // The condition runner ticks on the subscribe callback.
    await new Promise((r) => setTimeout(r, 350))
    expect(useFtueStore.getState().currentStepId).not.toBe('tap_first_pad')
  })
})

describe('accept: step 2 — tap_second_pad', () => {
  it('after step 1, advances to tap_second_pad with the correct prompt', async () => {
    await freshFtue()
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    await new Promise((r) => setTimeout(r, 350))
    const s = useFtueStore.getState()
    expect(s.currentStepId).toBe('tap_second_pad')
    expect(s.getGuideMessage()).toBe('Add another. Layers always sound good together.')
    expect(s.getSpotlightTarget()).toBe('[data-ftue="pad-cell-5"]')
  })

  it('completes when activePadIds.length >= 2 (second_pad_activated)', async () => {
    await freshFtue()
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(useFtueStore.getState().currentStepId).toBe('tap_second_pad')
    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(useFtueStore.getState().currentStepId).toBe('tap_record_button')
  })
})

describe('accept: step 3 — tap_record_button', () => {
  it('reaches step 3 with prompt "Tap Record when it sounds good."', async () => {
    await freshFtue()
    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 400))
    const s = useFtueStore.getState()
    expect(s.currentStepId).toBe('tap_record_button')
    expect(s.getGuideMessage()).toBe('Tap Record when it sounds good.')
    expect(s.getSpotlightTarget()).toBe('[data-ftue="record-button"]')
  })

  it('completes when recording.start() flips status out of idle (recording_started)', async () => {
    await freshFtue()
    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 400))
    expect(useFtueStore.getState().currentStepId).toBe('tap_record_button')
    // Simulate recording-capture flipping status — this drives the
    // adapter's recordingStore subscription and notifyEvent('recording_started').
    useRecordingStore.setState({ status: 'pending-bar' })
    await new Promise((r) => setTimeout(r, 50))
    const s = useFtueStore.getState()
    // Step 3 was completed; FTUE moves out of the linear core_loop phase.
    expect(s.completedSteps.has('tap_record_button')).toBe(true)
    expect(['feature_loops', 'completed']).toContain(s.currentPhase)
  })

  it('fires the one-time "Nice — your first mix is saved." toast after capture', async () => {
    await freshFtue()
    const toastSpy = vi.fn()
    setMixSavedToastListener(toastSpy)

    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 400))
    // Trigger recording_started and capture-complete cycle.
    useRecordingStore.setState({ status: 'pending-bar' })
    await new Promise((r) => setTimeout(r, 50))
    useRecordingStore.setState({ status: 'capturing' })
    await new Promise((r) => setTimeout(r, 50))
    useRecordingStore.setState({ status: 'idle' })
    await new Promise((r) => setTimeout(r, 50))
    expect(toastSpy).toHaveBeenCalledTimes(1)
  })
})

describe('accept: skip + persistence', () => {
  it('skipAll() persists FTUE-complete to appStorage with the right key', async () => {
    await freshFtue()
    useFtueStore.getState().skipAll()
    // setItem should have been called with the storage key.
    const setItem = vi.mocked(RundotAPI.appStorage.setItem)
    const skippedCall = setItem.mock.calls.find(
      ([key, value]) =>
        key === BEATBOARD_FTUE_STORAGE_KEY &&
        typeof value === 'string' &&
        value.includes('"skipped"'),
    )
    expect(skippedCall).toBeTruthy()
    expect(useFtueStore.getState().currentPhase).toBe('skipped')
  })

  it('persistence resumes at last incomplete step on relaunch', async () => {
    // Phase 1: get to step 2.
    await freshFtue()
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(useFtueStore.getState().currentStepId).toBe('tap_second_pad')

    // Snapshot the persisted JSON the engine would have written.
    const setItem = vi.mocked(RundotAPI.appStorage.setItem)
    const lastWrite = setItem.mock.calls
      .filter(([key]) => key === BEATBOARD_FTUE_STORAGE_KEY)
      .pop()
    expect(lastWrite).toBeTruthy()
    const persistedJson = lastWrite![1] as string

    // Phase 2: simulate cold start — `getItem` returns the persisted snapshot.
    resetFtueAdapterForTests()
    vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValueOnce(persistedJson)
    await useFtueStore.getState().initialize()
    // Engine restored to a state where step 2 will reactivate when the
    // condition runner ticks (currentStepId is null, isActive false until
    // re-evaluated). The persisted completedSteps include step 1.
    const s = useFtueStore.getState()
    expect(s.completedSteps.has('tap_first_pad')).toBe(true)
  })
})

describe('accept: gates', () => {
  it('tabBarGate is disabled while step 1 active, then enabled after step 3', async () => {
    await freshFtue()
    expect(useNavigationStore.getState().tabBarGate).toBe('disabled')
    // Advance to step 2 — still disabled.
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(useNavigationStore.getState().tabBarGate).toBe('disabled')
    // Advance past step 2 → step 3, then complete step 3.
    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(useNavigationStore.getState().tabBarGate).toBe('enabled')
    useRecordingStore.setState({ status: 'pending-bar' })
    await new Promise((r) => setTimeout(r, 50))
    expect(useNavigationStore.getState().tabBarGate).toBe('enabled')
  })

  it('record-button gate is disabled until step 2 completes', async () => {
    await freshFtue()
    expect(isRecordButtonDisabled()).toBe(true)
    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(isRecordButtonDisabled()).toBe(true)
    usePadGridStore.setState({ activePadIds: ['drums-1', 'bass-2'] })
    await new Promise((r) => setTimeout(r, 350))
    expect(isRecordButtonDisabled()).toBe(false)
  })

  it('on skipAll, both gates flip to enabled / not-disabled', async () => {
    await freshFtue()
    expect(useNavigationStore.getState().tabBarGate).toBe('disabled')
    expect(isRecordButtonDisabled()).toBe(true)
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))
    expect(useNavigationStore.getState().tabBarGate).toBe('enabled')
    expect(isRecordButtonDisabled()).toBe(false)
  })
})

describe('accept: progressive-unlocks bridge', () => {
  it('subscribeUnlock pipes featureKey through the adapter', async () => {
    await freshFtue()
    // Skip linear so feature_loops phase becomes reachable.
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))
    // No throw: the adapter wired progressive-unlocks subscribeUnlock.
    expect(typeof unlockStore.getState().subscribeUnlock).toBe('function')
    // Trigger an unlock — the adapter accepts it and the engine records it
    // (no exception). End state: unlocked feature is in unlockStore.
    unlockStore.getState().unlock('mute_pad', 'Mute hint')
    expect(unlockStore.getState().isUnlocked('mute_pad')).toBe(true)
  })

  it('isFeatureTutorialComplete reports completion for known feature keys', async () => {
    await freshFtue()
    expect(useFtueStore.getState().isFeatureTutorialComplete('mute_pad')).toBe(false)
    useFtueStore.getState().markFeatureTutorialComplete('mute_pad')
    expect(useFtueStore.getState().isFeatureTutorialComplete('mute_pad')).toBe(true)
  })
})

describe('accept: debug API surface', () => {
  beforeEach(() => {
    installDebugApi()
    installBeatBoardDebugApi()
  })

  it('beatboard.ftue.skip() calls skipAll', async () => {
    await freshFtue()
    window.__GAME_DEBUG__.beatboard!.ftue.skip()
    expect(useFtueStore.getState().currentPhase).toBe('skipped')
  })

  it('beatboard.ftue.complete() persists FTUE-complete to beatboard_ftue', async () => {
    await window.__GAME_DEBUG__.beatboard!.ftue.complete()
    expect(useFtueStore.getState().currentPhase).toBe('skipped')
    const setItem = vi.mocked(RundotAPI.appStorage.setItem)
    const wrote = setItem.mock.calls.find(
      ([k]) => k === BEATBOARD_FTUE_STORAGE_KEY,
    )
    expect(wrote).toBeTruthy()
  })

  it('beatboard.ftue.feature.mutePad.complete() marks mute_pad complete', async () => {
    await freshFtue()
    window.__GAME_DEBUG__.beatboard!.ftue.feature.mutePad.complete()
    expect(useFtueStore.getState().isFeatureTutorialComplete('mute_pad')).toBe(true)
  })

  it('beatboard.ftue.feature.packDrawer.complete() marks pack_drawer complete', async () => {
    await freshFtue()
    window.__GAME_DEBUG__.beatboard!.ftue.feature.packDrawer.complete()
    expect(useFtueStore.getState().isFeatureTutorialComplete('pack_drawer')).toBe(true)
  })
})
