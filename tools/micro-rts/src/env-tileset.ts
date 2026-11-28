/**
 * Multi-Biome 8x8 Wang-16 Dual-Grid Environment Tileset Pack (4 Planets + Infrastructure).
 *
 * Strictly enforces the micro-RTS terrain craft laws:
 *  - Calm mid-dark low-saturation values so 8x8..24x20 faction sprites pop effortlessly at 1x.
 *  - Edge-exact Wang-16 dual-grid masks (border jitter strictly 0 on x in {0,7}, y in {0,7}).
 *  - Layer-1 alpha-transparent high-ground cliffs, 4-way ramps (S/N/E/W), and steel truss bridges
 *    composited seamlessly over ANY Layer-0 biome!
 *
 * Biomes:
 *  1. temperate — Frontier Grass, Dirt, Water (3f shimmer), Kraxen Creep, Sandstone Plateau Cliff
 *  2. tundra    — Calm Slate-Blue Snow, Dark Permafrost, Frozen Ice Lake, Frost-Granite Cliff
 *  3. volcanic  — Charcoal Ash, Cracked Basalt, Animated Magma Lava (3f), Obsidian Cliff
 *  4. desert    — Warm Ochre Dune, Ancient Flagstone Ruins, Oasis Shallows, Temple Sandstone Cliff
 */

