import { modelTransform, type ModelBounds, type ModelPlacement } from './modelTransform'

export interface LayoutItem {
  id: string
  bounds: ModelBounds
}

export interface LayoutRowOptions {
  /** Largest dimension every model is normalised to, in world units. */
  fit: number
  /** Clear space between neighbouring bounding boxes, in world units. */
  gap: number
}

export interface LayoutPlacement extends ModelPlacement {
  id: string
}

/**
 * Places models left to right on the ground plane, centred on the origin.
 *
 * Every model is normalised to `fit` first, so a buoy and a kraken occupy
 * comparable space; spacing then uses each model's own scaled width, so a wide
 * flat island still clears its neighbour.
 */
export function layoutRow(items: LayoutItem[], options: LayoutRowOptions): LayoutPlacement[] {
  const { fit, gap } = options
  if (items.length === 0) return []

  const widths = items.map((item) => {
    const { scale } = modelTransform(item.bounds, { fit })
    return { item, scale, width: item.bounds.size[0] * scale }
  })

  const total = widths.reduce((sum, entry) => sum + entry.width, 0) + gap * (items.length - 1)

  let cursor = -total / 2
  return widths.map(({ item, width }) => {
    const centreX = cursor + width / 2
    cursor += width + gap
    const placement = modelTransform(item.bounds, {
      fit,
      anchor: 'base',
      at: [centreX, 0, 0],
    })
    return { id: item.id, ...placement }
  })
}
