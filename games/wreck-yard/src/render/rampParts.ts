import { SHELL_BOXES } from '../sim/constants';
import type { PaletteKey } from './style/artStyle';

export interface BoxPart {
  readonly name: string;
  /** Center in the ramp frame (meters). */
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly color: PaletteKey;
}

const collider = SHELL_BOXES.find((box) => box.id === 'vehicle-ramp');
if (!collider) throw new Error('WRECK_YARD_RAMP_COLLIDER_MISSING');
export const RAMP_COLLIDER = collider;

const [deckX, deckY, deckZ] = collider.size;

/** The visible ramp. The deck matches the collider exactly. */
export const RAMP_PARTS: readonly BoxPart[] = [
  { name: 'deck', center: [0, 0, 0], size: [deckX, deckY, deckZ], color: 'signalOrange' },
  { name: 'stripe', center: [0, deckY / 2 + 0.01, 0], size: [1.2, 0.02, deckZ - 0.1], color: 'concreteLit' },
  // Curbs sit inset from the deck edges. Flush faces z-fight orange against yellow.
  { name: 'curb-left', center: [-(deckX / 2 - 0.13), 0.14, 0], size: [0.2, 0.22, deckZ - 0.06], color: 'mustard' },
  { name: 'curb-right', center: [deckX / 2 - 0.13, 0.14, 0], size: [0.2, 0.22, deckZ - 0.06], color: 'mustard' },
];