import {
  blendPixel,
  blitScaled,
  createSurface,
  hexToU32,
  packRGBA,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';
import { TILE_PX, wangCoverage } from './tileset.ts';

export type PlanetThemeId = 'temperate' | 'tundra' | 'volcanic' | 'desert';

export const PLANET_THEMES: readonly PlanetThemeId[] = ['temperate', 'tundra', 'volcanic', 'desert'];

export type EnvTileKind = 'primary' | 'secondary' | 'hazard' | 'accent' | 'cliff';

export interface BiomeAtlasBundle {
  readonly theme: PlanetThemeId;
  readonly label: string;
  readonly atlas: PixelSurface; // 128x64 (16x8 of 8x8 tiles)
  readonly hazardAnimFrames: readonly PixelSurface[]; // 3 frames of 32x8 (4 water/lava/ice/oasis variants)
  readonly rampTiles: Readonly<Record<'S' | 'N' | 'E' | 'W', PixelSurface>>; // 24x16 (3x2 tiles) or 16x24
  readonly bridgeH: PixelSurface; // 24x16 (3x2 tiles: left abutment, span, right abutment)
  readonly bridgeV: PixelSurface; // 16x24 (2x3 tiles: top abutment, span, bottom abutment)
}

interface ThemePalette {
  readonly label: string;
  // Primary ground (e.g. grass / snow / ash / dune)
  readonly priDark: RGBA32;
  readonly priBase: RGBA32;
  readonly priMid: RGBA32;
  readonly priHi: RGBA32;
  readonly priLip: RGBA32;
  // Secondary ground (e.g. dirt / permafrost / basalt / ruinFloor)
  readonly secShadow: RGBA32;
  readonly secDark: RGBA32;
  readonly secBase: RGBA32;
  readonly secMid: RGBA32;
  readonly secHi: RGBA32;
  // Hazard / liquid (e.g. water / ice / lava / oasis)
  readonly hazDeep: RGBA32;
  readonly hazMid: RGBA32;
  readonly hazShallow: RGBA32;
  readonly hazFoam: RGBA32;
  readonly hazWet: RGBA32;
  // Accent / creep / road overlay (e.g. creep / packed snow-road / scorch / temple inlay)
  readonly accInk: RGBA32;
  readonly accDark: RGBA32;
  readonly accBase: RGBA32;
  readonly accVein: RGBA32;
  readonly accRim: RGBA32;
  // Elevated plateau + Layer-1 alpha cliff
  readonly platDark: RGBA32;
  readonly platBase: RGBA32;
  readonly platHi: RGBA32;
  readonly cliffTop: RGBA32;
  readonly cliffLit: RGBA32;
  readonly cliffDark: RGBA32;
  readonly cliffInk: RGBA32;
  // Decorative fleck
  readonly fleck: RGBA32;
}

const SHADOW_DEEP = packRGBA(16, 11, 26, 138);
const SHADOW_SOFT = packRGBA(16, 11, 26, 66);

export const THEME_PALETTES: Readonly<Record<PlanetThemeId, ThemePalette>> = {
  temperate: {
    label: 'Temperate Frontier',
    priDark: hexToU32('#253d2b'),
    priBase: hexToU32('#315034'),
    priMid: hexToU32('#3d613b'),
    priHi: hexToU32('#4e7544'),
    priLip: hexToU32('#5f8c4f'),
    secShadow: hexToU32('#423029'),
    secDark: hexToU32('#574134'),
    secBase: hexToU32('#6b523e'),
    secMid: hexToU32('#7c6148'),
    secHi: hexToU32('#917456'),
    hazDeep: hexToU32('#183854'),
    hazMid: hexToU32('#214e6b'),
    hazShallow: hexToU32('#2f6a82'),
    hazFoam: hexToU32('#73bac7'),
    hazWet: hexToU32('#524134'),
    accInk: hexToU32('#1d0c24'),
    accDark: hexToU32('#2e1336'),
    accBase: hexToU32('#401b45'),
    accVein: hexToU32('#592857'),
    accRim: hexToU32('#753b6b'),
    platDark: hexToU32('#66513c'),
    platBase: hexToU32('#876f50'),
    platHi: hexToU32('#a38962'),
    cliffTop: hexToU32('#b59c72'),
    cliffLit: hexToU32('#7a644e'),
    cliffDark: hexToU32('#33252d'),
    cliffInk: hexToU32('#1a1220'),
    fleck: hexToU32('#cfb557'),
  },
  tundra: {
    label: 'Frost-Basalt Tundra',
    // Calm cool slate-blue snow so pale Vanguard steel NEVER vanishes!
    priDark: hexToU32('#52657a'),
    priBase: hexToU32('#637991'),
    priMid: hexToU32('#7289a3'),
    priHi: hexToU32('#859db8'),
    priLip: hexToU32('#99b2cc'),
    // Dark permafrost rock/earth
    secShadow: hexToU32('#232b38'),
    secDark: hexToU32('#313c4d'),
    secBase: hexToU32('#404e61'),
    secMid: hexToU32('#4f6075'),
    secHi: hexToU32('#63758c'),
    // Frozen glacial ice sheet
    hazDeep: hexToU32('#1e445e'),
    hazMid: hexToU32('#2b6080'),
    hazShallow: hexToU32('#4183a3'),
    hazFoam: hexToU32('#9ed6eb'),
    hazWet: hexToU32('#394c61'),
    // Packed iron-tread snow road
    accInk: hexToU32('#222a36'),
    accDark: hexToU32('#364152'),
    accBase: hexToU32('#465366'),
    accVein: hexToU32('#596980'),
    accRim: hexToU32('#70849c'),
    // Frost-granite high ground
    platDark: hexToU32('#495b70'),
    platBase: hexToU32('#5d728a'),
    platHi: hexToU32('#768da6'),
    cliffTop: hexToU32('#8fa8c2'),
    cliffLit: hexToU32('#4f6278'),
    cliffDark: hexToU32('#273242'),
    cliffInk: hexToU32('#151a26'),
    fleck: hexToU32('#b5d4e8'),
  },
  volcanic: {
    label: 'Obsidian Ashlands',
    // Calm charcoal-violet volcanic ash
    priDark: hexToU32('#242029'),
    priBase: hexToU32('#2f2a36'),
    priMid: hexToU32('#3b3442'),
    priHi: hexToU32('#4a4252'),
    priLip: hexToU32('#5c5266'),
    // Cracked dark reddish basalt flats
    secShadow: hexToU32('#21171c'),
    secDark: hexToU32('#362328'),
    secBase: hexToU32('#472e32'),
    secMid: hexToU32('#593b3e'),
    secHi: hexToU32('#6e4b4c'),
    // Glowing molten magma (rich burnt crimson/orange, kept below unit highlights)
    hazDeep: hexToU32('#6e1919'),
    hazMid: hexToU32('#a82e1b'),
    hazShallow: hexToU32('#d95e1e'),
    hazFoam: hexToU32('#f5ab3d'),
    hazWet: hexToU32('#3b1f24'),
    // Cooled sulfur-veined obsidian crust
    accInk: hexToU32('#17131c'),
    accDark: hexToU32('#26202e'),
    accBase: hexToU32('#362d40'),
    accVein: hexToU32('#69392a'),
    accRim: hexToU32('#8a4b2e'),
    // Jagged dark basalt plateau
    platDark: hexToU32('#3a3340'),
    platBase: hexToU32('#4d4454'),
    platHi: hexToU32('#63586b'),
    cliffTop: hexToU32('#786b80'),
    cliffLit: hexToU32('#453a4a'),
    cliffDark: hexToU32('#241c29'),
    cliffInk: hexToU32('#130f1e'),
    fleck: hexToU32('#d96e2b'),
  },
  desert: {
    label: 'Solaris Sun-Dunes',
    // Warm muted ochre desert sand
    priDark: hexToU32('#5e4832'),
    priBase: hexToU32('#735a3f'),
    priMid: hexToU32('#85694a'),
    priHi: hexToU32('#997b58'),
    priLip: hexToU32('#ad8e68'),
    // Ancient weathered temple flagstones
    secShadow: hexToU32('#3d3228'),
    secDark: hexToU32('#524436'),
    secBase: hexToU32('#665645'),
    secMid: hexToU32('#786752'),
    secHi: hexToU32('#8c7a62'),
    // Calm desert oasis water
    hazDeep: hexToU32('#154754'),
    hazMid: hexToU32('#1f6370'),
    hazShallow: hexToU32('#2e828c'),
    hazFoam: hexToU32('#7ed1cf'),
    hazWet: hexToU32('#4f4232'),
    // Bronze-inlaid ancient temple road
    accInk: hexToU32('#2b211a'),
    accDark: hexToU32('#47372a'),
    accBase: hexToU32('#5e4a38'),
    accVein: hexToU32('#8a6d43'),
    accRim: hexToU32('#a88754'),
    // Carved sandstone temple plateau
    platDark: hexToU32('#69533b'),
    platBase: hexToU32('#826849'),
    platHi: hexToU32('#9c7f5b'),
    cliffTop: hexToU32('#b5986e'),
    cliffLit: hexToU32('#705941'),
    cliffDark: hexToU32('#362822'),
    cliffInk: hexToU32('#1a121c'),
    fleck: hexToU32('#499c8e'),
  },
};

function hash2i(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function paintThemePixel(
  theme: PlanetThemeId,
  kind: EnvTileKind,
  x: number,
  y: number,
  variant: number,
  animFrame = 0,
): RGBA32 {
  const p = THEME_PALETTES[theme];
  const dither = ((x ^ y) & 1) === 1;
  const h = hash2i(x + variant * 17, y + variant * 31, theme.length * 19 + kind.length * 7);

  if (kind === 'primary') {
    if (theme === 'desert') {
      // Subtle wind-swept horizontal dune ripples
      const rip = ((y + (x >> 2) + variant) % 4) === 0;
      if (rip && h > 0.35) return p.priHi;
      if (h < 0.18) return p.priDark;
      return dither ? p.priBase : p.priMid;
    }
    if (theme === 'tundra') {
      if (variant === 2 && ((x === 3 && y === 4) || (x === 4 && y === 3))) return p.priLip;
      if (h > 0.78) return p.priHi;
      if (h < 0.22) return p.priDark;
      return dither ? p.priBase : p.priMid;
    }
    if (theme === 'volcanic') {
      if (variant === 3 && x === 4 && y === 3) return p.fleck; // tiny cooling ember speck
      if (h > 0.78) return p.priHi;
      if (h < 0.24) return p.priDark;
      return dither ? p.priBase : p.priMid;
    }
    // temperate grass
    if (variant === 2 && ((x === 3 && y === 4) || (x === 4 && y === 3))) return p.priLip;
    if (variant === 3 && ((x === 2 && y === 5) || (x === 5 && y === 2))) return p.priHi;
    if (variant === 1 && h < 0.24) return p.priDark;
    return h > 0.72 ? p.priHi : h < 0.2 ? p.priDark : dither ? p.priBase : p.priMid;
  }

  if (kind === 'secondary') {
    if (theme === 'desert') {
      // Ancient cracked sandstone flagstone grid
      if (x === 0 || y === 0 || (x === 4 && y >= 4) || (y === 4 && x < 4)) {
        return h > 0.3 ? p.secDark : p.secShadow;
      }
      if (variant === 2 && x === 2 && y === 2) return p.secHi;
      return dither ? p.secBase : p.secMid;
    }
    if (theme === 'volcanic') {
      // Cracked basalt polygonal fissures
      if ((x === 3 && y >= 1 && y <= 6 && variant >= 1) || (y === 4 && x >= 2 && x <= 5 && variant === 2)) {
        return p.secShadow;
      }
      return h > 0.72 ? p.secMid : h < 0.24 ? p.secDark : dither ? p.secBase : p.secMid;
    }
    if (variant === 1 && h > 0.84) return p.secHi;
    if (variant === 2 && h < 0.22) return p.secDark;
    return h > 0.72 ? p.secMid : h < 0.2 ? p.secDark : dither ? p.secBase : p.secMid;
  }

  if (kind === 'accent') {
    const hf = hash2i(x + variant * 13, y + variant * 29, 404);
    if (theme === 'desert') {
      // Geometric carved temple floor trim
      if (x === 0 || y === 0) return p.accDark;
      if ((x === 3 || x === 4) && (y === 3 || y === 4)) return p.accVein;
      return hf < 0.25 ? p.accDark : p.accBase;
    }
    if (variant === 1 && Math.abs(x - y) === 0 && x >= 1 && x <= 6) return p.accVein;
    if (variant === 2 && Math.abs(x + y - 7) === 0 && x >= 2 && x <= 5) return p.accVein;
    return hf < 0.28 ? p.accDark : hf > 0.85 ? p.accVein : p.accBase;
  }

  if (kind === 'cliff') {
    if (variant === 1 && h > 0.78) return p.platHi;
    if (variant === 2 && h < 0.24) return p.platDark;
    return dither ? p.platBase : h > 0.68 ? p.platHi : p.platBase;
  }

  // hazard (water / ice / lava / oasis) with optional 3-frame animation drift!
  const sx = (x + animFrame * 2) & 7;
  if (theme === 'volcanic') {
    // Calm cooled magma crust with organic glowing orange fissures (no harsh diagonal stripes!)
    const hLav = hash2i((x + animFrame) & 7, y, 701 + variant * 17);
    const pocket = Math.hypot((sx - 3.5), (y - 3.5) * 1.15);
    if (variant === 0) {
      if (pocket < 1.6) return p.hazShallow;
      if (hLav > 0.86) return p.hazShallow;
      return hLav < 0.42 ? p.hazDeep : p.hazMid;
    }
    if (variant === 1) {
      if (pocket < 1.3) return p.hazFoam;
      if (pocket < 2.4) return p.hazShallow;
      return hLav < 0.45 ? p.hazDeep : p.hazMid;
    }
    if (variant === 2) {
      if ((y === 3 || y === 4) && sx >= 2 && sx <= 5) return sx === 3 ? p.hazFoam : p.hazShallow;
      return hLav < 0.48 ? p.hazDeep : p.hazMid;
    }
    if (hLav > 0.88) return p.hazFoam;
    if (hLav > 0.65) return p.hazShallow;
    return hLav < 0.44 ? p.hazDeep : p.hazMid;
  }
  if (theme === 'tundra') {
    // Natural calm frozen glacier ice with sparse short specular fracture glints (no blind stripes!)
    const glint =
      (variant === 2 && ((x === 2 && y === 2) || (x === 3 && y === 3) || (x === 4 && y === 3))) ||
      (variant === 3 && ((x === 5 && y === 4) || (x === 4 && y === 5)));
    if (glint) return p.hazFoam;
    if (h > 0.78) return p.hazShallow;
    return h < 0.28 ? p.hazDeep : p.hazMid;
  }
  const wave = (y === 2 && sx >= 1 && sx <= 3 && variant === 1) || (y === 5 && sx >= 4 && sx <= 6 && variant === 2);
  if (wave) return p.hazShallow;
  if (variant === 3 && y === 3 && (sx === 3 || sx === 4)) return p.hazFoam;
  return h > 0.74 && (y & 1) === 0 ? p.hazShallow : h < 0.3 ? p.hazDeep : p.hazMid;
}

function writeTile(atlas: PixelSurface, col: number, row: number, fn: (x: number, y: number) => RGBA32): void {
  const ox = col * TILE_PX;
  const oy = row * TILE_PX;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      atlas.pixels[(oy + y) * atlas.width + (ox + x)] = fn(x, y);
    }
  }
}

