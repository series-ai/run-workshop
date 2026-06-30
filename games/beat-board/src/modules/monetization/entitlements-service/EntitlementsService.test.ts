import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { entitlementsStore } from './EntitlementsService'

beforeEach(() => {
  entitlementsStore.getState().reset()
  vi.clearAllMocks()
})

describe('EntitlementsService', () => {
  describe('loadEntitlements', () => {
    it('fetches and caches all entitlements', async () => {
      const mockEntitlements = [
        { entitlementId: 'e1', itemId: 'boost_token', quantity: 5, consumable: true, status: 'active', expiresAt: null },
        { entitlementId: 'e2', itemId: 'premium_skin', quantity: 1, consumable: false, status: 'active', expiresAt: null },
      ]
      vi.mocked(RundotAPI['entitlements'].listEntitlements).mockResolvedValueOnce(mockEntitlements as never[])

      await entitlementsStore.getState().loadEntitlements()
      const state = entitlementsStore.getState()
      expect(state.entitlements.size).toBe(2)
      expect(state.entitlements.get('boost_token')?.quantity).toBe(5)
      expect(state.isLoading).toBe(false)
    })

    it('handles error', async () => {
      vi.mocked(RundotAPI['entitlements'].listEntitlements).mockRejectedValueOnce(new Error('Network'))

      await entitlementsStore.getState().loadEntitlements()
      expect(entitlementsStore.getState().error).toBe('Network')
    })
  })

  describe('getQuantity', () => {
    it('returns cached quantity', async () => {
      const mockEntitlements = [
        { entitlementId: 'e1', itemId: 'boost_token', quantity: 3, consumable: true, status: 'active', expiresAt: null },
      ]
      vi.mocked(RundotAPI['entitlements'].listEntitlements).mockResolvedValueOnce(mockEntitlements as never[])
      await entitlementsStore.getState().loadEntitlements()

      const qty = await entitlementsStore.getState().getQuantity('boost_token')
      expect(qty).toBe(3)
    })

    it('fetches from SDK when not cached', async () => {
      vi.mocked(RundotAPI['entitlements'].getQuantity).mockResolvedValueOnce(7)

      const qty = await entitlementsStore.getState().getQuantity('unknown_item')
      expect(qty).toBe(7)
      expect(vi.mocked(RundotAPI['entitlements'].getQuantity)).toHaveBeenCalledWith('unknown_item')
    })

    it('returns 0 on error', async () => {
      vi.mocked(RundotAPI['entitlements'].getQuantity).mockRejectedValueOnce(new Error('fail'))

      const qty = await entitlementsStore.getState().getQuantity('bad_item')
      expect(qty).toBe(0)
    })
  })

  describe('consume', () => {
    it('consumes entitlement and updates cache', async () => {
      const result = { entitlementId: 'e1', itemId: 'boost_token', quantity: 2, consumable: true, status: 'active', expiresAt: null }
      vi.mocked(RundotAPI['entitlements'].consumeEntitlement).mockResolvedValueOnce(result as never)

      const consumed = await entitlementsStore.getState().consume('boost_token', 1, 'used_in_game')
      expect(consumed).toEqual(result)
      expect(entitlementsStore.getState().entitlements.get('boost_token')?.quantity).toBe(2)
    })

    it('handles consume error', async () => {
      vi.mocked(RundotAPI['entitlements'].consumeEntitlement).mockRejectedValueOnce(new Error('Insufficient'))

      const consumed = await entitlementsStore.getState().consume('boost_token', 1)
      expect(consumed).toBeNull()
      expect(entitlementsStore.getState().error).toBe('Insufficient')
    })
  })

  describe('getLedger', () => {
    it('returns ledger entries', async () => {
      const mockLedger = [
        { entitlementId: 'e1', itemId: 'boost_token', quantity: -1, reason: 'consumed', referenceId: null, createdAt: 1000 },
      ]
      vi.mocked(RundotAPI['entitlements'].getLedger).mockResolvedValueOnce(mockLedger as never[])

      const ledger = await entitlementsStore.getState().getLedger('boost_token')
      expect(ledger).toEqual(mockLedger)
    })

    it('returns empty array on error', async () => {
      vi.mocked(RundotAPI['entitlements'].getLedger).mockRejectedValueOnce(new Error('fail'))

      const ledger = await entitlementsStore.getState().getLedger()
      expect(ledger).toEqual([])
    })
  })

  describe('hasEntitlement', () => {
    it('returns true when quantity > 0', async () => {
      const mockEntitlements = [
        { entitlementId: 'e1', itemId: 'boost_token', quantity: 1, consumable: true, status: 'active', expiresAt: null },
      ]
      vi.mocked(RundotAPI['entitlements'].listEntitlements).mockResolvedValueOnce(mockEntitlements as never[])
      await entitlementsStore.getState().loadEntitlements()

      expect(entitlementsStore.getState().hasEntitlement('boost_token')).toBe(true)
    })

    it('returns false when not cached', () => {
      expect(entitlementsStore.getState().hasEntitlement('unknown')).toBe(false)
    })
  })

  it('reset clears state', async () => {
    const mockEntitlements = [
      { entitlementId: 'e1', itemId: 'boost_token', quantity: 1, consumable: true, status: 'active', expiresAt: null },
    ]
    vi.mocked(RundotAPI['entitlements'].listEntitlements).mockResolvedValueOnce(mockEntitlements as never[])
    await entitlementsStore.getState().loadEntitlements()

    entitlementsStore.getState().reset()
    expect(entitlementsStore.getState().entitlements.size).toBe(0)
    expect(entitlementsStore.getState().error).toBeNull()
  })
})
