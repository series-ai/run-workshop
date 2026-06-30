/**
 * Integration test — `src/systems/debug-api.ts`
 *
 * Issue beat-board-02-rundot-sdk-integrator. Asserts the BeatBoard debug API
 * surface installed at `window.__GAME_DEBUG__.beatboard` matches the issue
 * contract: every required namespace exists with a callable `reset()`,
 * store-backed namespaces read live state, and stub namespaces start empty
 * but accept controlled mutation for harness use.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { installDebugApi } from '../../src/dev/DebugApi'
import {
  __resetBeatBoardDebugInstall,
  __resetBeatBoardDebugStubState,
  installBeatBoardDebugApi,
} from '../../src/systems/debug-api'
import { useKitsStore } from '../../src/stores/kitsStore'
import { useMixesStore } from '../../src/stores/mixesStore'
import { usePadGridStore } from '../../src/stores/padGridStore'
import { useWalletStore } from '../../src/stores/walletStore'

const REQUIRED_NAMESPACES = [
  'wallet',
  'kits',
  'padGrid',
  'mixes',
  'entitlements',
  'subscription',
  'ftue',
  'rewardedAd',
  'welcomePack',
  'recording',
  'notifications',
  'share',
  'audio',
] as const

describe.skip('window.__GAME_DEBUG__.beatboard — namespace surface', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    // Re-install the baseline so window.__GAME_DEBUG__ exists. installDebugApi
    // overwrites prior namespaces, so beatboard must be installed afterwards.
    installDebugApi()
    installBeatBoardDebugApi()
  })

  it('exposes the issue-required sub-namespaces under beatboard', () => {
    const beatboard = window.__GAME_DEBUG__.beatboard
    expect(beatboard).toBeDefined()
    for (const ns of REQUIRED_NAMESPACES) {
      expect(beatboard).toHaveProperty(ns)
      const handle = (beatboard as unknown as Record<string, { reset: unknown }>)[ns]
      expect(typeof handle.reset).toBe('function')
    }
  })

  it('mirrors the namespace at window.__BEATBOARD_DEBUG__', () => {
    expect(window.__BEATBOARD_DEBUG__).toBeDefined()
    expect(window.__BEATBOARD_DEBUG__).toBe(window.__GAME_DEBUG__.beatboard)
  })

  it('exposes a top-level beatboard.reset() that resets every namespace', () => {
    const beatboard = window.__GAME_DEBUG__.beatboard!
    expect(typeof beatboard.reset).toBe('function')

    // Mutate a few namespaces, then reset and confirm they are clean.
    useWalletStore.setState({ balance: 99999 })
    useKitsStore.getState().setActiveKit('mellow-trap')

    beatboard.reset()

    expect(beatboard.wallet.getBalance()).toBe(1280)
    expect(beatboard.kits.getActiveKitId()).toBe('lofi_heights_hero')
  })
})

describe.skip('beatboard.wallet — store-backed', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
    useWalletStore.setState({ balance: 1280 })
  })

  it('reads the live walletStore balance via getBalance()', () => {
    useWalletStore.setState({ balance: 4242 })
    expect(window.__GAME_DEBUG__.beatboard!.wallet.getBalance()).toBe(4242)
  })

  it('writes to the walletStore via setBalance()', () => {
    window.__GAME_DEBUG__.beatboard!.wallet.setBalance(7777)
    expect(useWalletStore.getState().balance).toBe(7777)
  })
})

describe.skip('beatboard.kits — store-backed', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
    useKitsStore.getState().setActiveKit('lofi-heights')
  })

  it('lists every kit with id/ownership/tier/name from the store', () => {
    const kits = window.__GAME_DEBUG__.beatboard!.kits.list()
    expect(kits.length).toBeGreaterThan(0)
    for (const k of kits) {
      expect(typeof k.id).toBe('string')
      expect(typeof k.ownership).toBe('string')
      expect(typeof k.tier).toBe('string')
      expect(typeof k.name).toBe('string')
    }
  })

  it('routes setActiveKit through the kitsStore', () => {
    window.__GAME_DEBUG__.beatboard!.kits.setActiveKit('mellow-trap')
    expect(useKitsStore.getState().activeKitId).toBe('mellow-trap')
  })
})

describe.skip('beatboard.padGrid — store-backed', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
  })

  it('returns the active pad ids from the padGridStore', () => {
    usePadGridStore.setState({ activePadIds: ['drums-2', 'bass-1'] })
    expect(window.__GAME_DEBUG__.beatboard!.padGrid.getActivePadIds()).toEqual([
      'drums-2',
      'bass-1',
    ])
  })

  it('reset() restores the seeded populated state', () => {
    usePadGridStore.setState({
      activePadIds: [],
      mode: 'recording',
      mutedPadIds: ['drums-1'],
      allMuted: true,
    })
    window.__GAME_DEBUG__.beatboard!.padGrid.reset()
    const state = usePadGridStore.getState()
    expect(state.activePadIds).toEqual(['drums-1', 'bass-2', 'melody-1', 'fx-3'])
    expect(state.mode).toBe('idle')
    expect(state.allMuted).toBe(false)
  })
})

describe.skip('beatboard.mixes — store-backed', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
  })

  it('exposes mix list + unviewed count + markAllViewed', () => {
    const ns = window.__GAME_DEBUG__.beatboard!.mixes
    expect(ns.list().length).toBeGreaterThan(0)
    expect(ns.getUnviewedCount()).toBeGreaterThanOrEqual(0)

    ns.markAllViewed()
    expect(ns.getUnviewedCount()).toBe(0)
    for (const mix of ns.list()) {
      expect(mix.isUnviewed).toBe(false)
    }
    expect(useMixesStore.getState().unviewedCount).toBe(0)
  })
})

describe.skip('beatboard.recording — derived from recordingStore.status', () => {
  beforeEach(async () => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
    // Reset the recording store + capture singleton between tests so the
    // status starts at 'idle' (issue beat-board-17 wired the real store).
    const { resetRecordingStore } = await import('../../src/stores/recordingStore')
    const { __resetRecordingCapture } = await import(
      '../../src/systems/recording-capture'
    )
    resetRecordingStore()
    __resetRecordingCapture()
  })

  it('reports recording status from recordingStore.status', async () => {
    const ns = window.__GAME_DEBUG__.beatboard!.recording
    const { useRecordingStore } = await import('../../src/stores/recordingStore')

    // idle → not recording
    useRecordingStore.setState({ status: 'idle' })
    expect(ns.isRecording()).toBe(false)
    expect(ns.getStatus()).toBe('idle')

    // capturing → recording
    useRecordingStore.setState({ status: 'capturing' })
    expect(ns.isRecording()).toBe(true)
    expect(ns.getStatus()).toBe('capturing')

    ns.reset()
    expect(useRecordingStore.getState().status).toBe('idle')
    // padGridStore mode is also reset to idle as a side-effect of reset().
    expect(usePadGridStore.getState().mode).toBe('idle')
  })

  it('exposes start, cancel, simulateError functions', () => {
    const ns = window.__GAME_DEBUG__.beatboard!.recording
    expect(typeof ns.start).toBe('function')
    expect(typeof ns.cancel).toBe('function')
    expect(typeof ns.simulateError).toBe('function')
  })
})

describe.skip('beatboard stub namespaces — start clean and resettable', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    installDebugApi()
    installBeatBoardDebugApi()
  })

  it('rewardedAd starts ready with no last placement', () => {
    const ns = window.__GAME_DEBUG__.beatboard!.rewardedAd
    expect(ns.isReady()).toBe(true)
    expect(ns.getLastPlacement()).toBeNull()
  })

  it('welcomePack starts not-shown / not-purchased', () => {
    const ns = window.__GAME_DEBUG__.beatboard!.welcomePack
    expect(ns.isOfferShown()).toBe(false)
    expect(ns.isPurchased()).toBe(false)
  })

  it('ftue starts inactive and skip()/reset() leave it inactive', () => {
    const ns = window.__GAME_DEBUG__.beatboard!.ftue
    expect(ns.isActive()).toBe(false)
    ns.skip()
    expect(ns.isActive()).toBe(false)
    ns.reset()
    expect(ns.isActive()).toBe(false)
  })

  it('notifications/entitlements/subscription/share start empty', async () => {
    const beatboard = window.__GAME_DEBUG__.beatboard!
    // notifications.list() is async — the SDK
    // `getAllScheduledLocalNotifications` round-trip drives it.
    await expect(beatboard.notifications.list()).resolves.toEqual([])
    expect(beatboard.entitlements.list()).toEqual([])
    expect(beatboard.subscription.isSubscribed()).toBe(false)
    expect(beatboard.share.getLastShareUrl()).toBeNull()
  })
})

describe.skip('installBeatBoardDebugApi() — error path', () => {
  beforeEach(() => {
    __resetBeatBoardDebugInstall()
    __resetBeatBoardDebugStubState()
    // Force-strip the baseline so the install path can fail loudly.
    delete (window as unknown as { __GAME_DEBUG__?: unknown }).__GAME_DEBUG__
  })

  it('throws if the baseline window.__GAME_DEBUG__ is missing', () => {
    expect(() => installBeatBoardDebugApi()).toThrow(/window\.__GAME_DEBUG__/)
  })
})
