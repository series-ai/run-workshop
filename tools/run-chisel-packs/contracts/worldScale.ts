import { z } from 'zod'
import humanScale from './data/human-scale.json'

export const HUMAN_SCALE = z.strictObject({
  heightMultiplier: z.number().positive(),
  referenceHeightM: z.number().positive(),
  referencePreset: z.string().min(1),
  referenceParts: z.tuple([z.string().min(1), z.string().min(1)]),
  referenceClip: z.string().min(1),
  referencePhase: z.number().min(0).max(1),
}).parse(humanScale)

type DimensionsMetres = readonly [width: number, height: number, depth: number]

interface PropEnvelope {
  min: DimensionsMetres
  max: DimensionsMetres
}

// The envelopes allow compact vehicle designs and retain room for an adult.
export const VEHICLE_ENVELOPES: Readonly<Partial<Record<string, PropEnvelope>>> = {
  prop_military_jeep: { min: [1.45, 1.18, 2.9], max: [1.95, 2.1, 4.1] },
  prop_supply_truck: { min: [1.9, 2.1, 4.4], max: [2.45, 3.25, 6.35] },
  prop_post_van: { min: [1.55, 1.85, 3.5], max: [2, 2.65, 4.9] },
  prop_goods_trailer: { min: [1.6, 0.85, 2.65], max: [2.45, 2, 4.5] },
  prop_armored_tank: { min: [2.25, 1.95, 4.2], max: [3.4, 3.15, 6.8] },
  prop_city_sedan: { min: [1.55, 1.3, 3.3], max: [2.1, 1.9, 4.85] },
  prop_city_taxi: { min: [1.55, 1.4, 3.3], max: [2.1, 2.1, 4.85] },
  prop_delivery_van: { min: [1.6, 1.75, 3.3], max: [2.2, 2.7, 5.1] },
  prop_city_bus: { min: [1.9, 2.3, 4.8], max: [2.55, 3.35, 7.5] },
  prop_hover_car: { min: [1.55, 1.23, 3.2], max: [2.3, 1.9, 5.2] },
  prop_cargo_loader: { min: [1.3, 1.75, 2.1], max: [2, 2.9, 3.5] },
  prop_cyber_bike: { min: [0.58, 0.75, 1.65], max: [1.05, 1.45, 2.65] },
}