/** Builds 4-way carved stone ramps (S, N, E, W) with tapered alpha edges over any Layer-0 ground. */
function buildThemeRamps(theme: PlanetThemeId): Readonly<Record<'S' | 'N' | 'E' | 'W', PixelSurface>> {
  const p = THEME_PALETTES[theme];
  const makeSouth = (): PixelSurface => {
    const s = createSurface(24, 16, 0);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 24; x++) {
        const isEdge = x === 0 || x === 23;
        const isCurb = x === 1 || x === 22;
        const isLip = x === 2 || x === 21;
        if (y === 15 && (isEdge || isCurb)) {
          s.pixels[y * 24 + x] = isEdge ? SHADOW_SOFT : SHADOW_DEEP;
          continue;
        }
        if (isEdge) { s.pixels[y * 24 + x] = p.cliffInk; continue; }
        if (isCurb) { s.pixels[y * 24 + x] = p.cliffDark; continue; }
        if (isLip) { s.pixels[y * 24 + x] = p.cliffTop; continue; }
        const h = hash2i(x, y, 71);
        const stepLine = y === 4 || y === 9 || y === 13;
        if (stepLine && x >= 4 && x <= 19) s.pixels[y * 24 + x] = p.platDark;
        else if (y === 15 && h < 0.45) s.pixels[y * 24 + x] = SHADOW_SOFT;
        else s.pixels[y * 24 + x] = h > 0.7 ? p.platHi : h < 0.25 ? p.secMid : p.platBase;
      }
    }
    return s;
  };
  const makeNorth = (): PixelSurface => {
    const s = makeSouth();
    const out = createSurface(24, 16, 0);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 24; x++) {
        out.pixels[y * 24 + x] = s.pixels[(15 - y) * 24 + x];
      }
    }
    return out;
  };
  const makeEast = (): PixelSurface => {
    const s = createSurface(16, 24, 0);
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        const isEdge = y === 0 || y === 23;
        const isCurb = y === 1 || y === 22;
        const isLip = y === 2 || y === 21;
        if (x === 15 && (isEdge || isCurb)) {
          s.pixels[y * 16 + x] = isEdge ? SHADOW_SOFT : SHADOW_DEEP;
          continue;
        }
        if (isEdge) { s.pixels[y * 16 + x] = p.cliffInk; continue; }
        if (isCurb) { s.pixels[y * 16 + x] = p.cliffDark; continue; }
        if (isLip) { s.pixels[y * 16 + x] = p.cliffTop; continue; }
        const h = hash2i(x, y, 83);
        const stepLine = x === 4 || x === 9 || x === 13;
        if (stepLine && y >= 4 && y <= 19) s.pixels[y * 16 + x] = p.platDark;
        else if (x === 15 && h < 0.45) s.pixels[y * 16 + x] = SHADOW_SOFT;
        else s.pixels[y * 16 + x] = h > 0.7 ? p.platHi : h < 0.25 ? p.secMid : p.platBase;
      }
    }
    return s;
  };
  const makeWest = (): PixelSurface => {
    const s = makeEast();
    const out = createSurface(16, 24, 0);
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        out.pixels[y * 16 + x] = s.pixels[y * 16 + (15 - x)];
      }
    }
    return out;
  };
  return { S: makeSouth(), N: makeNorth(), E: makeEast(), W: makeWest() };
}

