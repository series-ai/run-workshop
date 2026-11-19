import { z } from 'zod'
import budgetsJson from './data/budgets.json'

const classBudgetSchema = z.object({
  maxTriangles: z.number().int().positive(),
  maxMaterials: z.number().int().positive(),
  maxWeightError: z.number().positive().optional(),
  maxBytes: z.number().int().positive().optional(),
})

const budgetsSchema = z.object({
  version: z.literal(1),
  targetDevice: z.string().min(1),
  mobilePolicy: z.object({
    maxDpr: z.number().positive(),
    shadowMaps: z.boolean(),
    blobShadow: z.boolean(),
    postProcessing: z.boolean(),
    maxSimultaneousAvatars: z.number().int().positive(),
    maxDrawCallsPerAvatar: z.number().int().positive(),
    maxTrianglesPerComposedAvatar: z.number().int().positive(),
  }),
  classes: z.object({
    body: classBudgetSchema,
    head: classBudgetSchema,
    hair: classBudgetSchema,
    torso: classBudgetSchema,
    legs: classBudgetSchema,
    headwear: classBudgetSchema,
    back: classBudgetSchema,
    held: classBudgetSchema,
    prop: classBudgetSchema,
  }),
})

export const BUDGETS = budgetsSchema.parse(budgetsJson)
export type BudgetClass = keyof typeof BUDGETS.classes
