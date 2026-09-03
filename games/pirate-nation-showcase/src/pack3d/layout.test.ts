import { describe, expect, it } from 'vitest'
import { layoutRow } from './layout'
import type { ModelBounds } from './modelTransform'

const box = (w: number, h: number, d: number): ModelBounds => ({
  min: [-w / 2, 0, -d / 2],
  max: [w / 2, h, d / 2],
  size: [w, h, d],
})

/** Deliberately mixed scales: a buoy next to a kraken is the real case. */
const ITEMS = [
  { id: 'small', bounds: box(2, 2, 2) },
  { id: 'huge', bounds: box(200, 180, 90) },
  { id: 'flat', bounds: box(60, 1, 60) },
]

describe('layoutRow', () => {
  it('returns one placement per item, in order', () => {
    const row = layoutRow(ITEMS, { fit: 4, gap: 1 })
    expect(row.map((entry) => entry.id)).toEqual(['small', 'huge', 'flat'])
  })

  it('grounds every item on y=0', () => {
    for (const entry of layoutRow(ITEMS, { fit: 4, gap: 1 })) {
      const scaledBase = ITEMS.find((i) => i.id === entry.id)!.bounds.min[1] * entry.scale
      expect(entry.position[1] + scaledBase).toBeCloseTo(0)
    }
  })

  it('never overlaps neighbours on x and honours the gap', () => {
    const gap = 1.5
    const row = layoutRow(ITEMS, { fit: 4, gap })
    for (let i = 1; i < row.length; i += 1) {
      const prev = row[i - 1]!
      const next = row[i]!
      const prevBounds = ITEMS.find((x) => x.id === prev.id)!.bounds
      const nextBounds = ITEMS.find((x) => x.id === next.id)!.bounds
      const prevRight = prev.position[0] + (prevBounds.size[0] * prev.scale) / 2
      const nextLeft = next.position[0] - (nextBounds.size[0] * next.scale) / 2
      expect(nextLeft - prevRight).toBeCloseTo(gap)
    }
  })

  it('centres the whole row on the origin', () => {
    const row = layoutRow(ITEMS, { fit: 4, gap: 1 })
    const first = row[0]!
    const last = row[row.length - 1]!
    const leftEdge = first.position[0] - (ITEMS[0]!.bounds.size[0] * first.scale) / 2
    const rightEdge = last.position[0] + (ITEMS[2]!.bounds.size[0] * last.scale) / 2
    expect(leftEdge + rightEdge).toBeCloseTo(0)
  })

  it('returns an empty row for no items', () => {
    expect(layoutRow([], { fit: 4, gap: 1 })).toEqual([])
  })
})