/** Builds crisp steel-truss tactical bridges (H: 24x16, V: 16x24) with alpha drop-shadows over water/lava! */
function buildTacticalBridges(theme: PlanetThemeId): { bridgeH: PixelSurface; bridgeV: PixelSurface } {
  const ink = hexToU32('#130f1e');
  const railHi = theme === 'desert' ? hexToU32('#d4b26a') : hexToU32('#a5b4c4');
  const railMid = theme === 'desert' ? hexToU32('#94733d') : hexToU32('#65758a');
  const deckA = theme === 'desert' ? hexToU32('#735b42') : hexToU32('#475263');
  const deckB = theme === 'desert' ? hexToU32('#5c4733') : hexToU32('#36404f');
  const caution = theme === 'desert' ? hexToU32('#3ecce0') : hexToU32('#d99b38');

  const bridgeH = createSurface(24, 16, 0);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 24; x++) {
      if (y === 0 || y === 13) { bridgeH.pixels[y * 24 + x] = ink; continue; }
      if (y === 14) { bridgeH.pixels[y * 24 + x] = SHADOW_DEEP; continue; }
      if (y === 15) { bridgeH.pixels[y * 24 + x] = SHADOW_SOFT; continue; }
      if (y === 1 || y === 12) {
        bridgeH.pixels[y * 24 + x] = (x % 4 === 0) ? caution : (y === 1 ? railHi : railMid);
        continue;
      }
      if (y === 2 || y === 11) { bridgeH.pixels[y * 24 + x] = railMid; continue; }
      const plank = (x % 3 === 0) ? deckB : deckA;
      const centerLine = (y === 6 || y === 7) && (x % 6 >= 1 && x % 6 <= 3);
      bridgeH.pixels[y * 24 + x] = centerLine ? railMid : plank;
    }
  }

  const bridgeV = createSurface(16, 24, 0);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 16; x++) {
      if (x === 0 || x === 13) { bridgeV.pixels[y * 16 + x] = ink; continue; }
      if (x === 14) { bridgeV.pixels[y * 16 + x] = SHADOW_DEEP; continue; }
      if (x === 15) { bridgeV.pixels[y * 16 + x] = SHADOW_SOFT; continue; }
      if (x === 1 || x === 12) {
        bridgeV.pixels[y * 16 + x] = (y % 4 === 0) ? caution : (x === 1 ? railHi : railMid);
        continue;
      }
      if (x === 2 || x === 11) { bridgeV.pixels[y * 16 + x] = railMid; continue; }
      const plank = (y % 3 === 0) ? deckB : deckA;
      const centerLine = (x === 6 || x === 7) && (y % 6 >= 1 && y % 6 <= 3);
      bridgeV.pixels[y * 16 + x] = centerLine ? railMid : plank;
    }
  }
  return { bridgeH, bridgeV };
}

