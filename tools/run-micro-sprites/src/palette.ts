/**
 * Curated high-readability micro-pixel-art palettes.
 *
 * Design discipline for 8x8 mass-unit readability:
 *  - Terrain lives in calm, mid-dark desaturated values so hundreds of tiny sprites never get lost.
 *  - Faction sprites use vivid, hue-shifted 3-step ramps + a signature emissive accent:
 *      * Vanguard : Steel white/silver + Cobalt armor + Warm Gold visor + Orange tracer fire
 *      * Kraxen   : Vivid Magenta/Orchid carapace + Deep Plum shadow + Warm Bone claws + Acid Lime venom
 *      * Solaris  : Bright Solar Gold armor + Deep Bronze shadow + Royal Teal cloth + Electric Cyan psi
 *  - Deep cool ink (#130f1e) anchors 1px outlines and ground shadows without harsh pure-black crunch.
 */

import { hexToU32, packRGBA, type RGBA32 } from './pixel.ts';

export type FactionId = 'vanguard' | 'kraxen' | 'solaris';

export type TeamColorId = 'default' | 'crimson' | 'emerald' | 'amber' | 'violet';

export interface TeamRamp {
  readonly hi: RGBA32;
  readonly mid: RGBA32;
  readonly dark: RGBA32;
}

export const INK_OUTLINE: RGBA32 = hexToU32('#130f1e');
export const SHADOW_GROUND: RGBA32 = packRGBA(14, 10, 24, 128);
export const SHADOW_SOFT: RGBA32 = packRGBA(14, 10, 24, 72);

export const TEAM_RAMPS: Readonly<Record<Exclude<TeamColorId, 'default'>, TeamRamp>> = {
  crimson: {
    hi: hexToU32('#ff7875'),
    mid: hexToU32('#d9363e'),
    dark: hexToU32('#751828'),
  },
  emerald: {
    hi: hexToU32('#73e896'),
    mid: hexToU32('#2ba859'),
    dark: hexToU32('#145938'),
  },
  amber: {
    hi: hexToU32('#ffd666'),
    mid: hexToU32('#e08a1e'),
    dark: hexToU32('#7a3e12'),
  },
  violet: {
    hi: hexToU32('#c299ff'),
    mid: hexToU32('#7b4ce0'),
    dark: hexToU32('#3e1e7a'),
  },
};

export function buildFactionPalette(
  faction: FactionId,
  team: TeamColorId = 'default',
): Readonly<Record<string, RGBA32>> {
  const override = team === 'default' ? undefined : TEAM_RAMPS[team];

  if (faction === 'vanguard') {
    const hi = override?.hi ?? hexToU32('#69c2ff');
    const mid = override?.mid ?? hexToU32('#2777db');
    const dark = override?.dark ?? hexToU32('#153d82');
    return {
      // Steel helmet & chassis
      w: hexToU32('#f2f7fc'),
      m: hexToU32('#cddae8'),
      s: hexToU32('#9cb0c9'),
      d: hexToU32('#4e607a'),
      q: hexToU32('#364359'),
      k: hexToU32('#202636'),
      // Team-remappable power armor
      b: hi,
      B: mid,
      D: dark,
      // Warm visor & muzzle accents
      v: hexToU32('#ffd23f'),
      f: hexToU32('#ff8c24'),
      F: hexToU32('#fff7cc'),
      // Smoke / debris
      e: hexToU32('#7c8da6'),
      // Structural ink (buildings / heavy accents)
      K: INK_OUTLINE,
      c: hexToU32('#56e0ff'),
    };
  }

  if (faction === 'kraxen') {
    const hi = override?.hi ?? hexToU32('#ff70c8');
    const mid = override?.mid ?? hexToU32('#c72b8b');
    const dark = override?.dark ?? hexToU32('#631552');
    return {
      // Team-remappable bio-carapace
      p: hi,
      m: mid,
      u: dark,
      // Warm organic tail/underbelly, bruised meat, sinew & fleshy brood roots
      r: hexToU32('#47192d'),
      R: hexToU32('#7a2b42'),
      x: hexToU32('#2b0d1c'), // deep dark wet cavernous gullet interior
      n: hexToU32('#5c2e24'), // earthy brown chitin root
      t: hexToU32('#8a4b35'), // warm fleshy hide / root highlight
      a: hexToU32('#c96b78'), // wet glistening flesh highlight (organic, non-techy)
      e: hexToU32('#d99b52'), // warm organic ochre egg/mucus glint
      // Bone scythe claws & fangs
      o: hexToU32('#f5e8c6'),
      c: hexToU32('#c9a473'),
      C: hexToU32('#825c42'),
      // Acid-lime bio-glow (used on acid spit/venom units, kept off buildings!)
      l: hexToU32('#3b8f36'),
      g: hexToU32('#9dff3b'),
      G: hexToU32('#ebffb3'),
      // Dark ink
      K: INK_OUTLINE,
    };
  }

  // Solaris
  const hi = override?.hi ?? hexToU32('#4cc9ff');
  const mid = override?.mid ?? hexToU32('#1f6fd1');
  const dark = override?.dark ?? hexToU32('#133b7a');
  return {
    // Iconic golden templar armor
    y: hexToU32('#ffe875'),
    g: hexToU32('#e3a127'),
    b: hexToU32('#8a4e16'),
    w: hexToU32('#fffbe6'),
    // Team-remappable cloth / buckler trim
    T: hi,
    t: mid,
    D: dark,
    // Electric cyan psi-blade & energy core
    c: hexToU32('#2ce8f5'),
    C: hexToU32('#e0ffff'),
    v: hexToU32('#0ea5c6'),
    // Dark bronze/ink
    K: INK_OUTLINE,
  };
}

export const MINERAL_PALETTE: Readonly<Record<string, RGBA32>> = {
  K: INK_OUTLINE,
  r: hexToU32('#364457'),
  R: hexToU32('#52647a'),
  d: hexToU32('#186ba8'),
  b: hexToU32('#34b4f0'),
  c: hexToU32('#8eeeff'),
  w: hexToU32('#f2ffff'),
};

export const PROP_PALETTE: Readonly<Record<string, RGBA32>> = {
  K: INK_OUTLINE,
  d: hexToU32('#223b2c'),
  g: hexToU32('#345939'),
  l: hexToU32('#527d46'),
  h: hexToU32('#78a655'),
  t: hexToU32('#4f372d'),
  s: hexToU32('#595252'),
  S: hexToU32('#807670'),
  H: hexToU32('#a89b8d'),
};
