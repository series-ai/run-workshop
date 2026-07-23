import { parsePfxHexColor } from '../constants/04'
import { getPfxSurfaceColorIndex } from './surfaceColorIndex'
import type { PfxControls } from '../types/01'
import type { PfxParticleColorRamp, PfxRenderSurface } from '../types/02'

export function getPfxParticleColorRamp(
  controls: Pick<PfxControls, 'color'>,
  surface: Pick<PfxRenderSurface, 'role' | 'phase' | 'tuning'>,
): PfxParticleColorRamp {
  const colorIndex = getPfxSurfaceColorIndex(surface)
  // colorOverride governs the RAMP too — without this the sprite stops kept
  // coming from the palette and an override-tinted layer rendered grey
  // (fireball trail: yellow accent darkened toward slate).
  const override = surface.tuning?.colorOverride
  const baseHex = override ?? controls.color[colorIndex] ?? controls.color[0]
  const tailHex = override ?? controls.color[colorIndex + 1] ?? baseHex
  const base = parsePfxHexColor(baseHex)
  const tail = override
    ? ([base[0] * 0.28, base[1] * 0.28, base[2] * 0.32] as [number, number, number])
    : parsePfxHexColor(tailHex)
  const mixToward = (from: [number, number, number], to: [number, number, number], amount: number) =>
    [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount] as [
      number,
      number,
      number,
    ]
  return {
    // Hot stop nearly saturates to white — with additive stacking this is
    // what produces a white-hot focal without a bloom pass.
    hot: mixToward(base, [1, 1, 1], 0.92),
    base,
    tail: mixToward(tail, [0.04, 0.04, 0.08], 0.35),
  }
}