export function buildPlanetAtlas(theme: PlanetThemeId): BiomeAtlasBundle {
  const p = THEME_PALETTES[theme];
  const atlas = createSurface(16 * TILE_PX, 8 * TILE_PX, 0);

  // Row 0: Base fills (4 variants each: secondary, primary, accent, plateau)
  for (let v = 0; v < 4; v++) {
    writeTile(atlas, v, 0, (x, y) => paintThemePixel(theme, 'secondary', x, y, v));
    writeTile(atlas, 4 + v, 0, (x, y) => paintThemePixel(theme, 'primary', x, y, v));
    writeTile(atlas, 8 + v, 0, (x, y) => paintThemePixel(theme, 'accent', x, y, v));
    writeTile(atlas, 12 + v, 0, (x, y) => paintThemePixel(theme, 'cliff', x, y, v));
  }

  // Row 1: Hazard fills (0..3), plateau accents (4..7), craters (11..13), flecks (14..15)
  for (let v = 0; v < 4; v++) {
    writeTile(atlas, v, 1, (x, y) => paintThemePixel(theme, 'hazard', x, y, v, 0));
    writeTile(atlas, 4 + v, 1, (x, y) => {
      const n = hash2i(x + v * 7, y - v * 11, 99);
      const d = Math.hypot(x - (2.2 + (v & 1) * 3.1), y - (2.4 + ((v >> 1) & 1) * 2.6));
      if (d < 1.5 && n > 0.32) return p.priBase;
      if (d < 2.1 && n > 0.68) return p.platDark;
      return paintThemePixel(theme, 'cliff', x, y, v);
    });
  }
  for (let v = 0; v < 3; v++) {
    const rad = 2.6 + v * 0.45;
    writeTile(atlas, 11 + v, 1, (x, y) => {
      const d = Math.hypot(x - 3.5, (y - 3.5) * 1.25);
      if (d < rad * 0.48) return p.cliffInk;
      if (d < rad * 0.9) return ((x ^ y) & 1) === 0 ? p.secShadow : p.secDark;
      return paintThemePixel(theme, 'secondary', x, y, v);
    });
  }
  for (let v = 0; v < 2; v++) {
    writeTile(atlas, 14 + v, 1, (x, y) => {
      if ((v === 0 && x === 2 && y === 3) || (v === 1 && x === 5 && y === 4)) return p.fleck;
      return paintThemePixel(theme, 'primary', x, y, v);
    });
  }

  // Row 2: primary-on-secondary Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 2, (x, y) => {
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 5, y + mask * 11, 202) - 0.5) * 0.14;
      const c = wangCoverage(x, y, mask, 0.05) + jitter;
      if (c >= 0.56) return c < 0.72 ? p.priLip : paintThemePixel(theme, 'primary', x, y, 0);
      if (c >= 0.42) return p.secShadow;
      return paintThemePixel(theme, 'secondary', x, y, 0);
    });
  }

  // Row 3 & Row 4: accent-on-secondary & accent-on-primary Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 3, (x, y) => {
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 303) - 0.5) * 0.16;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) return c < 0.70 ? p.accRim : paintThemePixel(theme, 'accent', x, y, 0);
      if (c >= 0.42) return p.accInk;
      return paintThemePixel(theme, 'secondary', x, y, 0);
    });
    writeTile(atlas, mask, 4, (x, y) => {
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 11, y + mask * 3, 405) - 0.5) * 0.16;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) return c < 0.70 ? p.accRim : paintThemePixel(theme, 'accent', x, y, 0);
      if (c >= 0.42) return p.accInk;
      return paintThemePixel(theme, 'primary', x, y, 0);
    });
  }

  // Row 5 & Row 7: hazard-on-primary & hazard-on-secondary Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 5, (x, y) => {
      const c = wangCoverage(x, y, mask, 0.04);
      const dither = ((x ^ y) & 1) === 1;
      const foamBreak = hash2i(x + mask * 3, y + mask * 7, 509);
      if (c >= 0.64) return c < 0.78 ? (foamBreak > 0.56 ? p.hazFoam : p.hazShallow) : paintThemePixel(theme, 'hazard', x, y, 0);
      if (c >= 0.50) return p.hazWet;
      if (c >= 0.34) return dither ? p.platDark : p.platBase;
      return paintThemePixel(theme, 'primary', x, y, 0);
    });
    writeTile(atlas, mask, 7, (x, y) => {
      const c = wangCoverage(x, y, mask, 0.04);
      const dither = ((x ^ y) & 1) === 1;
      const foamBreak = hash2i(x + mask * 5, y + mask * 9, 709);
      if (c >= 0.64) return c < 0.78 ? (foamBreak > 0.56 ? p.hazFoam : p.hazShallow) : paintThemePixel(theme, 'hazard', x, y, 0);
      if (c >= 0.50) return p.hazWet;
      if (c >= 0.34) return dither ? p.secDark : p.platBase;
      return paintThemePixel(theme, 'secondary', x, y, 0);
    });
  }

  // Row 6: Layer-1 ALPHA cliff Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 6, (x, y) => {
      if (mask === 0) return 0;
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const rockJitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 601) - 0.5) * 0.06;
      const c = wangCoverage(x, y, mask, 0.03) + rockJitter;
      if (c >= 0.68) return c < 0.81 ? p.cliffTop : paintThemePixel(theme, 'cliff', x, y, 0);
      if (c >= 0.57) return p.cliffDark;
      if (c >= 0.34) return ((x + (y >> 1)) & 3) === 0 ? p.cliffDark : p.cliffLit;
      if (c >= 0.21) return p.cliffDark;
      if (c >= 0.14) return p.cliffInk;
      if (c >= 0.07) return SHADOW_DEEP;
      if (c >= 0.01) return SHADOW_SOFT;
      return 0;
    });
  }

  // 3 animated frames of the 4 hazard liquid tiles (32x8 each)
  const hazardAnimFrames: PixelSurface[] = [];
  for (let f = 0; f < 3; f++) {
    const strip = createSurface(4 * TILE_PX, TILE_PX, 0);
    for (let v = 0; v < 4; v++) {
      writeTile(strip, v, 0, (x, y) => paintThemePixel(theme, 'hazard', x, y, v, f));
    }
    hazardAnimFrames.push(strip);
  }

  const rampTiles = buildThemeRamps(theme);
  const { bridgeH, bridgeV } = buildTacticalBridges(theme);

  return { theme, label: p.label, atlas, hazardAnimFrames, rampTiles, bridgeH, bridgeV };
}

