/**
 * The shared RUN voxel palette: 32 named ramps × 8 shades. A palette index is
 * `ramp * 8 + shade`; index 0 marks an empty voxel. Every GLB embeds this
 * palette as a 256×1 PNG. Source: `data/palette.json`.
 */
import { z } from 'zod'
import paletteJson from './data/palette.json'

export const PALETTE_SIZE = 256
export const RAMP_SHADES = 8

const schema = z.object({
  version: z.literal(1),
  ramps: z.record(z.string(), z.number().int().min(0).max(31)),
  colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/)).length(PALETTE_SIZE),
})

const parsed = schema.parse(paletteJson)

export const PALETTE_COLORS: readonly string[] = parsed.colors
export const PALETTE_RAMPS: Readonly<Record<string, number>> = parsed.ramps

/** `paletteIndex('wood', 3)` → 19. Throws on an unknown ramp or shade. */
export function paletteIndex(ramp: string, shade: number): number {
  const r = parsed.ramps[ramp]
  if (r === undefined) throw new Error(`unknown palette ramp "${ramp}"`)
  if (!Number.isInteger(shade) || shade < 0 || shade >= RAMP_SHADES) {
    throw new Error(`palette shade ${shade} is outside 0..${RAMP_SHADES - 1}`)
  }
  const index = r * RAMP_SHADES + shade
  if (index === 0) throw new Error('palette index 0 is reserved for empty voxels')
  return index
}

/** RGB bytes for one palette index. */
export function paletteRgb(index: number): [number, number, number] {
  const hex = parsed.colors[index]
  if (!hex) throw new Error(`palette index ${index} is outside 0..255`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}
