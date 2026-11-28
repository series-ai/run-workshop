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

// Each stamp uses a base, a shallow plane, a cut, and a small lit edge.
const GROUND_STAMPS = {
  temperate: {
    primary: ['........','..+.....','.+m.m...','..mm....','...-....','......m.','.....mm.','........'],
    secondary: ['........','....mm..','..mm-...','..--....','........','.m...+m.','......-.','........'],
    accent: ['........','..mm....','.m..mm..','.....+..','....m...','...m.-..','..m...-.','........'],
  },
  tundra: {
    primary: ['........','.....mm.','...mmm..','..+mm...','.mm.....','.....--.','....-...','........'],
    secondary: ['........','..mm....','...-m...','...-....','..-.mm..','.-..+...','.....m..','........'],
    accent: ['........','..mm..m.','..-..mm.','....--..','........','.mm..m..','.m..mm..','........'],
  },
  volcanic: {
    primary: ['........','...mmm..','..mm....','..-.....','...--...','.....-..','..m.....','........'],
    secondary: ['........','.mmm....','....-mm.','...-....','..--....','.m..-...','.....-..','........'],
    accent: ['........','..mm....','....-m..','...-....','..m.....','...m--..','........','........'],
  },
  desert: {
    primary: ['........','.....mm.','...mmm..','.mmm....','.-......','......m.','....mm..','........'],
    secondary: ['--------','mmmm..-.','......-.','--....-.','mm-----.','..m...mm','..-.....','..-.....'],
    accent: ['........','.mmm....','.m...--.','.m..m.-.','....m.-.','...mm...','........','........'],
  },
} as const;