function blitAtlasTile(dst: PixelSurface, atlas: PixelSurface, col: number, row: number, tx: number, ty: number): void {
  const sx0 = col * TILE_PX;
  const sy0 = row * TILE_PX;
  const dx0 = tx * TILE_PX;
  const dy0 = ty * TILE_PX;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      blendPixel(dst.pixels, (dy0 + y) * dst.width + dx0 + x, atlas.pixels[(sy0 + y) * atlas.width + sx0 + x]);
    }
  }
}

/** Renders a rich 20x12-tile (160x96) showcase patch for one biome including cliff, ramp, river, bridge, and accent ground. */
export function renderPlanetShowcasePatch(bundle: BiomeAtlasBundle): PixelSurface {
  const tw = 20;
  const th = 12;
  const gw = tw + 1;
  const gh = th + 1;
  const grid: EnvTileKind[] = new Array(gw * gh).fill('primary');

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (gy <= 3 && gx >= 2 && gx <= 13) grid[gy * gw + gx] = 'cliff';
      else if (gy >= 8 && gy <= 10 && gx >= 4 && gx <= 15) grid[gy * gw + gx] = 'hazard';
      else if (gx >= 14 && gy >= 2 && gy <= 7) grid[gy * gw + gx] = 'accent';
      else if (gx >= 4 && gx <= 13 && gy >= 5 && gy <= 7) grid[gy * gw + gx] = 'secondary';
    }
  }

  const out = createSurface(tw * TILE_PX, th * TILE_PX, 0);
  const at = (gx: number, gy: number) => grid[gy * gw + gx];

  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const raw = [at(tx, ty), at(tx + 1, ty), at(tx, ty + 1), at(tx + 1, ty + 1)];
      const nonCliff = raw.filter((k) => k !== 'cliff');
      const fallback: EnvTileKind = nonCliff[0] ?? 'primary';
      const [nw, ne, sw, se] = raw.map((k) => (k === 'cliff' ? fallback : k));
      const vr = hash2i(tx, ty, 313);
      const v = vr < 0.5 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;
      const maskOf = (k: EnvTileKind) =>
        (nw === k ? 1 : 0) | (ne === k ? 2 : 0) | (sw === k ? 4 : 0) | (se === k ? 8 : 0);

      const hMask = maskOf('hazard');
      if (hMask === 15) blitAtlasTile(out, bundle.atlas, v, 1, tx, ty);
      else if (hMask > 0) {
        const secCnt = [nw, ne, sw, se].filter((k) => k === 'secondary' || k === 'accent').length;
        blitAtlasTile(out, bundle.atlas, hMask, secCnt > 1 ? 7 : 5, tx, ty);
      } else {
        const aMask = maskOf('accent');
        if (aMask === 15) blitAtlasTile(out, bundle.atlas, 8 + v, 0, tx, ty);
        else if (aMask > 0) {
          const priCnt = [nw, ne, sw, se].filter((k) => k === 'primary').length;
          blitAtlasTile(out, bundle.atlas, aMask, priCnt >= 2 ? 4 : 3, tx, ty);
        } else {
          const pMask = maskOf('primary');
          if (pMask === 15) {
            const fl = hash2i(tx, ty, 77);
            blitAtlasTile(out, bundle.atlas, fl > 0.9 ? 14 + (v & 1) : 4 + v, fl > 0.9 ? 1 : 0, tx, ty);
          } else if (pMask > 0) blitAtlasTile(out, bundle.atlas, pMask, 2, tx, ty);
          else blitAtlasTile(out, bundle.atlas, v, 0, tx, ty);
        }
      }

      // Layer-1 alpha plateau & cliffs
      const cMask =
        (raw[0] === 'cliff' ? 1 : 0) |
        (raw[1] === 'cliff' ? 2 : 0) |
        (raw[2] === 'cliff' ? 4 : 0) |
        (raw[3] === 'cliff' ? 8 : 0);
      if (cMask === 15) {
        const acc = hash2i(tx, ty, 41);
        blitAtlasTile(out, bundle.atlas, acc > 0.84 ? 4 + (v & 3) : 12 + v, acc > 0.84 ? 1 : 0, tx, ty);
      } else if (cMask > 0) {
        blitAtlasTile(out, bundle.atlas, cMask, 6, tx, ty);
      }
    }
  }

  // Stamp South-facing carved ramp across cliff row ty=3..4 at tx=6..8
  blitScaled(out, bundle.rampTiles.S, 6 * TILE_PX, 3 * TILE_PX, 1);
  // Stamp vertical steel truss bridge spanning the hazard river at tx=9..10, ty=8..10
  blitScaled(out, bundle.bridgeV, 9 * TILE_PX, 8 * TILE_PX, 1);

  return out;
}
