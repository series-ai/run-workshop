/**
 * fx-state — Zustand store for the FX panel UI surface.
 *
 * Phase 3 of `.project/plans/groovepad-alignment-plan-2026-04-29.md`. The
 * store owns:
 *   - `activeEffect` — which of {filter, flanger, reverb, delay} is selected.
 *   - `params[effect]` — each effect's last-known XY position. The XY pad
 *     reads `params[activeEffect]`; setting params writes back into the same
 *     slot so each effect remembers its own position when the player
 *     switches tabs (Groovepad parity — research/groovepad/features.md:14).
 *   - `x` / `y` — top-level convenience fields mirroring
 *     `params[activeEffect]`. Maintained automatically so existing selectors
 *     (`s.x` / `s.y`) keep working without forcing every consumer through
 *     `params[activeEffect]`.
 *
 * On every action, the store delegates to the `fx-bus` singleton so audio
 * routing follows UI state immediately. The store is intentionally thin —
 * the bus owns smoothing/crossfade so UI components can drive it freely
 * without producing zipper noise.
 *
 * Per-effect defaults are tuned so each tab opens at a musically useful
 * starting point (delay opens shorter / lower-feedback than filter).
 */

import { create } from 'zustand'
import { getFxBus, type FxEffect } from './fx-bus'

export interface FxParams {
  x: number
  y: number
}

export const FX_DEFAULTS: Record<FxEffect, FxParams> = {
  filter: { x: 0.5, y: 0.5 },
  flanger: { x: 0.4, y: 0.4 },
  reverb: { x: 0.5, y: 0.5 },
  delay: { x: 0.3, y: 0.4 },
}

export interface FxState {
  activeEffect: FxEffect
  /** Per-effect XY state — Groovepad-style "each tab remembers its position". */
  params: Record<FxEffect, FxParams>
  /** Active-effect convenience mirror — equal to `params[activeEffect]`. */
  x: number
  y: number
  setActiveEffect: (effect: FxEffect) => void
  setParams: (x: number, y: number) => void
  reset: () => void
}

function cloneDefaults(): Record<FxEffect, FxParams> {
  return {
    filter: { ...FX_DEFAULTS.filter },
    flanger: { ...FX_DEFAULTS.flanger },
    reverb: { ...FX_DEFAULTS.reverb },
    delay: { ...FX_DEFAULTS.delay },
  }
}

export const useFxStore = create<FxState>((set) => ({
  activeEffect: 'filter',
  params: cloneDefaults(),
  x: FX_DEFAULTS.filter.x,
  y: FX_DEFAULTS.filter.y,

  setActiveEffect: (effect) => {
    const { params } = useFxStore.getState()
    const next = params[effect]
    set({ activeEffect: effect, x: next.x, y: next.y })
    getFxBus().setActiveEffect(effect)
    // Push the remembered XY into the bus so the new chain takes effect
    // immediately (Groovepad-style "each tab opens where you left it").
    getFxBus().setParams(next.x, next.y)
  },

  setParams: (x, y) => {
    const clampedX = clamp01(x)
    const clampedY = clamp01(y)
    set((s) => ({
      x: clampedX,
      y: clampedY,
      params: {
        ...s.params,
        [s.activeEffect]: { x: clampedX, y: clampedY },
      },
    }))
    getFxBus().setParams(clampedX, clampedY)
  },

  reset: () => {
    set({
      activeEffect: 'filter',
      params: cloneDefaults(),
      x: FX_DEFAULTS.filter.x,
      y: FX_DEFAULTS.filter.y,
    })
    getFxBus().setActiveEffect('filter')
    getFxBus().setParams(FX_DEFAULTS.filter.x, FX_DEFAULTS.filter.y)
  },
}))

/** Test/debug helper — restore defaults without touching the bus. */
export function __resetFxStateOnly(): void {
  useFxStore.setState({
    activeEffect: 'filter',
    params: cloneDefaults(),
    x: FX_DEFAULTS.filter.x,
    y: FX_DEFAULTS.filter.y,
  })
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
