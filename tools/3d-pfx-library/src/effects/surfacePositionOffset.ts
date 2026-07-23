import type { PfxRenderSurface } from '../types/02'

export function getPfxSurfacePositionOffset(
  surface: Pick<PfxRenderSurface, 'role' | 'phase'>,
): [number, number, number] {
  // Screen-space semantics win over phase-language heuristics: a UI warning
  // ring is a camera-facing halo, not a ground reticle merely because its
  // authored phase includes "warning-ring".
  if (surface.role === 'screen') return [0, 0, 0]
  const phase = surface.phase?.toLowerCase() ?? ''
  const isGroundInformation = /(ground|pool|heel|footstep|foot-ring|warning-ring|warning-fill|pressure-warning|radius-warning|charge-convergence|spawn-circle|pad-ring|pickup-ring)/.test(phase)
  if (isGroundInformation) return [0, -0.88, 0]
  // Column apex reads (geyser crowns, beam tips) anchor at the column top
  // (column mesh spans to ~+1.3 local; the crown sits where the taper ends).
  if (/column-crown/.test(phase)) return [0, 1.18, 0]
  return [0, 0, 0]
}
