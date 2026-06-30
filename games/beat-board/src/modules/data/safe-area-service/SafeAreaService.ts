/**
 * Safe area service — reads mobile notch/home-indicator insets from RundotAPI.
 * Source: venus-content/H5/cozy-crime/src/services/rundot/safeAreaService.ts
 *
 * Call refreshFromHost() once at startup.
 * CSS vars: --safe-top, --safe-right, --safe-bottom, --safe-left, --safe-top-strip,
 *           --hud-safe-top-shift, --popup-safe-top-shift, --modal-click-blocker-alpha
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

interface SafeAreaPolicy {
  hudTopShift: number
  popupTopShift: number
  topSafeStrip: number
}

const ZERO_SAFE_AREA: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 }
const FALLBACK_VIEWPORT_WIDTH = 360

function toSafeInset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function isSafeAreaRecord(value: unknown): value is SafeAreaInsets {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return ['top', 'right', 'bottom', 'left'].every((k) => typeof r[k] === 'number')
}

function normalizeSafeArea(input: unknown): SafeAreaInsets {
  if (!isSafeAreaRecord(input)) return { ...ZERO_SAFE_AREA }
  return {
    top: toSafeInset(input.top),
    right: toSafeInset(input.right),
    bottom: toSafeInset(input.bottom),
    left: toSafeInset(input.left),
  }
}

export function deriveSafeAreaPolicy(
  safeArea: SafeAreaInsets,
  _viewportWidth: number,
): SafeAreaPolicy {
  return {
    hudTopShift: 0,
    popupTopShift: 0,
    topSafeStrip: Math.max(0, safeArea.top),
  }
}

function getViewportWidth(): number {
  if (typeof window === 'undefined') return FALLBACK_VIEWPORT_WIDTH
  return Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || FALLBACK_VIEWPORT_WIDTH))
}

function applySafeAreaToCss(safeArea: SafeAreaInsets): void {
  if (typeof document === 'undefined') return
  const policy = deriveSafeAreaPolicy(safeArea, getViewportWidth())
  const root = document.documentElement
  root.style.setProperty('--safe-top', `${safeArea.top}px`)
  root.style.setProperty('--safe-right', `${safeArea.right}px`)
  root.style.setProperty('--safe-bottom', `${safeArea.bottom}px`)
  root.style.setProperty('--safe-left', `${safeArea.left}px`)
  root.style.setProperty('--safe-top-strip', `${policy.topSafeStrip}px`)
  root.style.setProperty('--hud-safe-top-shift', `${policy.hudTopShift}px`)
  root.style.setProperty('--popup-safe-top-shift', `${policy.popupTopShift}px`)
  root.style.setProperty('--modal-click-blocker-alpha', '0.8')
}

class SafeAreaService {
  private current: SafeAreaInsets = { ...ZERO_SAFE_AREA }

  getCurrent(): SafeAreaInsets {
    return { ...this.current }
  }

  async refreshFromHost(): Promise<SafeAreaInsets> {
    try {
      const api = RundotAPI as unknown as { system?: { getSafeArea?: () => unknown } }
      const raw = api.system?.getSafeArea?.()
      const normalized = normalizeSafeArea(raw)
      this.current = normalized
      applySafeAreaToCss(normalized)
      return normalized
    } catch {
      this.current = { ...ZERO_SAFE_AREA }
      applySafeAreaToCss(this.current)
      return this.getCurrent()
    }
  }
}

export const safeAreaService = new SafeAreaService()
