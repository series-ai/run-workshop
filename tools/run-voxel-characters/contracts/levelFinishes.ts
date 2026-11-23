import { z } from 'zod'
import { PALETTE_REGIONS } from './palette'
import finishData from './data/level-finishes.json'

const unitValue = z.number().min(0).max(1)
const finish = z.tuple([unitValue, unitValue])
const grainSide = 16
const flatFaceTexel = 9

export const levelFinishesSchema = z.object({
  regions: z.record(z.enum(PALETTE_REGIONS), finish),
  water: finish,
  glass: finish,
  glassOpacity: unitValue,
  emissiveStrength: z.number().positive(),
  grain: z.array(z.array(z.number().int().min(0).max(255)).length(grainSide)).length(grainSide),
}).strict().refine(({ grain }) => grain[flatFaceTexel]?.[flatFaceTexel] === 255, {
  path: ['grain', flatFaceTexel, flatFaceTexel],
  message: 'The flat-face grain texel must be white.',
})

export const LEVEL_FINISHES = levelFinishesSchema.parse(finishData)
