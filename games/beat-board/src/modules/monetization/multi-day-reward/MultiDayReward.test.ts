import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {
    isMock: () => true,
    error: vi.fn(),
    lifecycles: {
      onSleep: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      onQuit: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    },
  },
}))

import { createMultiDayRewardStore } from './MultiDayReward'
import type { MultiDayRewardConfig } from './types'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { MultiDayRewardStore } from './MultiDayReward'
import { StorageService, MemoryStorageAdapter } from '@modules/data/storage-service/StorageService'
import { createPersistenceManager } from '@modules/data/storage-service/PersistenceManager'

const DAY_MS = 86400000

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  return value as T
}

const testConfigs: MultiDayRewardConfig[] = [
  {
    id: 'login-bonus',
    totalDays: 3,
    dailyRewards: [
      { day: 1, rewardId: 'coins', quantity: 100 },
      { day: 2, rewardId: 'coins', quantity: 200 },
      { day: 3, rewardId: 'gem', quantity: 1 },
    ],
  },
  {
    id: 'purchase-track',
    totalDays: 2,
    instantRewardId: 'welcome-pack',
    dailyRewards: [
      { day: 1, rewardId: 'skin', quantity: 1 },
      { day: 2, rewardId: 'badge', quantity: 1 },
    ],
    cooldownMs: 3600000, // 1 hour
  },
]

