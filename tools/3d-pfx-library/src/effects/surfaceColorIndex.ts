import type { PfxRenderSurface } from '../types/02'

export function getPfxSurfaceColorIndex(surface: Pick<PfxRenderSurface, 'role' | 'phase' | 'tuning'>): number {
  if (surface.tuning?.colorIndex !== undefined) return surface.tuning.colorIndex
  return surface.role === 'trail' || surface.phase?.includes('ring') || surface.phase?.includes('latitude')
    ? 1
    : surface.role === 'screen' || surface.phase?.includes('flash') || surface.phase?.includes('glint')
      ? 2
      : 0
}
