import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { iapStore } from './IapPurchaseFlow'

beforeEach(() => {
  iapStore.getState().reset()
  vi.clearAllMocks()
})

describe('IapPurchaseFlow', () => {
  it('openStore calls SDK iap.openStore and returns result', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: true, newBalance: 500 })

    const result = await iapStore.getState().openStore()
    expect(vi.mocked(RundotAPI['iap']['openStore'])).toHaveBeenCalledOnce()
    expect(result.purchased).toBe(true)
    expect(result.newBalance).toBe(500)
  })

  it('openStore updates balance from result', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: true, newBalance: 1200 })

    await iapStore.getState().openStore()
    expect(iapStore.getState().balance).toBe(1200)
  })

  it('openStore returns purchased: false when SDK returns false', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: false, newBalance: 0 })

    const result = await iapStore.getState().openStore()
    expect(result.purchased).toBe(false)
  })

  it('openStore sets lastOpenedAt after success', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: false, newBalance: 0 })

    expect(iapStore.getState().lastOpenedAt).toBeNull()
    await iapStore.getState().openStore()
    expect(iapStore.getState().lastOpenedAt).not.toBeNull()
  })

  it('openStore sets isLoading false after completion', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: false, newBalance: 0 })

    await iapStore.getState().openStore()
    expect(iapStore.getState().isLoading).toBe(false)
  })

  it('openStore handles error', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockRejectedValueOnce(new Error('Network error'))

    const result = await iapStore.getState().openStore()
    expect(result.purchased).toBe(false)
    expect(iapStore.getState().error).toBe('Network error')
  })

  it('spendCurrency calls SDK with productId and amount', async () => {
    await iapStore.getState().spendCurrency('gem_pack_100', 100)
    expect(vi.mocked(RundotAPI['iap']['spendCurrency'])).toHaveBeenCalledWith('gem_pack_100', 100)
    expect(iapStore.getState().isLoading).toBe(false)
    expect(iapStore.getState().error).toBeNull()
  })

  it('spendCurrency sets error on SDK failure', async () => {
    vi.mocked(RundotAPI['iap']['spendCurrency']).mockRejectedValueOnce(new Error('insufficient funds'))

    await iapStore.getState().spendCurrency('gem_pack_100', 100)
    expect(iapStore.getState().error).toBe('insufficient funds')
  })

  it('getBalance fetches and stores balance', async () => {
    vi.mocked(RundotAPI['iap']['getHardCurrencyBalance']).mockResolvedValueOnce(750)

    const balance = await iapStore.getState().getBalance()
    expect(balance).toBe(750)
    expect(iapStore.getState().balance).toBe(750)
  })

  it('hasUserMadePurchase returns SDK result', async () => {
    vi.mocked(RundotAPI['iap']['hasUserMadePurchase']).mockResolvedValueOnce(true)

    const result = await iapStore.getState().hasUserMadePurchase()
    expect(result).toBe(true)
  })

  it('hasUserMadePurchase returns false on error', async () => {
    vi.mocked(RundotAPI['iap']['hasUserMadePurchase']).mockRejectedValueOnce(new Error('fail'))

    const result = await iapStore.getState().hasUserMadePurchase()
    expect(result).toBe(false)
  })

  it('reset clears state', async () => {
    vi.mocked(RundotAPI['iap']['openStore']).mockResolvedValueOnce({ purchased: true, newBalance: 500 })
    await iapStore.getState().openStore()
    iapStore.getState().reset()
    expect(iapStore.getState().lastOpenedAt).toBeNull()
    expect(iapStore.getState().isLoading).toBe(false)
    expect(iapStore.getState().error).toBeNull()
    expect(iapStore.getState().balance).toBe(0)
  })
})
