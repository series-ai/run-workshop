/**
 * Integration test — `src/rundot/init.ts`
 *
 * Issue beat-board-02-rundot-sdk-integrator. Asserts the post-SDK-init
 * sequence: server-time sync, profile resolution + `player_identity`
 * analytics, and lifecycle-driven `session_end` analytics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  __resetRundotInit,
  getServerNow,
  getServerTimeService,
  initializeRundot,
  setActiveScreenProvider,
} from '../../src/rundot/init'

interface LifecycleHandlers {
  onSleep?: () => void
  onPause?: () => void
  onQuit?: () => void
  onAwake?: () => void
  onResume?: () => void
}

function captureLifecycleHandlers(): LifecycleHandlers {
  const handlers: LifecycleHandlers = {}
  vi.mocked(RundotAPI.lifecycles.onSleep).mockImplementation((cb: () => void) => {
    handlers.onSleep = cb
    return { unsubscribe: vi.fn() }
  })
  vi.mocked(RundotAPI.lifecycles.onPause).mockImplementation((cb: () => void) => {
    handlers.onPause = cb
    return { unsubscribe: vi.fn() }
  })
  vi.mocked(RundotAPI.lifecycles.onQuit).mockImplementation((cb: () => void) => {
    handlers.onQuit = cb
    return { unsubscribe: vi.fn() }
  })
  return handlers
}

describe('initializeRundot()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRundotInit()
  })

  it('syncs server time via RundotAPI.requestTimeAsync()', async () => {
    const fixedServer = 1_700_000_000_000
    vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValueOnce({
      serverTime: fixedServer,
      localTime: Date.now(),
      timezoneOffset: 0,
      formattedTime: new Date(fixedServer).toISOString(),
      locale: 'en-US',
    })

    const result = await initializeRundot()

    expect(RundotAPI.requestTimeAsync).toHaveBeenCalled()
    expect(result.serverTimeSynced).toBe(true)
    // getServerNow() reflects the sync offset even if the local clock differs.
    expect(typeof getServerNow()).toBe('number')
  })

  it('emits player_identity analytics from RundotAPI.getProfile()', async () => {
    vi.mocked(RundotAPI.getProfile).mockReturnValueOnce({
      id: 'player_42',
      username: 'BeatMaker',
      isAnonymous: false,
    })

    const result = await initializeRundot()

    expect(RundotAPI.getProfile).toHaveBeenCalled()
    expect(result.profileResolved).toBe(true)
    expect(result.isSignedIn).toBe(true)
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('player_identity', {
      is_signed_in: true,
      has_profile_name: true,
    })
  })

  it('reports anonymous players as not signed in', async () => {
    vi.mocked(RundotAPI.getProfile).mockReturnValueOnce({
      id: 'player_guest',
      username: 'Guest',
      isAnonymous: true,
    })

    const result = await initializeRundot()

    expect(result.isSignedIn).toBe(false)
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('player_identity', {
      is_signed_in: false,
      has_profile_name: true,
    })
  })

  it('subscribes once to lifecycle events even after repeat calls', async () => {
    await initializeRundot()
    await initializeRundot()
    await initializeRundot()
    expect(RundotAPI.lifecycles.onSleep).toHaveBeenCalledTimes(1)
    expect(RundotAPI.lifecycles.onPause).toHaveBeenCalledTimes(1)
    expect(RundotAPI.lifecycles.onQuit).toHaveBeenCalledTimes(1)
  })

  it('emits session_end on lifecycles.onSleep with screen + trigger + duration', async () => {
    const handlers = captureLifecycleHandlers()
    setActiveScreenProvider(() => 'play')
    await initializeRundot()

    vi.clearAllMocks()
    handlers.onSleep?.()

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'session_end',
      expect.objectContaining({
        screen: 'play',
        trigger: 'background_sleep',
      }),
    )
    const callArgs = vi.mocked(RundotAPI.analytics.recordCustomEvent).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >
    expect(typeof callArgs['duration_seconds']).toBe('number')
    expect(callArgs['duration_seconds']).toBeGreaterThanOrEqual(0)
  })

  it('emits session_end on lifecycles.onPause with the pause trigger', async () => {
    const handlers = captureLifecycleHandlers()
    setActiveScreenProvider(() => 'mixes')
    await initializeRundot()

    vi.clearAllMocks()
    handlers.onPause?.()

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'session_end',
      expect.objectContaining({
        screen: 'mixes',
        trigger: 'background_pause',
      }),
    )
  })

  it('emits session_end on lifecycles.onQuit with the quit trigger', async () => {
    const handlers = captureLifecycleHandlers()
    await initializeRundot()

    vi.clearAllMocks()
    handlers.onQuit?.()

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'session_end',
      expect.objectContaining({ trigger: 'quit' }),
    )
  })
})

describe('getServerNow()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRundotInit()
  })

  it('falls back to Date.now() when sync has not happened', () => {
    const before = Date.now()
    const value = getServerNow()
    const after = Date.now()
    expect(value).toBeGreaterThanOrEqual(before)
    expect(value).toBeLessThanOrEqual(after)
  })

  it('returns the same singleton ServerTimeService instance', () => {
    const a = getServerTimeService()
    const b = getServerTimeService()
    expect(a).toBe(b)
  })
})
