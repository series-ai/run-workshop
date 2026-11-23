import { z } from 'zod'
import { CONTEXT_PACK_KEYS } from './packs'

const point = z.tuple([z.number(), z.number(), z.number()])
const placement = z.strictObject({
  id: z.string().regex(/^prop_[a-z0-9_]+$/),
  position: point,
  rotationY: z.number().optional(),
  hideWithRoof: z.literal(true).optional(),
})

const constructionLayoutSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  title: z.string().trim().min(1),
  width: z.number().positive(),
  depth: z.number().positive(),
  props: z.array(placement).min(1),
  route: z.array(point).min(2),
  view: point.refine(([x, y, z]) => y > 0 && (x !== 0 || z !== 0), 'Use an oblique camera direction above the layout'),
})
export type ConstructionLayout = z.infer<typeof constructionLayoutSchema>

export const constructionKitSchema = z.strictObject({
  pack: z.enum(CONTEXT_PACK_KEYS),
  layouts: z.tuple([constructionLayoutSchema, constructionLayoutSchema]).superRefine(([first, second], ctx) => {
    if (first.id === second.id) {
      ctx.addIssue({ code: 'custom', path: [1, 'id'], message: `Duplicate layout ID "${first.id}"` })
    }
  }),
})
