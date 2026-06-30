import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { Entitlement, EntitlementState, LedgerEntry } from './types'

interface EntitlementsStore extends EntitlementState {
  loadEntitlements(): Promise<void>
  getQuantity(itemId: string): Promise<number>
  consume(itemId: string, quantity: number, reason?: string): Promise<Entitlement | null>
  getLedger(itemId?: string): Promise<LedgerEntry[]>
  hasEntitlement(itemId: string): boolean
  reset(): void
}

const initialState: EntitlementState = {
  entitlements: new Map(),
  isLoading: false,
  error: null,
}

export const entitlementsStore = create<EntitlementsStore>((set, get) => ({
  ...initialState,

  async loadEntitlements(): Promise<void> {
    set({ isLoading: true, error: null })
    try {
      const list = await RundotAPI['entitlements'].listEntitlements()
      const map = new Map<string, Entitlement>()
      for (const item of list as Entitlement[]) {
        map.set(item.itemId, item)
      }
      set({ entitlements: map, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Failed to load entitlements' })
    }
  },

  async getQuantity(itemId: string): Promise<number> {
    const cached = get().entitlements.get(itemId)
    if (cached) return cached.quantity
    try {
      const quantity = await RundotAPI['entitlements'].getQuantity(itemId)
      return quantity
    } catch {
      return 0
    }
  },

  async consume(itemId: string, quantity: number, reason?: string): Promise<Entitlement | null> {
    set({ isLoading: true, error: null })
    try {
      const result = await RundotAPI['entitlements'].consumeEntitlement(
        itemId,
        quantity,
        undefined,
        reason,
      )
      const entitlement = result as unknown as Entitlement
      if (entitlement && entitlement.itemId) {
        set((state) => {
          const map = new Map(state.entitlements)
          map.set(entitlement.itemId, entitlement)
          return { entitlements: map, isLoading: false }
        })
      } else {
        set({ isLoading: false })
      }
      return entitlement
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Consume failed' })
      return null
    }
  },

  async getLedger(itemId?: string): Promise<LedgerEntry[]> {
    try {
      const entries = await RundotAPI['entitlements'].getLedger(itemId)
      return entries as LedgerEntry[]
    } catch {
      return []
    }
  },

  hasEntitlement(itemId: string): boolean {
    const cached = get().entitlements.get(itemId)
    return cached !== undefined && cached.quantity > 0
  },

  reset(): void {
    set({ entitlements: new Map(), isLoading: false, error: null })
  },
}))
