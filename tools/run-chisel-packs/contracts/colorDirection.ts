import { z } from 'zod'
import data from './data/color-direction.json'
import { CONTEXT_PACK_KEYS, type PolyPackKey } from './packs'
import { PALETTE_REGIONS, type PaletteColors } from './palette'

const swatch = z.string().regex(/^#[0-9a-f]{6}$/i).refine(
  (hex) => !/^#(?:000000|ffffff)$/i.test(hex),
  'Use a tinted dark or light swatch in place of pure black or white.',
)
const regions = z.enum(PALETTE_REGIONS)
const palette = z.record(regions, swatch)
export const authoredPaletteSchema = palette
const palettePatch = z.partialRecord(regions, swatch)

const look = z.strictObject({
  glow: swatch,
  backdrop: swatch,
  accent: swatch,
  ground: z.tuple([swatch, swatch, swatch]),
  key: swatch,
  fill: swatch,
  rim: swatch,
})

const briefText = z.string().trim().min(1)
const direction = z.strictObject({
  brief: z.strictObject({
    relationship: briefText,
    field: briefText,
    support: briefText,
    focus: briefText,
    characters: briefText,
    avoid: briefText,
    review: briefText,
  }),
  avatar: palette,
  props: z.strictObject({
    default: palette,
    overrides: z.record(z.string().regex(/^prop_[a-z0-9_]+$/), palettePatch),
  }),
  stage: z.strictObject({
    look,
    environment: z.strictObject({
      groundPatch: swatch,
      fog: z.tuple([z.number().nonnegative(), z.number().positive()]).refine(([near, far]) => near < far),
      backdropTint: z.number().min(0).max(1),
    }),
    groups: z.strictObject({ floor: palettePatch, structure: palettePatch, life: palettePatch }),
    practicals: z.array(z.strictObject({
      position: z.tuple([z.number(), z.number(), z.number()]),
      color: swatch,
      intensity: z.number().positive(),
      distance: z.number().positive(),
    })),
  }),
})

export const COLOR_DIRECTION = z.strictObject({
  version: z.literal(1),
  shade: z.strictObject({
    uvMin: z.number().min(0).max(1),
    uvMax: z.number().min(0).max(1),
    dark: z.number().positive(),
    bright: z.number().positive(),
  }).refine(({ uvMin, uvMax, dark, bright }) => uvMin < uvMax && dark < bright, 'Shade endpoints must be in ascending order.'),
  overview: look,
  ambientGround: swatch,
  packs: z.record(z.enum(CONTEXT_PACK_KEYS), direction),
}).parse(data)

export function propPaletteFor(pack: PolyPackKey, id: string): PaletteColors {
  const { default: base, overrides } = COLOR_DIRECTION.packs[pack === 'core' ? 'medieval' : pack].props
  return { ...base, ...overrides[id] }
}
