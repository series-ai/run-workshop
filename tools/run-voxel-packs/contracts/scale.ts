/**
 * World scale standard: every world asset declares a scale class, and its
 * bounds (in voxels) must fit that class. Source: `data/scale.json`.
 */
import { z } from 'zod'
import scaleJson from './data/scale.json'
import { CATEGORIES, CATEGORY_SPECS, type Category } from './categories'

const range = z.tuple([z.number().nonnegative(), z.number().positive()])
const classSchema = z
  .object({ largest: range.optional(), height: range.optional(), length: range.optional(), width: range.optional(), tileLength: z.boolean().optional(), use: z.string() })
  .strict()

const fileSchema = z.object({
  version: z.literal(1),
  about: z.string(),
  tileVoxels: z.number().int().positive(),
  personVoxels: z.number().int().positive(),
  grammar: z.record(z.string(), range),
  categoryClasses: z.record(z.enum(CATEGORIES), z.array(z.string()).nonempty()),
  classes: z.record(z.string(), classSchema),
})

const parsed = fileSchema.parse(scaleJson)
for (const [category, names] of Object.entries(parsed.categoryClasses)) {
  for (const name of names) if (!Object.hasOwn(parsed.classes, name)) throw new Error(`scale.json: ${category} lists unknown class "${name}"`)
}
for (const category of CATEGORIES) {
  const world = CATEGORY_SPECS[category].space === 'world'
  if (world !== Object.hasOwn(parsed.categoryClasses, category)) throw new Error(`scale.json: categoryClasses must list exactly the world categories (${category})`)
}

export const TILE_VOXELS = parsed.tileVoxels
export const PERSON_VOXELS = parsed.personVoxels
export const SCALE_GRAMMAR = parsed.grammar
export type ScaleClassSpec = z.infer<typeof classSchema>
export const SCALE_CLASSES: Readonly<Record<string, ScaleClassSpec>> = parsed.classes
export const SCALE_CLASS_NAMES = Object.keys(parsed.classes)

/** Scale classes a world category may use; empty for avatar-space categories. */
export function scaleClassesFor(category: Category): readonly string[] {
  return parsed.categoryClasses[category] ?? []
}

export function isScaleClass(value: string): boolean {
  return Object.hasOwn(SCALE_CLASSES, value)
}

export type ScaleMeasure = 'largest' | 'height' | 'length' | 'width'

/** The measures of a size in voxels [x, y, z]. */
export function scaleMeasures(size: readonly [number, number, number]): Record<ScaleMeasure, number> {
  const [x, y, z] = size
  return { largest: Math.max(x, y, z), height: y, length: Math.max(x, z), width: Math.min(x, z) }
}

/** Human-readable failures of `size` (voxels) against class `name`; empty when it fits. */
export function checkScaleClass(name: string, size: readonly [number, number, number]): string[] {
  const spec = SCALE_CLASSES[name]
  if (!spec) throw new Error(`unknown scale class "${name}" (known: ${SCALE_CLASS_NAMES.join(', ')})`)
  const measures = scaleMeasures(size)
  const out: string[] = []
  for (const key of ['largest', 'height', 'length', 'width'] as const) {
    const bounds = spec[key]
    if (!bounds) continue
    const value = measures[key]
    // Half a voxel of slack: centred bounds can end on half-voxel phases.
    if (value < bounds[0] - 0.5 || value > bounds[1] + 0.5) out.push(`${key} ${value.toFixed(1)} is outside ${name} ${bounds[0]}–${bounds[1]}`)
  }
  if (spec.tileLength) {
    const tiles = measures.length / TILE_VOXELS
    if (Math.abs(tiles - Math.round(tiles)) * TILE_VOXELS > 1) out.push(`length ${measures.length.toFixed(1)} is not a whole number of ${TILE_VOXELS}-voxel tiles`)
  }
  return out
}
