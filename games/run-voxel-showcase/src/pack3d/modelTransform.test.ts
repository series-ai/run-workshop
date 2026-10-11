import { describe, expect, it } from 'vitest'
import { modelTransform, type ModelBounds } from './modelTransform'

/** A 10x4x10 box whose base sits 2 units below the origin. */
const BOX: ModelBounds = { min: [-5, -2, -5], max: [5, 2, 5], size: [10, 4, 10] }
/** A tall thin model, to prove `fit` uses the largest dimension. */
const MAST: ModelBounds = { min: [0, 0, 0], max: [1, 50, 1], size: [1, 50, 1] }

describe('modelTransform', () => {
  it('scales so the largest dimension matches `fit`', () => {
    expect(modelTransform(BOX, { fit: 2 }).scale).toBeCloseTo(0.2)
    expect(modelTransform(MAST, { fit: 2 }).scale).toBeCloseTo(0.04)
  })

  it('defaults to scale 1 when no fit is given', () => {
    expect(modelTransform(BOX, {}).scale).toBe(1)
  })

  it('grounds the scaled base at y=0 with the base anchor', () => {
    const { scale, position } = modelTransform(BOX, { fit: 2, anchor: 'base' })
    expect(position[1]).toBeCloseTo(-(-2 * scale)) // lifts the -2 base up to 0
    expect(position[1]).toBeCloseTo(0.4)
    expect(position[0]).toBeCloseTo(0)
    expect(position[2]).toBeCloseTo(0)
  })

  it('puts the bounds centre at the origin with the center anchor', () => {
    const { position } = modelTransform(BOX, { fit: 2, anchor: 'center' })
    expect(position).toEqual([0, 0, 0]) // BOX is already centred on x/z and y
  })

  it('leaves native coordinates alone with the native anchor', () => {
    expect(modelTransform(BOX, { anchor: 'native' })).toEqual({ scale: 1, position: [0, 0, 0] })
  })

  it('offsets by `at` on top of the anchor', () => {
    const { position } = modelTransform(BOX, { fit: 2, anchor: 'base', at: [3, 0, -1] })
    expect(position[0]).toBeCloseTo(3)
    expect(position[1]).toBeCloseTo(0.4)
    expect(position[2]).toBeCloseTo(-1)
  })

  it('throws on degenerate bounds rather than returning Infinity', () => {
    const empty: ModelBounds = { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] }
    expect(() => modelTransform(empty, { fit: 1 })).toThrow(/zero-size bounds/)
  })
})
