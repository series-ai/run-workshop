/**
 * Model categories: which scale space each one uses, its size budget in
 * voxels, and which leaf it ships in. Source: `data/categories.json`.
 */
import { z } from 'zod'
import categoriesJson from './data/categories.json'

export const CATEGORIES = [
  'props',
  'animated-props',
  'buildings',
  'terrain-nature',
  'creatures',
  'vehicles',
  'held-items',
  'characters-skins',
  'avatar',
] as const
export type Category = (typeof CATEGORIES)[number]

export type ScaleSpace = 'world' | 'avatar'

const categorySchema = z.object({
  space: z.enum(['world', 'avatar']),
  leaf: z.enum(['world', 'characters']),
  largest: z.tuple([z.number().positive(), z.number().positive()]),
  origin: z.enum(['base', 'grip', 'feet', 'rig']),
})
export type CategorySpec = z.infer<typeof categorySchema>

const fileSchema = z.object({
  version: z.literal(1),
  unitsPerVoxel: z.object({ world: z.number().positive(), avatar: z.number().positive() }),
  categories: z.record(z.enum(CATEGORIES), categorySchema),
})

const parsed = fileSchema.parse(categoriesJson)
for (const category of CATEGORIES) {
  if (!parsed.categories[category]) throw new Error(`categories.json is missing "${category}"`)
}

export const UNITS_PER_VOXEL: Readonly<Record<ScaleSpace, number>> = parsed.unitsPerVoxel
export const CATEGORY_SPECS = parsed.categories as Readonly<Record<Category, CategorySpec>>

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}

/** Largest-dimension budget in scene units (voxels × units per voxel). */
export function largestBudgetUnits(category: Category): [number, number] {
  const spec = CATEGORY_SPECS[category]
  const unit = UNITS_PER_VOXEL[spec.space]
  return [spec.largest[0] * unit, spec.largest[1] * unit]
}
