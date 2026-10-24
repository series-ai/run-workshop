import { getPfxStyleRenderProfile } from '../constants/01'
import { roundMetric } from '../constants/03'
import { clamp } from '../constants/04'
import { getPfxSurfaceColorIndex } from './surfaceColorIndex'
import type { PfxControls } from '../types/01'
import type { PfxRenderSurface, PfxSurfaceMaterialProps, PfxSurfaceTuning } from '../types/02'

const ZERO_MINIMUM_OPACITY_SHADERS: ReadonlySet<NonNullable<PfxSurfaceTuning['meshShader']>> = new Set([
  'teleport-burst-spatial-slices',
  'teleport-burst-arrival-traces',
  'spawn-burst-materialize-weave',
  'spawn-burst-rising-motes',
  'despawn-burst-unmake-slices',
  'despawn-burst-exit-fragments',
  'dash-burst-shear-ribbons',
  'dash-burst-speed-traces',
  'reflect-burst-parry-fan',
  'reflect-burst-return-streaks',
])

export function getPfxSurfaceMaterialProps(
  surface: PfxRenderSurface,
  controls: Pick<PfxControls, 'color' | 'blendMode' | 'style'>,
): PfxSurfaceMaterialProps {
  const styleProfile = getPfxStyleRenderProfile(controls.style)
  const colorIndex = getPfxSurfaceColorIndex(surface)
  const shader = surface.tuning?.meshShader
  const minimumOpacity = shader && ZERO_MINIMUM_OPACITY_SHADERS.has(shader) ? 0 : 0.05
  return {
    opacity: clamp(roundMetric(surface.opacity * styleProfile.opacityMultiplier), minimumOpacity, 1),
    color: surface.tuning?.colorOverride ?? controls.color[colorIndex] ?? controls.color[0] ?? '#ffffff',
    blending: surface.tuning?.blend ?? controls.blendMode,
    particleSizeMultiplier: styleProfile.particleSizeMultiplier,
    edgeHardness: styleProfile.edgeHardness,
  }
}
