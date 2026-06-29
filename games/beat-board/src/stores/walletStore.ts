/**
 * walletStore — Zustand wrapper around `RundotAPI.iap.getHardCurrencyBalance()`.
 *
 * Issue beat-board-13-subscription-and-daily-login owns this file as the
 * first issue that credits Runbucks.
 *
 * BeatBoard never holds Runbucks balance state of its own — the SDK is the
 * source of truth. `refresh()` re-reads the platform balance and writes it
 * into the store; UI components subscribe to `balance` and re-render.
 *
 * Initial value: `0`. UI must call `refresh()` after mount (or via the
 * SDK integrator's boot sequence) before showing the chip; until then the
 * chip renders `0`. The legacy `1280` sample value used during the
 * visual-design pass is removed in favour of a server-authoritative read.
 */

import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

export interface WalletState {
  /** Cached Runbucks balance from the most recent `refresh()`. */
  balance: number
  /**
   * Re-read the platform balance from `RundotAPI.iap.getHardCurrencyBalance()`
   * and update `balance`. Errors are swallowed (logged via `RundotAPI.error`)
   * so a failed refresh does not crash the UI; the cached balance simply
   * stays stale until the next successful read.
   */
  refresh(): Promise<void>
}

const INITIAL_BALANCE = 0

export const useWalletStore = create<WalletState>((set) => ({
  balance: INITIAL_BALANCE,

  async refresh(): Promise<void> {
    try {
      const next = await RundotAPI.iap.getHardCurrencyBalance()
      // The SDK returns a number. Defensive coercion guards against test
      // mocks returning unexpected shapes.
      if (typeof next === 'number' && Number.isFinite(next)) {
        set({ balance: next })
      }
    } catch (err) {
      RundotAPI.error('walletStore.refresh failed', { err: String(err) })
    }
  },
}))

/** Test/debug helper — wipe to the post-construction baseline. */
export function resetWalletStore(): void {
  useWalletStore.setState({ balance: INITIAL_BALANCE })
}
