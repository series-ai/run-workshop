import type { PfxRenderSurface } from '../types/02'

export function getPfxRingPlaneRotation(
  surface: Pick<PfxRenderSurface, 'role'>,
): [number, number, number] {
  return surface.role === 'screen' ? [0, 0, 0] : [-Math.PI / 2, 0, 0]
}
