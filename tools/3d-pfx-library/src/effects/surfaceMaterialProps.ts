import { getPfxStyleRenderProfile } from '../constants/01'
import { roundMetric } from '../constants/03'
import { clamp } from '../constants/04'
import { getPfxSurfaceColorIndex } from './surfaceColorIndex'
import type { PfxControls } from '../types/01'
import type { PfxRenderSurface, PfxSurfaceMaterialProps } from '../types/02'

export function getPfxSurfaceMaterialProps(
  surface: PfxRenderSurface,
  controls: Pick<PfxControls, 'color' | 'blendMode' | 'style'>,
): PfxSurfaceMaterialProps {
  const styleProfile = getPfxStyleRenderProfile(controls.style)
  const colorIndex = getPfxSurfaceColorIndex(surface)
  return {
    opacity: clamp(roundMetric(surface.opacity * styleProfile.opacityMultiplier), 0.05, 1),
    color: surface.tuning?.colorOverride ?? controls.color[colorIndex] ?? controls.color[0] ?? '#ffffff',
    blending: surface.tuning?.blend ?? controls.blendMode,
    particleSizeMultiplier: styleProfile.particleSizeMultiplier,
    edgeHardness: styleProfile.edgeHardness,
  }
}