function paintThemePixel(
  theme: PlanetThemeId, kind: EnvTileKind, x: number, y: number, variant: number, animFrame = 0,
): RGBA32 {
  const p = THEME_PALETTES[theme];
  const u = ((variant === 2 ? 7 - x : x) + variant * 3) & 7;
  const v = (y + variant * 5) & 7;
  if (kind === 'hazard') {
    if (theme === 'volcanic') {
      const ridge = [2, 2, 3, 5, 5, 4, 3, 2][v];
      const fault = (u - ridge + 8) & 7;
      if (fault === 0 && (v + variant) % 7 < 5) {
        return (v + variant) % 7 === animFrame + 1 ? p.hazFoam : p.hazShallow;
      }
      if (fault < 2 || (v === 4 && fault > 4)) return p.hazMid;
      return fault > 3 && v < 4 ? p.hazWet : p.hazDeep;
    }
    if (theme === 'tundra') {
      const plane = (u + (v >> 1)) & 7;
      if (plane === 3 && v === 2 + animFrame) return p.hazFoam;
      if (plane === 3 && v >= 2 && v < 5) return p.hazShallow;
      return (v === 5 && u < 4) || (v === 6 && u >= 2 && u < 5) ? p.hazDeep : p.hazMid;
    }
    const wave = (u + animFrame * 2 + (v >> 1)) & 7;
    if (v === 2 && wave < 3) return wave === 1 && variant === 2 ? p.hazFoam : p.hazShallow;
    return (v === 3 && wave < 4) || (v === 6 && wave > 4) ? p.hazDeep : p.hazMid;
  }
  if (kind === 'cliff') {
    if (v === 4 && u >= 2 && u < 5) return p.platHi;
    if (v === 5 && u >= 4 && u < 6) return p.platDark;
    return p.platBase;
  }
  const stamp = GROUND_STAMPS[theme][kind][v][u];
  if (kind === 'primary') {
    if (stamp === '+') return p.priHi;
    if (stamp === 'm') return p.priMid;
    return stamp === '-' ? p.priDark : p.priBase;
  }
  if (kind === 'secondary') {
    if (theme === 'volcanic' && variant === 3 && u === 2 && v === 4) return p.accVein;
    if (stamp === '+') return p.secHi;
    if (stamp === 'm') return p.secMid;
    return stamp === '-' ? p.secDark : p.secBase;
  }
  if (stamp === '+') return p.accRim;
  if (stamp === 'm') return p.accVein;
  return stamp === '-' ? p.accDark : p.accBase;
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
  function ramp(vertical: boolean, reverse: boolean): PixelSurface {
    const out = createSurface(vertical ? 24 : 16, vertical ? 16 : 24, 0);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const across = vertical ? x : y;
        const along = vertical ? y : x;
        const depth = reverse ? 15 - along : along;
        const curb = Math.min(across, 23 - across);
        const tread = depth % 5;
        let color = p.platBase;
        if (depth === 15) color = curb < 2 ? SHADOW_DEEP : SHADOW_SOFT;
        else if (curb === 0) color = across === 23 ? p.cliffInk : p.cliffLit;
        else if (curb < 3) color = tread === 4 ? p.cliffLit : across < 3 ? p.cliffTop : p.platHi;
        else if (tread === 4) color = p.platDark;
        else if (tread === 3) color = p.platHi;
        else if (across === 6 + (Math.floor(depth / 5) * 7) % 12 && tread < 2) color = p.cliffLit;
        out.pixels[y * out.width + x] = color;
      }
    }
    return out;
  }
  return { S: ramp(true, false), N: ramp(true, true), E: ramp(false, false), W: ramp(false, true) };
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
      const plank = (x % 4 === 0 || y === 10) ? deckB : deckA;
      const rivet = x % 4 === 1 && (y === 3 || y === 9);
      bridgeH.pixels[y * 24 + x] = rivet ? railMid : plank;
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
      const plank = (y % 4 === 0 || x === 10) ? deckB : deckA;
      const rivet = y % 4 === 1 && (x === 3 || x === 9);
      bridgeV.pixels[y * 16 + x] = rivet ? railMid : plank;
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
      if (c >= 0.56) return c < 0.72 ? p.priLip : paintThemePixel(theme, 'primary', x % 7, y % 7, 0);
      if (c >= 0.42) return p.secShadow;
      return paintThemePixel(theme, 'secondary', x % 7, y % 7, 0);
    });
  }

  // Row 3 & Row 4: accent-on-secondary & accent-on-primary Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 3, (x, y) => {
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 303) - 0.5) * 0.16;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) return c < 0.70 ? p.accRim : paintThemePixel(theme, 'accent', x % 7, y % 7, 0);
      if (c >= 0.42) return p.accInk;
      return paintThemePixel(theme, 'secondary', x % 7, y % 7, 0);
    });
    writeTile(atlas, mask, 4, (x, y) => {
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 11, y + mask * 3, 405) - 0.5) * 0.16;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) return c < 0.70 ? p.accRim : paintThemePixel(theme, 'accent', x % 7, y % 7, 0);
      if (c >= 0.42) return p.accInk;
      return paintThemePixel(theme, 'primary', x % 7, y % 7, 0);
    });
  }

  // Row 5 & Row 7: hazard-on-primary & hazard-on-secondary Wang-16
  for (let mask = 0; mask < 16; mask++) {
    for (const row of [5, 7]) {
      writeTile(atlas, mask, row, (x, y) => {
        const c = wangCoverage(x, y, mask, 0.04);
        const u = x % 7, v = y % 7;
        if (c >= 0.84) return paintThemePixel(theme, 'hazard', u, v, 0);
        if (c >= 0.72) return p.hazMid;
        if (c >= 0.55) return (u + 2 * v) % 5 === 1 ? p.hazFoam : p.hazShallow;
        if (c >= 0.42) return p.hazWet;
        if (c >= 0.34) return row === 5 ? p.priDark : p.secDark;
        return paintThemePixel(theme, row === 5 ? 'primary' : 'secondary', u, v, 0);
      });
    }
  }

  // Row 6: Layer-1 ALPHA cliff Wang-16
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 6, (x, y) => {
      if (mask === 0) return 0;
      const onBorder = x === 0 || x === 7 || y === 0 || y === 7;
      const rockJitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 601) - 0.5) * 0.06;
      const c = wangCoverage(x, y, mask, 0.03) + rockJitter;
      const u = x % 7, v = y % 7;
      if (c >= 0.80) return paintThemePixel(theme, 'cliff', u, v, 0);
      if (c >= 0.66) {
        const facesSun = onBorder || wangCoverage(x + 1, y + 1, mask, 0) > c;
        return !facesSun && c < 0.73 ? p.platHi : p.cliffTop;
      }
      if (c >= 0.55) return p.platDark;
      if (c >= 0.30) {
        if ((u + (v >> 2)) % 5 === 2) return p.cliffDark;
        return v === 3 && u < 4 ? p.platHi : p.cliffLit;
      }
      if (c >= 0.20) return p.cliffDark;
      if (c >= 0.13) return p.cliffInk;
      if (c > 0.005) return packRGBA(16, 11, 26, Math.round(28 + c * 920));
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
