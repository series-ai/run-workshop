import { RAMP_TRIM, VEHICLE_RAMP } from '../sim/setPieces';
import type { PaletteKey } from './style/artStyle';

export interface BoxPart {
  readonly name: string;
  /** Center in the ramp frame (meters). */
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly color: PaletteKey;
}

/** The visible ramp. Deck and curbs match their colliders in sim/setPieces.ts. */
export const RAMP_PARTS: readonly BoxPart[] = [
  { name: 'deck', center: [0, 0, 0], size: VEHICLE_RAMP.size, color: 'signalOrange' },
  { name: 'stripe', ...RAMP_TRIM.stripe, color: 'concreteLit' },
  ...RAMP_TRIM.curbs.map((curb, index) => ({ name: index === 0 ? 'curb-left' : 'curb-right', ...curb, color: 'mustard' as const })),
];
