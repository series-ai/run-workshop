import { BoxFaceName } from '../three/BoxPiece'

// Face values on a standard die.
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6

// Spike-verified assignment: every opposite pair sums to 7.
export const DIE_FACES: Record<BoxFaceName, DieValue> = {
  pz: 1,
  nz: 6,
  px: 2,
  nx: 5,
  py: 3,
  ny: 4,
}

type PipPos = readonly [number, number]
const TL: PipPos = [-1, -1]
const TR: PipPos = [1, -1]
const ML: PipPos = [-1, 0]
const C: PipPos = [0, 0]
const MR: PipPos = [1, 0]
const BL: PipPos = [-1, 1]
const BR: PipPos = [1, 1]

export const DIE_PIP_LAYOUTS: Record<number, readonly PipPos[]> = {
  1: [C],
  2: [TL, BR],
  3: [TL, C, BR],
  4: [TL, TR, BL, BR],
  5: [TL, TR, C, BL, BR],
  6: [TL, ML, BL, TR, MR, BR],
}
