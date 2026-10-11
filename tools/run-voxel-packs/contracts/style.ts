/**
 * Art direction limits for world assets (triangle budgets, diagonal share,
 * dark area, saturation, texel density). Source: `data/style.json`.
 */
import { z } from 'zod'
import styleJson from './data/style.json'
import { RVX_PACK_KEYS } from './packs'
import { SCALE_CLASS_NAMES } from './scale'

const range = z.tuple([z.number().nonnegative(), z.number().positive()])
const fileSchema = z.object({
  version: z.literal(1),
  about: z.string(),
  unitsPerTexel: range,
  darkShareMax: z.number().min(0).max(1),
  saturationFloor: z.record(z.enum(RVX_PACK_KEYS), z.number().min(0).max(1)),
  pack: z.object({ medianSaturation: z.record(z.enum(RVX_PACK_KEYS), z.number().min(0).max(1)), meanDarkMax: z.number().min(0).max(1) }).strict(),
  budgets: z.record(z.string(), z.object({ triangles: range, diagonalMin: z.number().min(0).max(1) }).strict()),
})

const parsed = fileSchema.parse(styleJson)
for (const name of SCALE_CLASS_NAMES) if (!parsed.budgets[name]) throw new Error(`style.json has no budget for scale class "${name}"`)
for (const name of Object.keys(parsed.budgets)) if (!SCALE_CLASS_NAMES.includes(name)) throw new Error(`style.json budgets an unknown scale class "${name}"`)
for (const pack of RVX_PACK_KEYS) {
  if (parsed.saturationFloor[pack] === undefined) throw new Error(`style.json has no saturation floor for ${pack}`)
  if (parsed.pack.medianSaturation[pack] === undefined) throw new Error(`style.json has no pack median saturation for ${pack}`)
}

export const STYLE = parsed as Readonly<typeof parsed>
