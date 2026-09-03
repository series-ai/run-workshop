import { describe, expect, it } from 'vitest'
import { DIE_FACES, DIE_PIP_LAYOUTS } from './pipFaces'

describe('DIE_FACES', () => {
  it('assigns values so opposite faces sum to 7', () => {
    expect(DIE_FACES.pz + DIE_FACES.nz).toBe(7)
    expect(DIE_FACES.px + DIE_FACES.nx).toBe(7)
    expect(DIE_FACES.py + DIE_FACES.ny).toBe(7)
  })

  it('uses each value 1-6 exactly once', () => {
    expect(Object.values(DIE_FACES).sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('DIE_PIP_LAYOUTS', () => {
  it('has exactly N pips for value N', () => {
    for (let v = 1; v <= 6; v++) {
      expect(DIE_PIP_LAYOUTS[v]).toHaveLength(v)
    }
  })
})
