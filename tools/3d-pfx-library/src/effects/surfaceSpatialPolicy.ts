import type { PfxRenderSurface, PfxSurfaceSpatialPolicy } from '../types/02'

export function getPfxSurfaceSpatialPolicy(
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'tuning'>,
): PfxSurfaceSpatialPolicy {
  const cameraFacing = surface.role === 'screen' || surface.kind === 'screen-plane'
  const isTrail = surface.kind === 'trail-ribbon'
  const isImpactShardVolume = surface.kind === 'impact-shards' || surface.kind === 'shield-fragments' || surface.kind === 'coin-reward-burst'
  const isVortex = surface.tuning?.meshShader === 'vortex-swirl'
  const isArc = surface.tuning?.meshShader === 'arc-sweep'
  return {
    cameraFacing,
    minimumDepth: isVortex ? 0.45 : isTrail || isArc || isImpactShardVolume ? 0.32 : 0.08,
    crossedVolume: isTrail || isArc || isVortex || isImpactShardVolume,
  }
}
