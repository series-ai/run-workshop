/**
 * App Lifecycle service — pure TypeScript wrapper over RundotAPI.lifecycles.
 * Source: venus-content/H5/alt-canon + rolesim lifecycle hooks (merged).
 *
 * Tracks lifecycle state (initializing → ready → playing/hidden/paused) and
 * forwards SDK callbacks to user-provided handlers. Designed as a singleton
 * service that a React hook (or any consumer) can wrap.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LifecycleState = 'initializing' | 'ready' | 'playing' | 'hidden' | 'paused'

export interface LifecycleCallbacks {
  /** Called when the SDK fires onAwake (app becomes visible/active). */
  onAwake?: () => void
  /** Called when the SDK fires onSleep (app hidden). */
  onSleep?: () => void
  /** Called when the SDK fires onPause (modal/overlay). */
  onPause?: () => void
  /** Called when the SDK fires onResume (returns from pause). */
  onResume?: () => void
  /** Called on every state transition, after the new state is set. */
  onStateChange?: (state: LifecycleState) => void
}

export interface LifecycleService {
  /** Current lifecycle state. */
  getState(): LifecycleState
  /**
   * Register lifecycle handlers with the SDK. Call once after SDK init.
   * Returns a cleanup function that sets an internal disposed flag so future
   * SDK callbacks become no-ops (the SDK itself doesn't support unsubscribe).
   *
   * Double-register guard: if called twice, the second call is a no-op and
   * returns the same cleanup function. This handles React StrictMode.
   */
  register(callbacks?: LifecycleCallbacks): () => void
  /** Manually set state (e.g. after init completes, set to 'ready' then 'playing'). */
  setState(state: LifecycleState): void
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createAppLifecycle(): LifecycleService {
  let state: LifecycleState = 'initializing'
  let disposed = false
  let registered = false
  let callbacks: LifecycleCallbacks | undefined
  let cleanupFn: (() => void) | undefined

  function transition(next: LifecycleState): void {
    if (disposed) return
    state = next
    callbacks?.onStateChange?.(next)
  }

  const service: LifecycleService = {
    getState() {
      return state
    },

    register(cbs?: LifecycleCallbacks): () => void {
      // Double-register guard: second call is a no-op, returns existing cleanup.
      if (registered) {
        return cleanupFn!
      }
      registered = true
      callbacks = cbs

      RundotAPI['lifecycles'].onAwake(() => {
        if (disposed) return
        transition('playing')
        callbacks?.onAwake?.()
      })

      RundotAPI['lifecycles'].onSleep(() => {
        if (disposed) return
        transition('hidden')
        callbacks?.onSleep?.()
      })

      RundotAPI['lifecycles'].onPause(() => {
        if (disposed) return
        transition('paused')
        callbacks?.onPause?.()
      })

      RundotAPI['lifecycles'].onResume(() => {
        if (disposed) return
        transition('playing')
        callbacks?.onResume?.()
      })

      cleanupFn = () => {
        disposed = true
      }
      return cleanupFn
    },

    setState(next: LifecycleState): void {
      transition(next)
    },
  }

  return service
}
