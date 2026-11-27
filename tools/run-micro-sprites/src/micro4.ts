/**
 * Ultra-micro 4x4 pixel-art infantry sprites (16 native pixels per unit!) for
 * WorldBox / Supreme-Commander scale 600-1,200 unit mega-swarms on one mobile screen.
 */

import { buildFactionPalette, INK_OUTLINE, type FactionId, type TeamColorId } from './palette.ts';
import { addPixelOutline, compilePattern, mirrorHorizontal, type PixelSurface } from './pixel.ts';

export interface Micro4Spec {
  readonly faction: FactionId;
  readonly name: string;
  readonly role: string;
  readonly frames: readonly (readonly [string, string, string, string])[]; // [move0, move1, attack]
}

const MICRO4_SPECS: Readonly<Record<FactionId, Micro4Spec>> = {
  vanguard: {
    faction: 'vanguard',
    name: 'Vanguard 4×4',
    role: '16px Rifleman',
    frames: [
      ['.wv.', 'bBBk', '.BB.', 'd..d'],
      ['.wv.', 'bBBk', '.BB.', '.dd.'],
      ['.wvf', 'bBBF', '.BB.', 'd..d'],
    ],
  },
  kraxen: {
    faction: 'kraxen',
    name: 'Kraxen 4×4',
    role: '16px Broodling',
    frames: [
      ['.pp.', 'pmgo', '.mu.', 'r..r'],
      ['....', '.pp.', 'pmgo', 'r.r.'],
      ['.ppg', 'pmGo', '.mu.', 'r..r'],
    ],
  },
  solaris: {
    faction: 'solaris',
    name: 'Solaris 4×4',
    role: '16px Zealot',
    frames: [
      ['.yg.', 'gTgC', '.gtC', 'b..b'],
      ['.yg.', 'gTgC', '.gtC', '.bb.'],
      ['.ygC', 'gTGC'.replace('G', 'g'), '.gtc', 'b..b'],
    ],
  },
};

export const MICRO4_FACTIONS: readonly FactionId[] = ['vanguard', 'kraxen', 'solaris'];

export function getMicro4Spec(faction: FactionId): Micro4Spec {
  return MICRO4_SPECS[faction];
}

export function compileMicro4Frame(
  faction: FactionId,
  frameIdx: number,
  flipped: boolean,
  team: TeamColorId = 'default',
): { raw: PixelSurface; outlined: PixelSurface } {
  const spec = MICRO4_SPECS[faction];
  const pal = buildFactionPalette(faction, team);
  const compiled = compilePattern(spec.frames[frameIdx % spec.frames.length], pal, 4, 4);
  const raw = flipped ? mirrorHorizontal(compiled) : compiled;
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  return { raw, outlined };
}
