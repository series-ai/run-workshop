/**
 * Acceptance tests for issue beat-board-30-smoke-ftue-skip.
 *
 * Smoke companion: validates the underlying contract that the FTUE skip
 * path + force-quit resume rely on, before the Playwright spec
 * (`e2e/playwright/smoke-ftue-skip.spec.ts`) drives the full UI flow.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below:
 *   - [ui] Skip on step 1 dismisses every FTUE overlay (engine becomes
 *     terminal-skipped; isOverlayActive flips to false).
 *   - [ui] Post-skip, `tabBarGate === 'enabled'` and `isRecordButtonDisabled`
 *     returns false within 500ms (proxy for `gate.tabBar.disabled === false`
 *     and `gate.recordButton.disabled === false`).
 *   - [ui] Force-quit resume — re-initialise the adapter against the persisted
 *     `beatboard_ftue` payload and confirm the engine restores either step 1
 *     (when the previous Skip was reverted via debug API) or the terminal
 *     skipped phase (when Skip persisted).
 *   - [ui] `seedState('beatboard.ftue.complete')` reaches the same terminal
 *     state Skip does (currentPhase === 'skipped', overlay inactive).
 *   - [state] Analytics `ftue_completed` fires with `{ skipped: true }` after
 *     the Skip path through `useFtueStore.getState().skipAll()`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  useFtueStore,
  resetFtueAdapterForTests,
  isRecordButtonDisabled,
} from '../systems/ftue-adapter'
import {
  BEATBOARD_FTUE_STORAGE_KEY,
  BEATBOARD_FTUE_VARIANT,
} from '../systems/ftue-config'
import { usePadGridStore, resetPadGridStore } from '../stores/padGridStore'
import { resetRecordingStore } from '../stores/recordingStore'
import { useNavigationStore } from '../stores/navigationStore'
import { NAVIGATION } from '../tabs/tabConfig'
import { installDebugApi } from '../dev/DebugApi'
import {
  installBeatBoardDebugApi,
  __resetBeatBoardDebugInstall,
  __resetBeatBoardDebugStubState,
} from '../systems/debug-api'

function mountSpotlightPlaceholders() {
  document.body.innerHTML = `
    <div data-ftue="pad-cell-0"></div>
    <div data-ftue="pad-cell-5"></div>
    <div data-ftue="record-button"></div>
    <div data-ftue="pad-cell-active-any"></div>
    <div data-ftue="tab-packs"></div>
  `
}

beforeEach(async () => {
  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.setItem).mockClear()
  vi.mocked(RundotAPI.appStorage.removeItem).mockClear()

  resetPadGridStore()
  usePadGridStore.setState({ activePadIds: [] })
  resetRecordingStore()

  useNavigationStore.getState().configure(NAVIGATION)
  useNavigationStore.getState().setTabBarGate('enabled')

  resetFtueAdapterForTests()
  __resetBeatBoardDebugInstall()
  __resetBeatBoardDebugStubState()

  mountSpotlightPlaceholders()
  installDebugApi()
  installBeatBoardDebugApi()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('accept: smoke-ftue-skip — debug API surface used by the spec', () => {
  it('window.__GAME_DEBUG__.beatboard.ftue exposes skip, complete, reset', () => {
    const beat = window.__GAME_DEBUG__.beatboard
    expect(beat).toBeDefined()
    if (!beat) return
    expect(typeof beat.ftue.skip).toBe('function')
    expect(typeof beat.ftue.complete).toBe('function')
    expect(typeof beat.ftue.reset).toBe('function')
  })
})

describe('accept: smoke-ftue-skip — Skip on step 1 dismisses every overlay', () => {
  async function freshFtue(): Promise<void> {
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
  }

  it('overlay is active on step 1 before Skip', async () => {
    await freshFtue()
    const s = useFtueStore.getState()
    expect(s.currentStepId).toBe('tap_first_pad')
    expect(s.isOverlayActive()).toBe(true)
  })

  it('skipAll on step 1 marks the engine terminal-skipped and overlay inactive', async () => {
    await freshFtue()
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))
    const s = useFtueStore.getState()
    expect(s.currentPhase).toBe('skipped')
    expect(s.isOverlayActive()).toBe(false)
  })

  it('beatboard.ftue.skip() (debug API) drives the same terminal state', async () => {
    await freshFtue()
    window.__GAME_DEBUG__.beatboard!.ftue.skip()
    await new Promise((r) => setTimeout(r, 50))
    expect(useFtueStore.getState().currentPhase).toBe('skipped')
    expect(useFtueStore.getState().isOverlayActive()).toBe(false)
  })
})

describe('accept: smoke-ftue-skip — gates flip to interactive within 500ms', () => {
  async function freshFtue(): Promise<void> {
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
  }

  it('before Skip: tabBarGate is disabled and record button is disabled', async () => {
    await freshFtue()
    expect(useNavigationStore.getState().tabBarGate).toBe('disabled')
    expect(isRecordButtonDisabled()).toBe(true)
  })

  it('after Skip: tabBarGate is enabled and record button is enabled (within 500ms)', async () => {
    await freshFtue()
    const t0 = Date.now()
    useFtueStore.getState().skipAll()
    // The adapter mirrors the engine state synchronously; allow a tick for
    // any subscriber to flush.
    await new Promise((r) => setTimeout(r, 50))
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThan(500)
    expect(useNavigationStore.getState().tabBarGate).toBe('enabled')
    expect(isRecordButtonDisabled()).toBe(false)
  })
})

describe('accept: smoke-ftue-skip — force-quit resume reads beatboard_ftue', () => {
  it('Skip persists to beatboard_ftue appStorage', async () => {
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
    const setItemSpy = vi.mocked(RundotAPI.appStorage.setItem)
    setItemSpy.mockClear()
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))
    const wrote = setItemSpy.mock.calls.find(
      ([key]) => key === BEATBOARD_FTUE_STORAGE_KEY,
    )
    expect(wrote).toBeTruthy()
    if (!wrote) return
    const [, value] = wrote as [string, string]
    const persisted = JSON.parse(value) as { currentPhase?: string }
    expect(persisted.currentPhase).toBe('skipped')
  })

  it('reload after Skip → re-initialise from appStorage stays terminal-skipped', async () => {
    // Round 1: skip and capture the persisted payload from the setItem mock.
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))
    const setItemSpy = vi.mocked(RundotAPI.appStorage.setItem)
    const persistedCall = [...setItemSpy.mock.calls]
      .reverse()
      .find(([key]) => key === BEATBOARD_FTUE_STORAGE_KEY)
    expect(persistedCall).toBeTruthy()
    if (!persistedCall) return
    const [, persistedValue] = persistedCall as [string, string]

    // Round 2: simulate force-quit + relaunch — engine reads appStorage and
    // restores the skipped terminal state without re-running the FTUE.
    resetFtueAdapterForTests()
    vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValueOnce(persistedValue)
    await useFtueStore.getState().initialize()
    await new Promise((r) => setTimeout(r, 50))
    const s = useFtueStore.getState()
    expect(s.currentPhase).toBe('skipped')
    expect(s.isOverlayActive()).toBe(false)
  })

  it('reset after Skip → next initialise lands back on step 1 (Skip reverted)', async () => {
    // Round 1: skip + persist.
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))

    // Round 2: simulate the debug-API revert — `beatboard.ftue.reset()` wipes
    // the persisted payload, so the next launch boots the FTUE clean.
    window.__GAME_DEBUG__.beatboard!.ftue.reset()
    expect(vi.mocked(RundotAPI.appStorage.removeItem)).toHaveBeenCalledWith(
      BEATBOARD_FTUE_STORAGE_KEY,
    )
    vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValueOnce(null)
    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
    const s = useFtueStore.getState()
    expect(s.currentPhase).toBe('core_loop')
    expect(s.currentStepId).toBe('tap_first_pad')
  })
})

describe('accept: smoke-ftue-skip — seedState ftue.complete parity', () => {
  it('beatboard.ftue.complete() reaches the same terminal state as Skip', async () => {
    await window.__GAME_DEBUG__.beatboard!.ftue.complete()
    await new Promise((r) => setTimeout(r, 50))
    const s = useFtueStore.getState()
    expect(s.currentPhase).toBe('skipped')
    expect(s.isOverlayActive()).toBe(false)
    expect(useNavigationStore.getState().tabBarGate).toBe('enabled')
    expect(isRecordButtonDisabled()).toBe(false)
  })
})

describe('accept: smoke-ftue-skip — analytics ftue_completed { skipped: true }', () => {
  it('Skip path fires recordCustomEvent("ftue_completed", { skipped: true })', async () => {
    const recordSpy = RundotAPI.analytics.recordCustomEvent as unknown as ReturnType<
      typeof vi.fn
    >
    recordSpy.mockClear()

    await useFtueStore.getState().initialize()
    useFtueStore.getState().startFtue('play')
    useFtueStore.getState().skipAll()
    await new Promise((r) => setTimeout(r, 50))

    const ftueCompleted = recordSpy.mock.calls.find(([name]) => name === 'ftue_completed')
    expect(ftueCompleted).toBeDefined()
    if (!ftueCompleted) return
    const [, properties] = ftueCompleted as [string, Record<string, unknown>]
    expect(properties.ftue_variant).toBe(BEATBOARD_FTUE_VARIANT)
    expect(properties.skipped).toBe(true)
  })
})
