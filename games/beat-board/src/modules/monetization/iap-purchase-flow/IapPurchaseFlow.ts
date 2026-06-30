import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { PurchaseState } from './types'

interface IapStore extends PurchaseState {
  openStore(): Promise<{ purchased: boolean; newBalance: number }>
  spendCurrency(productId: string, amount: number): Promise<void>
  getBalance(): Promise<number>
  hasUserMadePurchase(): Promise<boolean>
  reset(): void
}

const initialState: PurchaseState = {
  isLoading: false,
  error: null,
  lastOpenedAt: null,
  balance: 0,
}

export const iapStore = create<IapStore>((set) => ({
  ...initialState,

  async openStore(): Promise<{ purchased: boolean; newBalance: number }> {
    set({ isLoading: true, error: null })
    try {
      const result = await RundotAPI['iap']['openStore']()
      set({ isLoading: false, lastOpenedAt: Date.now(), balance: result.newBalance })
      return result
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Failed to open store' })
      return { purchased: false, newBalance: 0 }
    }
  },

  async spendCurrency(productId: string, amount: number): Promise<void> {
    set({ isLoading: true, error: null })
    try {
      await RundotAPI['iap']['spendCurrency'](productId, amount)
      set({ isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Spend failed' })
    }
  },

  async getBalance(): Promise<number> {
    try {
      const balance = await RundotAPI['iap']['getHardCurrencyBalance']()
      set({ balance })
      return balance
    } catch (err) {
      set({ error: (err as Error).message ?? 'Failed to get balance' })
      return 0
    }
  },

  async hasUserMadePurchase(): Promise<boolean> {
    try {
      return await RundotAPI['iap']['hasUserMadePurchase']()
    } catch (err) {
      RundotAPI.error('IapPurchaseFlow.hasUserMadePurchase:', err)
      return false
    }
  },

  reset(): void {
    set(initialState)
  },
}))
