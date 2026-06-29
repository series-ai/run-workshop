import { createContext, useContext } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

export type PreviewFormatFamily = 'landscape' | 'phone' | 'tablet'

export interface PreviewFormat {
  id: string
  label: string
  width: number
  height: number
  layoutWidth?: number
  layoutHeight?: number
  family: PreviewFormatFamily
  note: string
}

// ── Layout helpers ──────────────────────────────────────────────────────────

export function getPreviewLayoutWidth(format: PreviewFormat): number {
  return format.layoutWidth ?? format.width
}

export function getPreviewLayoutHeight(format: PreviewFormat): number {
  return format.layoutHeight ?? format.height
}

export function isWidePreviewViewport(viewport: PreviewFormat): boolean {
  if (viewport.family === 'phone') return false
  return getPreviewLayoutWidth(viewport) >= 600 || viewport.family === 'tablet' || viewport.family === 'landscape'
}

export function isPhoneLandscape(viewport: PreviewFormat): boolean {
  return viewport.family === 'phone' && viewport.width > viewport.height
}

export function isRoomyPreviewViewport(viewport: PreviewFormat): boolean {
  return getPreviewLayoutWidth(viewport) >= 1024 || viewport.family === 'landscape'
}

export function getPreviewInset(viewport: PreviewFormat): number {
  if (isRoomyPreviewViewport(viewport)) {
    return 28
  }
  if (isWidePreviewViewport(viewport)) {
    return 24
  }
  return getPreviewLayoutWidth(viewport) >= 390 ? 20 : 16
}

export function getScreenChromeInset(viewport: PreviewFormat): number {
  return getPreviewInset(viewport)
}

// ── Context ─────────────────────────────────────────────────────────────────

const DEFAULT_VIEWPORT: PreviewFormat = {
  id: 'landscape-1280x720',
  label: 'Landscape',
  width: 1280,
  height: 720,
  family: 'landscape',
  note: 'Wide HUD and desktop-style composition proof.',
}

export const PreviewViewportContext = createContext<PreviewFormat>(DEFAULT_VIEWPORT)

export function usePreviewViewport(): PreviewFormat {
  return useContext(PreviewViewportContext)
}
