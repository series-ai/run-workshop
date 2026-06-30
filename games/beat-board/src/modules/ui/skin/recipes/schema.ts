import { z } from 'zod'

export const semanticRecipeStrategySchema = z.enum(['css-only', 'border-image', 'layered-artboard', 'hybrid'])

export const semanticComponentRecipeStateSchema = z.object({
  state: z.string().min(1),
  sourceAssetPaths: z.array(z.string().min(1)).default([]),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  notes: z.array(z.string().min(1)).default([]),
})

export const semanticComponentRecipeSchema = z.object({
  componentName: z.string().min(1),
  rendererVariantId: z.string().min(1),
  rendererFamily: z.enum(['html', 'graphical']),
  strategy: semanticRecipeStrategySchema,
  anatomyId: z.string().min(1),
  cssModulePath: z.string().min(1),
  states: z.array(semanticComponentRecipeStateSchema).min(1),
})

export const semanticRecipeRegistrySchema = z.object({
  generatedAt: z.string().datetime(),
  recipes: z.array(semanticComponentRecipeSchema),
})

export type SemanticComponentRecipeState = z.infer<typeof semanticComponentRecipeStateSchema>
export type SemanticComponentRecipe = z.infer<typeof semanticComponentRecipeSchema>
export type SemanticRecipeRegistry = z.infer<typeof semanticRecipeRegistrySchema>
