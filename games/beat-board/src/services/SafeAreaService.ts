/**
 * Safe-area service — syncs host safe-area insets (Rundot native toolbar,
 * iOS notch, Android gesture indicator) to CSS variables on <html>:
 *
 *   --safe-top, --safe-right, --safe-bottom, --safe-left
 *
 * Foreground UI consumes these via the `.ui-safe-region` utility class in
 * style.css. Background content (world canvas, full-bleed art) uses
 * `.ui-background-bleed` and ignores safe area so it extends under the
 * notch / indicator.
 *
 * This service is bundled into the template because every game on Rundot
 * needs it. Call `refreshSafeArea()` once from main.tsx after SDK init.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 }

function toPx(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function readInsetsFromHost(): SafeAreaInsets {
  const api = RundotAPI as unknown as { system?: { getSafeArea?: () => unknown } }
  const raw = api.system?.getSafeArea?.()
  if (!raw || typeof raw !== 'object') return { ...ZERO }
  const r = raw as Record<string, unknown>
  return { top: toPx(r['top']), right: toPx(r['right']), bottom: toPx(r['bottom']), left: toPx(r['left']) }
}

function apply(insets: SafeAreaInsets): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--safe-top', `${insets.top}px`)
  root.style.setProperty('--safe-right', `${insets.right}px`)
  root.style.setProperty('--safe-bottom', `${insets.bottom}px`)
  root.style.setProperty('--safe-left', `${insets.left}px`)
}

/**
 * Read host insets once and publish them as CSS variables. Returns the insets
 * applied (useful for tests). Safe to call before or without RundotAPI init —
 * a missing host contract resolves to zero insets, and `env(safe-area-inset-*)`
 * still provides the browser fallback in `.ui-safe-region`.
 */
export function refreshSafeArea(): SafeAreaInsets {
  const insets = readInsetsFromHost()
  apply(insets)
  return insets
}
