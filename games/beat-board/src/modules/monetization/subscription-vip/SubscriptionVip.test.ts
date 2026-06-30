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

import { subscriptionStore, setupPersistence } from './SubscriptionVip'
import { StorageService, MemoryStorageAdapter } from '@modules/data/storage-service/StorageService'
import { createPersistenceManager } from '@modules/data/storage-service/PersistenceManager'

beforeEach(() => {
  subscriptionStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SubscriptionVip', () => {
  it('setSubscription updates tier to platform tier', () => {
    subscriptionStore.getState().setSubscription('CORE', Date.now() + 100000)
    expect(subscriptionStore.getState().tier).toBe('CORE')
  })

  it('isActive false when tier is none', () => {
    expect(subscriptionStore.getState().isActive()).toBe(false)
  })

  it('isActive true when tier set and not expired', () => {
    subscriptionStore.getState().setSubscription('PLUS', Date.now() + 100000)
    expect(subscriptionStore.getState().isActive()).toBe(true)
  })

  it('isActive true when expiresAt is null (platform-managed)', () => {
    subscriptionStore.getState().syncFromPlatform('CORE')
    expect(subscriptionStore.getState().expiresAt).toBeNull()
    expect(subscriptionStore.getState().isActive()).toBe(true)
  })

  it('isActive false when expired', () => {
    subscriptionStore.getState().setSubscription('CORE', Date.now() - 1000)
    expect(subscriptionStore.getState().isActive()).toBe(false)
  })

  it('hasBenefit checks tier benefits', () => {
    subscriptionStore.getState().setSubscription('CORE', Date.now() + 100000)
    expect(subscriptionStore.getState().hasBenefit('no_ads')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('cloud_mix_backup')).toBe(false)
  })

  it('PLUS tier includes CORE benefits plus cloud_mix_backup + exclusive_packs', () => {
    subscriptionStore.getState().setSubscription('PLUS', Date.now() + 100000)
    expect(subscriptionStore.getState().hasBenefit('no_ads')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('cloud_mix_backup')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('exclusive_packs')).toBe(true)
  })

  it('PRIME tier (not offered for purchase in v1) maps to PLUS-equivalent benefits', () => {
    subscriptionStore.getState().setSubscription('PRIME', Date.now() + 100000)
    expect(subscriptionStore.getState().hasBenefit('no_ads')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('cloud_mix_backup')).toBe(true)
  })

  it('ULTIMATE tier (not offered for purchase in v1) maps to PLUS-equivalent benefits', () => {
    subscriptionStore.getState().setSubscription('ULTIMATE', Date.now() + 100000)
    expect(subscriptionStore.getState().hasBenefit('no_ads')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('cloud_mix_backup')).toBe(true)
    expect(subscriptionStore.getState().hasBenefit('exclusive_packs')).toBe(true)
  })

  it('getMultiplier returns 1x for every tier (BeatBoard v1 has no multiplier)', () => {
    subscriptionStore.getState().setSubscription('CORE', Date.now() + 100000)
    expect(subscriptionStore.getState().getMultiplier('rewards')).toBe(1)

    subscriptionStore.getState().setSubscription('PLUS', Date.now() + 100000)
    expect(subscriptionStore.getState().getMultiplier('rewards')).toBe(1)

    subscriptionStore.getState().setSubscription('PRIME', Date.now() + 100000)
    expect(subscriptionStore.getState().getMultiplier('rewards')).toBe(1)

    subscriptionStore.getState().setSubscription('ULTIMATE', Date.now() + 100000)
    expect(subscriptionStore.getState().getMultiplier('rewards')).toBe(1)
  })

  it('getMultiplier returns 1 when no subscription', () => {
    expect(subscriptionStore.getState().getMultiplier('rewards')).toBe(1)
  })

  describe('syncFromPlatform', () => {
    it('sets tier and benefits from platform tier', () => {
      subscriptionStore.getState().syncFromPlatform('PLUS')
      expect(subscriptionStore.getState().tier).toBe('PLUS')
      expect(subscriptionStore.getState().hasBenefit('no_ads')).toBe(true)
      expect(subscriptionStore.getState().hasBenefit('cloud_mix_backup')).toBe(true)
      expect(subscriptionStore.getState().expiresAt).toBeNull()
    })

    it('null tier resets to none', () => {
      subscriptionStore.getState().syncFromPlatform('CORE')
      expect(subscriptionStore.getState().isActive()).toBe(true)
      subscriptionStore.getState().syncFromPlatform(null)
      expect(subscriptionStore.getState().tier).toBe('none')
      expect(subscriptionStore.getState().isActive()).toBe(false)
    })
  })

  describe('getSubscriptionRewards', () => {
    it('returns null when no subscription', () => {
      expect(subscriptionStore.getState().getSubscriptionRewards()).toBeNull()
    })

    it('returns tier benefits for active subscription', () => {
      subscriptionStore.getState().syncFromPlatform('CORE')
      const rewards = subscriptionStore.getState().getSubscriptionRewards()
      expect(rewards).not.toBeNull()
      expect(rewards!.dailyReward).toEqual({ rewardId: 'runbucks', quantity: 50 })
      expect(rewards!.rewardMultiplier).toBe(1)
    })

    it('PLUS yields the BeatBoard daily Runbucks drip of 200', () => {
      subscriptionStore.getState().syncFromPlatform('PLUS')
      const rewards = subscriptionStore.getState().getSubscriptionRewards()
      expect(rewards!.dailyReward.quantity).toBe(200)
      expect(rewards!.rewardMultiplier).toBe(1)
    })
  })

  describe('daily claim', () => {
    const DAY_MS = 86400000

    it('canClaimDaily true for active sub with no prior claim', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().syncFromPlatform('CORE')
      expect(subscriptionStore.getState().canClaimDaily()).toBe(true)
    })

    it('claimDaily returns correct reward for CORE tier (50 Runbucks/day)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().syncFromPlatform('CORE')
      const reward = subscriptionStore.getState().claimDaily()
      expect(reward).toEqual({ rewardId: 'runbucks', quantity: 50 })
    })

    it('claimDaily returns correct reward for PLUS tier (200 Runbucks/day)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().syncFromPlatform('PLUS')
      const reward = subscriptionStore.getState().claimDaily()
      expect(reward).toEqual({ rewardId: 'runbucks', quantity: 200 })
    })

    it('claimDaily blocked within 24h cooldown', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().setSubscription('CORE', Date.now() + DAY_MS * 2)
      subscriptionStore.getState().claimDaily()
      vi.advanceTimersByTime(DAY_MS - 1)
      expect(subscriptionStore.getState().canClaimDaily()).toBe(false)
      expect(subscriptionStore.getState().claimDaily()).toBeNull()
    })

    it('claimDaily blocked when subscription expired', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().setSubscription('CORE', Date.now() - 1)
      expect(subscriptionStore.getState().canClaimDaily()).toBe(false)
      expect(subscriptionStore.getState().claimDaily()).toBeNull()
    })

    it('claimDaily blocked when no subscription (tier none)', () => {
      expect(subscriptionStore.getState().canClaimDaily()).toBe(false)
      expect(subscriptionStore.getState().claimDaily()).toBeNull()
    })

    it('getTimeUntilDailyClaim returns correct ms', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().setSubscription('CORE', Date.now() + DAY_MS * 2)
      subscriptionStore.getState().claimDaily()
      vi.advanceTimersByTime(10000)
      expect(subscriptionStore.getState().getTimeUntilDailyClaim()).toBe(DAY_MS - 10000)
    })

    it('getTimeUntilDailyClaim returns 0 when can claim', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000)
      subscriptionStore.getState().syncFromPlatform('CORE')
      expect(subscriptionStore.getState().getTimeUntilDailyClaim()).toBe(0)
    })
  })

  describe('persistence', () => {
    it('survives flush → restore cycle', async () => {
      const storage = new StorageService('test')
      storage.setAdapter(new MemoryStorageAdapter())
      const pm = createPersistenceManager(storage)

      setupPersistence(pm)

      const expiresAt = Date.now() + 100000
      subscriptionStore.getState().setSubscription('PRIME', expiresAt)

      await pm.flush()

      subscriptionStore.getState().reset()
      await pm.restoreAll()

      expect(subscriptionStore.getState().tier).toBe('PRIME')
      expect(subscriptionStore.getState().expiresAt).toBe(expiresAt)
      expect(subscriptionStore.getState().benefits).toContain('no_ads')
      expect(subscriptionStore.getState().benefits).toContain('cloud_mix_backup')

      pm.destroy()
    })

    it('migrates legacy "basic" tier to CORE on restore', async () => {
      const storage = new StorageService('test-migrate')
      const adapter = new MemoryStorageAdapter()
      storage.setAdapter(adapter)

      // Pre-seed storage with legacy data (simulates old app version)
      await adapter.setItem('subscription-vip:v1', JSON.stringify({
        tier: 'basic',
        expiresAt: Date.now() + 100000,
        benefits: ['no_ads', '2x_rewards'],
        lastDailyClaimAt: null,
      }))

      const pm = createPersistenceManager(storage)
      setupPersistence(pm)
      await pm.restoreAll()

      expect(subscriptionStore.getState().tier).toBe('CORE')

      pm.destroy()
    })

    it('migrates legacy "premium" tier to PLUS on restore', async () => {
      const storage = new StorageService('test-migrate-premium')
      const adapter = new MemoryStorageAdapter()
      storage.setAdapter(adapter)

      await adapter.setItem('subscription-vip:v1', JSON.stringify({
        tier: 'premium',
        expiresAt: Date.now() + 100000,
        benefits: ['no_ads', '3x_rewards', 'exclusive_content'],
        lastDailyClaimAt: null,
      }))

      const pm = createPersistenceManager(storage)
      setupPersistence(pm)
      await pm.restoreAll()

      expect(subscriptionStore.getState().tier).toBe('PLUS')

      pm.destroy()
    })
  })
})
