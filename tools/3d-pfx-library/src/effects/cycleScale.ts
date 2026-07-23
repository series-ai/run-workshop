import type { PfxRenderSurface } from '../types/02'

export function getPfxCycleScale(surfaces: ReadonlyArray<Pick<PfxRenderSurface, 'kind' | 'tuning'>>): number {
  let scale = 1
  for (const surface of surfaces) {
    const tuning = surface.tuning ?? {}
    const window = tuning.window ?? 1
    if (window >= 1) continue
    const deathFraction = (tuning.delay ?? 0) + window + 0.85 * 1.3 * (tuning.lifeScale ?? 1) * (1 - window)
    scale = Math.max(scale, deathFraction)
  }
  return scale
}
