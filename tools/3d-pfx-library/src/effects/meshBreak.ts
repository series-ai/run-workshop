import * as THREE from 'three'
import type { PfxRenderSurface } from '../types/02'

export function getPfxMeshBreakProgress(
  surface: Pick<PfxRenderSurface, 'tuning'>,
  cycle: number,
): number {
  const delay = THREE.MathUtils.clamp(surface.tuning?.delay ?? 0.12, 0, 0.8)
  const window = THREE.MathUtils.clamp(surface.tuning?.window ?? 0.45, 0.08, 0.9)
  return Math.min(1, Math.max(0, (cycle - delay) / window))
}