describe('MultiDayReward', () => {
  let store: UseBoundStore<StoreApi<MultiDayRewardStore>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000000)
    store = createMultiDayRewardStore(testConfigs)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('activate creates track with correct initial state', () => {
    store.getState().activate('login-bonus')
    const track = store.getState().tracks['login-bonus']
    expect(track).toEqual({
      configId: 'login-bonus',
      activatedAt: 1000000,
      claimedDays: 0,
      lastClaimAt: null,
      isComplete: false,
    })
  })

  it('activate returns instantRewardId when defined', () => {
    const result = store.getState().activate('purchase-track')
    expect(result).toEqual({ instantRewardId: 'welcome-pack' })
  })

  it('activate does nothing if already active', () => {
    store.getState().activate('login-bonus')
    const result = store.getState().activate('login-bonus')
    expect(result).toEqual({})
    // Track unchanged
    expect(requireDefined(store.getState().tracks['login-bonus']).activatedAt).toBe(1000000)
  })

  it('first claim succeeds immediately after activation', () => {
    store.getState().activate('login-bonus')
    expect(store.getState().canClaim('login-bonus')).toBe(true)
    const reward = store.getState().claim('login-bonus')
    expect(reward).toEqual({ day: 1, rewardId: 'coins', quantity: 100 })
    expect(requireDefined(store.getState().tracks['login-bonus']).claimedDays).toBe(1)
  })

  it('second claim blocked by cooldown', () => {
    store.getState().activate('login-bonus')
    store.getState().claim('login-bonus')
    expect(store.getState().canClaim('login-bonus')).toBe(false)
    const reward = store.getState().claim('login-bonus')
    expect(reward).toBeNull()
  })

  it('claim after cooldown elapsed succeeds', () => {
    store.getState().activate('login-bonus')
    store.getState().claim('login-bonus')

    vi.advanceTimersByTime(DAY_MS)

    expect(store.getState().canClaim('login-bonus')).toBe(true)
    const reward = store.getState().claim('login-bonus')
    expect(reward).toEqual({ day: 2, rewardId: 'coins', quantity: 200 })
  })

  it('claim advances day correctly', () => {
    store.getState().activate('login-bonus')

    store.getState().claim('login-bonus')
    expect(requireDefined(store.getState().tracks['login-bonus']).claimedDays).toBe(1)

    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    expect(requireDefined(store.getState().tracks['login-bonus']).claimedDays).toBe(2)

    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    expect(requireDefined(store.getState().tracks['login-bonus']).claimedDays).toBe(3)
  })

  it('isComplete when all days claimed', () => {
    store.getState().activate('login-bonus')
    store.getState().claim('login-bonus')
    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')

    expect(store.getState().isComplete('login-bonus')).toBe(true)
    expect(requireDefined(store.getState().tracks['login-bonus']).isComplete).toBe(true)
  })

  it('claim returns null when complete', () => {
    store.getState().activate('login-bonus')
    store.getState().claim('login-bonus')
    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')

    vi.advanceTimersByTime(DAY_MS)
    expect(store.getState().canClaim('login-bonus')).toBe(false)
    expect(store.getState().claim('login-bonus')).toBeNull()
  })

  it('multiple independent tracks', () => {
    store.getState().activate('login-bonus')
    store.getState().activate('purchase-track')

    store.getState().claim('login-bonus')
    store.getState().claim('purchase-track')

    expect(requireDefined(store.getState().tracks['login-bonus']).claimedDays).toBe(1)
    expect(requireDefined(store.getState().tracks['purchase-track']).claimedDays).toBe(1)

    // purchase-track uses 1 hour cooldown
    vi.advanceTimersByTime(3600000)
    expect(store.getState().canClaim('purchase-track')).toBe(true)
    expect(store.getState().canClaim('login-bonus')).toBe(false)
  })

  it('getTimeUntilNextClaim returns correct ms', () => {
    store.getState().activate('login-bonus')
    expect(store.getState().getTimeUntilNextClaim('login-bonus')).toBe(0)

    store.getState().claim('login-bonus')
    expect(store.getState().getTimeUntilNextClaim('login-bonus')).toBe(DAY_MS)

    vi.advanceTimersByTime(DAY_MS / 2)
    expect(store.getState().getTimeUntilNextClaim('login-bonus')).toBe(DAY_MS / 2)

    vi.advanceTimersByTime(DAY_MS / 2)
    expect(store.getState().getTimeUntilNextClaim('login-bonus')).toBe(0)
  })

  it('getDaysRemaining decreases', () => {
    store.getState().activate('login-bonus')
    expect(store.getState().getDaysRemaining('login-bonus')).toBe(3)

    store.getState().claim('login-bonus')
    expect(store.getState().getDaysRemaining('login-bonus')).toBe(2)

    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    expect(store.getState().getDaysRemaining('login-bonus')).toBe(1)

    vi.advanceTimersByTime(DAY_MS)
    store.getState().claim('login-bonus')
    expect(store.getState().getDaysRemaining('login-bonus')).toBe(0)
  })

  it('reset clears all tracks', () => {
    store.getState().activate('login-bonus')
    store.getState().activate('purchase-track')
    store.getState().claim('login-bonus')

    store.getState().reset()

    expect(store.getState().tracks).toEqual({})
    expect(store.getState().isActive('login-bonus')).toBe(false)
    expect(store.getState().isActive('purchase-track')).toBe(false)
  })

  it('custom cooldownMs is respected', () => {
    store.getState().activate('purchase-track')
    store.getState().claim('purchase-track')

    // 1 hour cooldown for purchase-track
    vi.advanceTimersByTime(3600000 - 1)
    expect(store.getState().canClaim('purchase-track')).toBe(false)

    vi.advanceTimersByTime(1)
    expect(store.getState().canClaim('purchase-track')).toBe(true)
  })

  describe('persistence round-trip', () => {
    it('survives flush → restore cycle', async () => {
      vi.useRealTimers()

      const storage = new StorageService('test')
      storage.setAdapter(new MemoryStorageAdapter())
      const pm = createPersistenceManager(storage)

      const store1 = createMultiDayRewardStore(testConfigs, pm)
      store1.getState().activate('login-bonus', 1000000)
      store1.getState().claim('login-bonus', 1000000)

      await pm.flush()

      const store2 = createMultiDayRewardStore(testConfigs, pm)
      await pm.restoreAll()

      expect(store2.getState().tracks['login-bonus']?.claimedDays).toBe(
        store1.getState().tracks['login-bonus']?.claimedDays
      )
      expect(store2.getState().tracks['login-bonus']?.lastClaimAt).toBe(
        store1.getState().tracks['login-bonus']?.lastClaimAt
      )

      pm.destroy()
    })
  })
})
