import { Domino, PipValue } from './types'

// Pip positions on a 3x3 grid, normalized to [-1, 1] per axis.
type PipPos = readonly [number, number]
const TL: PipPos = [-1, -1]
const TR: PipPos = [1, -1]
const ML: PipPos = [-1, 0]
const C: PipPos = [0, 0]
const MR: PipPos = [1, 0]
const BL: PipPos = [-1, 1]
const BR: PipPos = [1, 1]

// Classic layouts for values 0–6 (spike-verified in scratch/tile-spike).
export const PIP_LAYOUTS: readonly (readonly PipPos[])[] = [
  [],
  [C],
  [TL, BR],
  [TL, C, BR],
  [TL, TR, BL, BR],
  [TL, TR, C, BL, BR],
  [TL, ML, BL, TR, MR, BR],
]

export function doubleSixSet(): Domino[] {
  // Ascending: 0|0 first, 6|6 last — reads naturally in the demo grid.
  const set: Domino[] = []
  for (let left = 0; left <= 6; left++) {
    for (let right = 0; right <= left; right++) {
      set.push({ left: left as PipValue, right: right as PipValue })
    }
  }
  return set
}
