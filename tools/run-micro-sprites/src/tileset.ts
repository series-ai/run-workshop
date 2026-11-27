/**
 * True 8x8 pixel-art tiling & Wang-16 dual-grid transitioning terrain tileset.
 *
 * Edge-alignment guarantee:
 *  - Every Wang-16 transition tile evaluates a continuous corner-interpolated coverage field
 *    with an interior-only organic modulation `sin(pi*u)*sin(pi*v)` that vanishes strictly to 0
 *    on all 4 tile borders (x in {0,7}, y in {0,7}), and uses one unified threshold ladder across
 *    all 16 masks. Adjacent tiles sharing corner biomes therefore align pixel-for-pixel at every join.
 *  - Atlas layout (16 cols x 8 rows of 8x8 tiles = 128x64 PNG):
 *      Row 0: Base fills — [0..3] dirt, [4..7] grass, [8..11] creep, [12..15] plateau
 *      Row 1: Base fills & extras — [0..3] water, [4..7] moss-tuft sandstone,
 *             [8..10] carved sandstone ramps (L/C/R), [11..13] dirt craters, [14..15] wildflowers
 *      Row 2: grass-on-dirt    Wang masks 0..15
 *      Row 3: creep-on-dirt    Wang masks 0..15
 *      Row 4: creep-on-grass   Wang masks 0..15
 *      Row 5: water-on-grass   Wang masks 0..15
 *      Row 6: plateau-cliff    Wang masks 0..15 (unified continuous cliff threshold ladder!)
 *      Row 7: water-on-dirt    Wang masks 0..15 (water painted on dirt keeps dirt shore, never grass!)
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

export const TILE_PX = 8;
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 8;

export type TileBiome = 'dirt' | 'grass' | 'creep' | 'plateau' | 'water';

export const TILE_BIOMES: readonly TileBiome[] = ['dirt', 'grass', 'creep', 'plateau', 'water'];

export interface TilesetBundle {
  readonly atlas: PixelSurface; // 128x64 PNG (16x8 tiles of 8x8)
  readonly tilePx: number;
  readonly cols: number;
  readonly rows: number;
  readonly rowIndex: Readonly<{
    baseMain: 0;
    baseExtra: 1;
    grassOnDirt: 2;
    creepOnDirt: 3;
    creepOnGrass: 4;
    waterOnGrass: 5;
    plateauCliff: 6;
    waterOnDirt: 7;
  }>;
}

export interface TileMapData {
  readonly gridW: number; // Dual-grid vertex count in X (worldW / 8 + 1)
  readonly gridH: number; // Dual-grid vertex count in Y (worldH / 8 + 1)
  readonly biomes: readonly TileBiome[]; // length = gridW * gridH
  readonly ramps: ReadonlyArray<{ readonly gx: number; readonly gy: number; readonly halfW: number }>;
}

const PAL = {
  grassDark: hexToU32('#253d2b'),
  grassBase: hexToU32('#315034'),
  grassMid: hexToU32('#3d613b'),
  grassHi: hexToU32('#4e7544'),
  grassLip: hexToU32('#5f8c4f'),
  flowerYel: hexToU32('#cfb557'),

  dirtShadow: hexToU32('#423029'),
  dirtDark: hexToU32('#574134'),
  dirtBase: hexToU32('#6b523e'),
  dirtMid: hexToU32('#7c6148'),
  dirtHi: hexToU32('#917456'),

  sandDark: hexToU32('#66513c'),
  sandBase: hexToU32('#876f50'),
  sandHi: hexToU32('#a38962'),
  cliffTop: hexToU32('#b59c72'),
  cliffLit: hexToU32('#7a644e'),
  cliffMid: hexToU32('#54423b'),
  cliffDark: hexToU32('#33252d'),
  cliffInk: hexToU32('#1a1220'),
  // Translucent alpha shadows for Layer-1 cliffs & ramps over ANY Layer-0 ground biome!
  cliffShadowDeep: packRGBA(18, 12, 28, 136),
  cliffShadowSoft: packRGBA(18, 12, 28, 64),
  transparent: 0,

  creepInk: hexToU32('#1d0c24'),
  creepDark: hexToU32('#2e1336'),
  creepBase: hexToU32('#401b45'),
  creepVein: hexToU32('#592857'),
  creepRim: hexToU32('#753b6b'),

  waterDeep: hexToU32('#183854'),
  waterMid: hexToU32('#214e6b'),
  waterShallow: hexToU32('#2f6a82'),
  waterFoam: hexToU32('#73bac7'),
  wetSand: hexToU32('#524134'),

  craterCore: hexToU32('#241821'),
  craterRing: hexToU32('#3d2b2b'),
} as const;

function hash2i(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Edge-exact bilinear Wang corner-mask coverage in [0, 1] inside an 8x8 tile
 * for mask bits: NW=1, NE=2, SW=4, SE=8.
 *
 * Uses vertex-aligned coordinates `u = x / (TILE_PX - 1)`, `v = y / (TILE_PX - 1)`
 * so the border pixels x=0/7 and y=0/7 evaluate the EXACT shared edge interpolation
 * between adjacent corner vertices, while the organic interior bump `sin(pi*u)*sin(pi*v)`
 * is strictly 0 on every border pixel — guaranteeing pixel-for-pixel band alignment across
 * all compatible Wang neighbors (e.g. mask 2 -> 3, 1 -> 5, 4 -> 12).
 */
export function wangCoverage(x: number, y: number, mask: number, interiorBump = 0.05): number {
  const nw = (mask & 1) !== 0 ? 1 : 0;
  const ne = (mask & 2) !== 0 ? 1 : 0;
  const sw = (mask & 4) !== 0 ? 1 : 0;
  const se = (mask & 8) !== 0 ? 1 : 0;

  const u = x / (TILE_PX - 1);
  const v = y / (TILE_PX - 1);

  const top = nw * (1 - u) + ne * u;
  const bot = sw * (1 - u) + se * u;
  const base = top * (1 - v) + bot * v;

  // Strictly exact 0 on x=0, x=7, y=0, y=7 (avoids IEEE-754 Math.sin(Math.PI) ~= 1.22e-16 residual!)
  const onBorder = x === 0 || x === TILE_PX - 1 || y === 0 || y === TILE_PX - 1;
  const bump = onBorder ? 0 : Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
  // Subtle rounded curve bias inside interior only (keeps corners organic without breaking edges)
  const sign = nw + ne + sw + se >= 2 ? 1 : -1;
  return base + sign * bump * interiorBump;
}

function paintBasePixel(biome: TileBiome, x: number, y: number, variant: number): RGBA32 {
  const dither = ((x ^ y) & 1) === 1;
  const h = hash2i(x + variant * 17, y + variant * 31, biome.length * 13);

  if (biome === 'dirt') {
    if (variant === 1 && h > 0.84) return PAL.dirtHi;
    if (variant === 2 && h < 0.22) return PAL.dirtDark;
    if (variant === 3 && x >= 2 && x <= 5 && y >= 2 && y <= 5 && h > 0.65) return PAL.dirtHi;
    return h > 0.72 ? PAL.dirtMid : h < 0.2 ? PAL.dirtDark : dither ? PAL.dirtBase : PAL.dirtMid;
  }

  if (biome === 'grass') {
    if (variant === 2 && ((x === 3 && y === 4) || (x === 4 && y === 3))) return PAL.grassLip;
    if (variant === 3 && ((x === 2 && y === 5) || (x === 5 && y === 2))) return PAL.grassHi;
    if (variant === 1 && h < 0.24) return PAL.grassDark;
    return h > 0.72 ? PAL.grassHi : h < 0.2 ? PAL.grassDark : dither ? PAL.grassBase : PAL.grassMid;
  }

  if (biome === 'creep') {
    const hFine = hash2i(x + variant * 13, y + variant * 29, 404);
    if (variant === 0) {
      return hFine < 0.28 ? PAL.creepDark : hFine > 0.86 ? PAL.creepVein : PAL.creepBase;
    }
    if (variant === 1) {
      const d = Math.abs(x - y);
      if (d === 0 && x >= 1 && x <= 6) return PAL.creepVein;
      if (d === 1 && hFine > 0.72) return PAL.creepDark;
      return hFine < 0.22 ? PAL.creepDark : PAL.creepBase;
    }
    if (variant === 2) {
      const d = Math.abs(x + y - 7);
      if (d === 0 && x >= 2 && x <= 5) return PAL.creepVein;
      if (x === 3 && y === 4) return PAL.creepRim;
      return hFine < 0.3 ? PAL.creepDark : PAL.creepBase;
    }
    if ((x === 2 && y === 3) || (x === 3 && y === 3) || (x === 5 && y === 5)) return PAL.creepVein;
    if (x === 2 && y === 2) return PAL.creepDark;
    return hFine < 0.25 ? PAL.creepDark : PAL.creepBase;
  }

  if (biome === 'plateau') {
    if (variant === 1 && h > 0.78) return PAL.sandHi;
    if (variant === 2 && h < 0.24) return PAL.sandDark;
    if (variant === 3 && ((x === 3 && y === 3) || (x === 4 && y === 3) || (x === 4 && y === 4))) return PAL.sandDark;
    return dither ? PAL.sandBase : h > 0.68 ? PAL.sandHi : PAL.sandBase;
  }

  // water
  const wave = (y === 2 && x >= 1 && x <= 3 && variant === 1) || (y === 5 && x >= 4 && x <= 6 && variant === 2);
  if (wave) return PAL.waterShallow;
  if (variant === 3 && y === 3 && (x === 3 || x === 4)) return PAL.waterFoam;
  return h > 0.74 && (y & 1) === 0 ? PAL.waterShallow : h < 0.3 ? PAL.waterDeep : PAL.waterMid;
}

function writeTile(
  atlas: PixelSurface,
  col: number,
  row: number,
  fn: (x: number, y: number) => RGBA32,
): void {
  const ox = col * TILE_PX;
  const oy = row * TILE_PX;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      atlas.pixels[(oy + y) * atlas.width + (ox + x)] = fn(x, y);
    }
  }
}

export function buildTileset(): TilesetBundle {
  const atlas = createSurface(ATLAS_COLS * TILE_PX, ATLAS_ROWS * TILE_PX);

  // Row 0: Base seamless 8x8 fills (4 variants each: dirt, grass, creep, plateau)
  for (let v = 0; v < 4; v++) {
    writeTile(atlas, v, 0, (x, y) => paintBasePixel('dirt', x, y, v));
    writeTile(atlas, 4 + v, 0, (x, y) => paintBasePixel('grass', x, y, v));
    writeTile(atlas, 8 + v, 0, (x, y) => paintBasePixel('creep', x, y, v));
    writeTile(atlas, 12 + v, 0, (x, y) => paintBasePixel('plateau', x, y, v));
  }

  // Row 1: Water fills (0..3), Plateau off-center weathered moss/stone (4..7), Tapered Stone Ramps (8..10), Craters (11..13), Wildflowers (14..15)
  for (let v = 0; v < 4; v++) {
    writeTile(atlas, v, 1, (x, y) => paintBasePixel('water', x, y, v));
  }
  // 4 varied, off-center plateau accents (calm sandstone with asymmetrical small moss/pebble touches)
  const mossCenters: ReadonlyArray<readonly [number, number]> = [
    [2.2, 2.5],
    [5.4, 2.3],
    [2.4, 5.2],
    [5.2, 4.8],
  ];
  for (let v = 0; v < 4; v++) {
    const [mx, my] = mossCenters[v];
    writeTile(atlas, 4 + v, 1, (x, y) => {
      const d = Math.hypot(x - mx, y - my);
      const n = hash2i(x + v * 7, y - v * 11, 99);
      if (v === 3) {
        // Subtle weathered sandstone crack/pebble (no moss)
        if (d < 1.35) return PAL.sandDark;
        if (x === 4 && y === 2) return PAL.sandHi;
        return paintBasePixel('plateau', x, y, v);
      }
      if (d < 1.55 && n > 0.3) return n > 0.68 ? PAL.grassMid : PAL.grassBase;
      if (d < 2.15 && n > 0.65) return PAL.sandDark;
      return paintBasePixel('plateau', x, y, v);
    });
  }
  // Worn sandy stone ramps with tapered alpha edges so curbs seat directly into ANY Layer-0 ground!
  writeTile(atlas, 8, 1, (x, y) => {
    const curbW = y >= 5 ? 1 : 2;
    if (x === 0 && y === 7) return PAL.cliffShadowSoft;
    if (x === 0 && y < 7) return PAL.cliffInk;
    if (x === 1 && y === 7) return PAL.cliffShadowDeep;
    if (x === 1 && y < 6) return PAL.cliffDark;
    if (x === curbW && y < 6) return PAL.cliffTop;
    const h = hash2i(x, y, 71);
    if (y === 7 && h < 0.35) return PAL.cliffShadowSoft;
    if (y === 3 && x > 3) return PAL.sandDark;
    return h > 0.68 ? PAL.sandHi : h < 0.25 ? PAL.dirtMid : PAL.sandBase;
  });
  writeTile(atlas, 9, 1, (x, y) => {
    const h = hash2i(x + 3, y, 73);
    if ((y === 2 && x >= 1 && x <= 5) || (y === 6 && x >= 2 && x <= 6)) return PAL.sandDark;
    if (y === 1 && x === 2) return PAL.sandHi;
    return h > 0.72 ? PAL.sandHi : h < 0.26 ? PAL.dirtMid : PAL.sandBase;
  });
  writeTile(atlas, 10, 1, (x, y) => {
    const curbX = y >= 5 ? 6 : 5;
    if (x === 7 && y === 7) return PAL.cliffShadowSoft;
    if (x === 7 && y < 7) return PAL.cliffInk;
    if (x === 6 && y === 7) return PAL.cliffShadowDeep;
    if (x === 6 && y < 6) return PAL.cliffDark;
    if (x === curbX && y < 6) return PAL.cliffTop;
    const h = hash2i(x + 9, y, 79);
    if (y === 7 && h < 0.35) return PAL.cliffShadowSoft;
    if (y === 4 && x < 4) return PAL.sandDark;
    return h > 0.68 ? PAL.sandHi : h < 0.25 ? PAL.dirtMid : PAL.sandBase;
  });
  // Dirt scorch craters (11..13)
  for (let v = 0; v < 3; v++) {
    const rad = 2.6 + v * 0.45;
    writeTile(atlas, 11 + v, 1, (x, y) => {
      const d = Math.hypot(x - 3.5, (y - 3.5) * 1.25);
      if (d < rad * 0.48) return PAL.craterCore;
      if (d < rad * 0.9) return ((x ^ y) & 1) === 0 ? PAL.craterRing : PAL.dirtShadow;
      return paintBasePixel('dirt', x, y, v);
    });
  }
  // Highland wildflower grass (14..15)
  for (let v = 0; v < 2; v++) {
    writeTile(atlas, 14 + v, 1, (x, y) => {
      if ((v === 0 && x === 2 && y === 3) || (v === 1 && x === 5 && y === 4)) return PAL.flowerYel;
      if ((v === 0 && x === 5 && y === 5) || (v === 1 && x === 2 && y === 2)) return PAL.grassLip;
      return paintBasePixel('grass', x, y, v);
    });
  }

  // All Wang-16 transition rows use variant=0 for base fills & edge-exact wangCoverage
  // so every shared border pixel between compatible masks has identical band classification!

  // Row 2: grass-on-dirt Wang-16 (organic interior tuft tips; border pixels strictly edge-exact!)
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 2, (x, y) => {
      const onBorder = x === 0 || x === TILE_PX - 1 || y === 0 || y === TILE_PX - 1;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 5, y + mask * 11, 202) - 0.5) * 0.14;
      const c = wangCoverage(x, y, mask, 0.05) + jitter;
      if (c >= 0.56) {
        if (c < 0.72) return PAL.grassLip;
        return paintBasePixel('grass', x, y, 0);
      }
      if (c >= 0.42) return PAL.dirtShadow;
      return paintBasePixel('dirt', x, y, 0);
    });
  }

  // Row 3: creep-on-dirt Wang-16 (irregular organic crawling interior tendrils; border pixels exact!)
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 3, (x, y) => {
      const onBorder = x === 0 || x === TILE_PX - 1 || y === 0 || y === TILE_PX - 1;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 303) - 0.5) * 0.18;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) {
        if (c < 0.7) return PAL.creepRim;
        return paintBasePixel('creep', x, y, 0);
      }
      if (c >= 0.42) return PAL.creepInk;
      return paintBasePixel('dirt', x, y, 0);
    });
  }

  // Row 4: creep-on-grass Wang-16 (distinct irregular organic creep tips over grass!)
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 4, (x, y) => {
      const onBorder = x === 0 || x === TILE_PX - 1 || y === 0 || y === TILE_PX - 1;
      const jitter = onBorder ? 0 : (hash2i(x + mask * 11, y + mask * 3, 405) - 0.5) * 0.18;
      const c = wangCoverage(x, y, mask, 0.06) + jitter;
      if (c >= 0.56) {
        if (c < 0.7) return PAL.creepRim;
        return paintBasePixel('creep', x, y, 0);
      }
      if (c >= 0.42) return PAL.creepInk;
      return paintBasePixel('grass', x, y, 0);
    });
  }

  // Row 5: water-on-grass Wang-16 (broken naturalistic foam streaks, zero regular dotted line!)
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 5, (x, y) => {
      const c = wangCoverage(x, y, mask, 0.04);
      const dither = ((x ^ y) & 1) === 1;
      const foamBreak = hash2i(x + mask * 3, y + mask * 7, 509);
      if (c >= 0.64) {
        if (c < 0.78) return foamBreak > 0.56 ? PAL.waterFoam : PAL.waterShallow;
        return paintBasePixel('water', x, y, 0);
      }
      if (c >= 0.5) return PAL.wetSand;
      if (c >= 0.34) return dither ? PAL.sandDark : PAL.sandBase;
      return paintBasePixel('grass', x, y, 0);
    });
  }

  // Row 6: LAYER-1 ALPHA plateau-cliff Wang-16!
  // Opaque sunlit sandstone rim + stepped rocky cliff face + warm dark rock foot + translucent cast shadow
  // + fully transparent outside -> composites seamlessly onto ANY Layer-0 biome (grass, dirt, creep, water)!
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 6, (x, y) => {
      if (mask === 0) return PAL.transparent;
      const onBorder = x === 0 || x === TILE_PX - 1 || y === 0 || y === TILE_PX - 1;
      const rockJitter = onBorder ? 0 : (hash2i(x + mask * 7, y + mask * 13, 601) - 0.5) * 0.06;
      const c = wangCoverage(x, y, mask, 0.03) + rockJitter;
      if (c >= 0.68) return c < 0.81 ? PAL.cliffTop : paintBasePixel('plateau', x, y, 0);
      if (c >= 0.57) return PAL.cliffDark;
      if (c >= 0.34) return ((x + (y >> 1)) & 3) === 0 ? PAL.cliffDark : PAL.cliffLit;
      if (c >= 0.21) return PAL.cliffDark;
      if (c >= 0.14) return PAL.cliffInk;
      if (c >= 0.07) return PAL.cliffShadowDeep;
      if (c >= 0.01) return PAL.cliffShadowSoft;
      return PAL.transparent;
    });
  }

  // Row 7: water-on-dirt Wang-16 (broken naturalistic foam streaks + dirt shoreline!)
  for (let mask = 0; mask < 16; mask++) {
    writeTile(atlas, mask, 7, (x, y) => {
      const c = wangCoverage(x, y, mask, 0.04);
      const dither = ((x ^ y) & 1) === 1;
      const foamBreak = hash2i(x + mask * 5, y + mask * 9, 709);
      if (c >= 0.64) {
        if (c < 0.78) return foamBreak > 0.56 ? PAL.waterFoam : PAL.waterShallow;
        return paintBasePixel('water', x, y, 0);
      }
      if (c >= 0.5) return PAL.wetSand;
      if (c >= 0.34) return dither ? PAL.dirtDark : PAL.sandBase;
      return paintBasePixel('dirt', x, y, 0);
    });
  }

  return {
    atlas,
    tilePx: TILE_PX,
    cols: ATLAS_COLS,
    rows: ATLAS_ROWS,
    rowIndex: {
      baseMain: 0,
      baseExtra: 1,
      grassOnDirt: 2,
      creepOnDirt: 3,
      creepOnGrass: 4,
      waterOnGrass: 5,
      plateauCliff: 6,
      waterOnDirt: 7,
    },
  };
}

function blitTile(
  dst: PixelSurface,
  tileset: TilesetBundle,
  tileCol: number,
  tileRow: number,
  tx: number,
  ty: number,
): void {
  const sx0 = tileCol * TILE_PX;
  const sy0 = tileRow * TILE_PX;
  const dx0 = tx * TILE_PX;
  const dy0 = ty * TILE_PX;
  for (let y = 0; y < TILE_PX; y++) {
    const dRow = (dy0 + y) * dst.width + dx0;
    const sRow = (sy0 + y) * tileset.atlas.width + sx0;
    for (let x = 0; x < TILE_PX; x++) {
      blendPixel(dst.pixels, dRow + x, tileset.atlas.pixels[sRow + x]);
    }
  }
}

/**
 * Resolve Layer-0 ground tile (strictly ground biomes: grass, dirt, creep, water —
 * substituting the nearest valley biome beneath plateau vertices so ground continues smoothly under cliffs!).
 */
export function resolveGroundTileAtlasCoord(
  map: TileMapData,
  tx: number,
  ty: number,
  tileset: TilesetBundle,
): readonly [number, number] {
  const rawAt = (gx: number, gy: number): TileBiome => map.biomes[gy * map.gridW + gx];
  const cornersRaw: readonly TileBiome[] = [
    rawAt(tx, ty),
    rawAt(tx + 1, ty),
    rawAt(tx, ty + 1),
    rawAt(tx + 1, ty + 1),
  ];
  // Find dominant non-plateau ground biome at this cell (falls back to nearest valley row below)
  let fallback: TileBiome = 'grass';
  const nonPlat = cornersRaw.filter((b) => b !== 'plateau');
  if (nonPlat.length > 0) {
    fallback = nonPlat[0];
  } else {
    for (let sy = ty + 2; sy < map.gridH; sy++) {
      const b = rawAt(tx, sy);
      if (b !== 'plateau') {
        fallback = b;
        break;
      }
    }
  }
  const nw = cornersRaw[0] === 'plateau' ? fallback : cornersRaw[0];
  const ne = cornersRaw[1] === 'plateau' ? fallback : cornersRaw[1];
  const sw = cornersRaw[2] === 'plateau' ? fallback : cornersRaw[2];
  const se = cornersRaw[3] === 'plateau' ? fallback : cornersRaw[3];

  const vr = hash2i(tx, ty, 313);
  const variant = vr < 0.52 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;

  const maskOf = (target: TileBiome): number =>
    (nw === target ? 1 : 0) |
    (ne === target ? 2 : 0) |
    (sw === target ? 4 : 0) |
    (se === target ? 8 : 0);

  const wMask = maskOf('water');
  if (wMask === 15) {
    const wr = hash2i(tx, ty, 811);
    const wVar = wr > 0.9 ? 3 : wr > 0.65 ? 2 : wr > 0.35 ? 1 : 0;
    return [wVar, tileset.rowIndex.baseExtra];
  }
  if (wMask > 0) {
    const dirtCount = [nw, ne, sw, se].filter((b) => b === 'dirt' || b === 'creep').length;
    const grassCount = [nw, ne, sw, se].filter((b) => b === 'grass').length;
    return [wMask, dirtCount > grassCount ? tileset.rowIndex.waterOnDirt : tileset.rowIndex.waterOnGrass];
  }

  const cMask = maskOf('creep');
  if (cMask === 15) return [8 + variant, tileset.rowIndex.baseMain];
  if (cMask > 0) {
    const underGrass =
      [nw, ne, sw, se].filter((b) => b === 'grass').length >=
      [nw, ne, sw, se].filter((b) => b === 'dirt').length;
    return [cMask, underGrass ? tileset.rowIndex.creepOnGrass : tileset.rowIndex.creepOnDirt];
  }

  const gMask = maskOf('grass');
  if (gMask === 15) {
    const fl = hash2i(tx, ty, 77);
    if (fl > 0.92) return [14 + (variant & 1), tileset.rowIndex.baseExtra];
    return [4 + variant, tileset.rowIndex.baseMain];
  }
  if (gMask > 0) return [gMask, tileset.rowIndex.grassOnDirt];

  const craterH = hash2i(tx, ty, 505);
  if (tx >= 22 && tx <= 42 && ty >= 15 && ty <= 24 && craterH > 0.94) {
    return [11 + (variant % 3), tileset.rowIndex.baseExtra];
  }
  return [variant, tileset.rowIndex.baseMain];
}

/**
 * Resolve optional Layer-1 Alpha Overlay tile (plateau cliffs, plateau interior, and carved ramps)
 * drawn with alpha blending ON TOP of Layer-0 ground! Returns null when no overlay exists.
 */
export function resolveOverlayTileAtlasCoord(
  map: TileMapData,
  tx: number,
  ty: number,
  tileset: TilesetBundle,
): readonly [number, number] | null {
  const at = (gx: number, gy: number): TileBiome => map.biomes[gy * map.gridW + gx];
  const nw = at(tx, ty);
  const ne = at(tx + 1, ty);
  const sw = at(tx, ty + 1);
  const se = at(tx + 1, ty + 1);

  for (const r of map.ramps) {
    if (ty >= r.gy && ty <= r.gy + 1 && Math.abs(tx - r.gx) <= r.halfW) {
      if (tx === r.gx - r.halfW) return [8, tileset.rowIndex.baseExtra];
      if (tx === r.gx + r.halfW) return [10, tileset.rowIndex.baseExtra];
      return [9, tileset.rowIndex.baseExtra];
    }
  }

  const pMask =
    (nw === 'plateau' ? 1 : 0) |
    (ne === 'plateau' ? 2 : 0) |
    (sw === 'plateau' ? 4 : 0) |
    (se === 'plateau' ? 8 : 0);

  if (pMask === 0) return null;
  if (pMask === 15) {
    const vr = hash2i(tx, ty, 313);
    const variant = vr < 0.52 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;
    const patch = hash2i(tx, ty, 41);
    return patch > 0.86
      ? [4 + (Math.floor(patch * 29) & 3), tileset.rowIndex.baseExtra]
      : [12 + variant, tileset.rowIndex.baseMain];
  }
  return [pMask, tileset.rowIndex.plateauCliff];
}

export function resolveTileAtlasCoord(
  map: TileMapData,
  tx: number,
  ty: number,
  tileset: TilesetBundle,
): readonly [number, number] {
  return resolveOverlayTileAtlasCoord(map, tx, ty, tileset) ?? resolveGroundTileAtlasCoord(map, tx, ty, tileset);
}

export function composeTilemap(map: TileMapData, tileset: TilesetBundle): PixelSurface {
  const tilesW = map.gridW - 1;
  const tilesH = map.gridH - 1;
  const surface = createSurface(tilesW * TILE_PX, tilesH * TILE_PX);

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      // Pass 1 (Layer 0): Continuous ground biome underneath!
      const [gCol, gRow] = resolveGroundTileAtlasCoord(map, tx, ty, tileset);
      blitTile(surface, tileset, gCol, gRow, tx, ty);
      // Pass 2 (Layer 1): Alpha-blended cliff / plateau / ramp overlay on top!
      const overlay = resolveOverlayTileAtlasCoord(map, tx, ty, tileset);
      if (overlay) {
        blitTile(surface, tileset, overlay[0], overlay[1], tx, ty);
      }
    }
  }
  return surface;
}

/**
 * Build the 5-biome 64x36 (512x288) RTS battlefield grid with ramps mathematically aligned
 * to the exact plateau cliff boundary (ZERO cliff wall left across either ramp entrance!).
 */
export function buildDefaultBattleTilemap(tilesW = 64, tilesH = 36): TileMapData {
  const gridW = tilesW + 1;
  const gridH = tilesH + 1;
  const biomes: TileBiome[] = new Array(gridW * gridH);

  // Define two twin ramp columns; flatten the plateau ridge at each ramp mouth to exact vertex row gy=9!
  const rampSpecs = [
    { gx: 24, halfW: 2 },
    { gx: 40, halfW: 2 },
  ];
  const RAMP_CLIFF_GY = 9; // Vertex row gy<=9 is plateau, gy>=10 is valley -> cliff tile is ty=9!

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * TILE_PX;
      const py = gy * TILE_PX;
      const wob = (hash2i(gx >> 1, gy >> 1, 19) - 0.5) * 14;

      const nearRamp = rampSpecs.some((r) => Math.abs(gx - r.gx) <= r.halfW + 1);
      const ridgeY = nearRamp
        ? (RAMP_CLIFF_GY + 0.5) * TILE_PX
        : 82 + Math.abs(px - 256) * -0.1 + Math.sin(px * 0.024) * 7 + wob * 0.45;
      if (py < ridgeY) {
        biomes[gy * gridW + gx] = 'plateau';
        continue;
      }

      const dxW = (px - 256) / 1.85;
      const dyW = (py - 266) / 0.56;
      if (Math.hypot(dxW, dyW) < 68 + wob * 0.4) {
        biomes[gy * gridW + gx] = 'water';
        continue;
      }

      const dxC = (px - 426) / 1.24;
      const dyC = (py - 156) / 0.84;
      const lobe = Math.sin(Math.atan2(dyC, dxC) * 6) * 10;
      if (Math.hypot(dxC, dyC) < 114 + lobe + wob * 0.65) {
        biomes[gy * gridW + gx] = 'creep';
        continue;
      }

      const roadY = 160 + Math.sin(px * 0.018) * 12 - (px - 256) * 0.06;
      const basin = Math.exp(-((px - 256) * (px - 256)) / (118 * 118)) * 42;
      if (Math.abs(py - roadY) < 28 + basin + wob * 0.55) {
        biomes[gy * gridW + gx] = 'dirt';
        continue;
      }

      biomes[gy * gridW + gx] = 'grass';
    }
  }

  // Ramp tiles occupy ty = RAMP_CLIFF_GY (the exact cliff face row!) and ty = RAMP_CLIFF_GY + 1 (ramp foot),
  // opening cleanly directly onto the plateau top (ty <= 8) with ZERO blocking cliff wall!
  return {
    gridW,
    gridH,
    biomes,
    ramps: rampSpecs.map((r) => ({ gx: r.gx, gy: RAMP_CLIFF_GY, halfW: r.halfW })),
  };
}

export function renderTilesetProof(tileset: TilesetBundle): PixelSurface {
  const zoom = 4;
  const cell = TILE_PX * zoom; // 32px
  const pad = 2;
  const topW = ATLAS_COLS * (cell + pad) + pad;
  const topH = ATLAS_ROWS * (cell + pad) + pad;

  // Multi-biome transition diorama (17x9 tiles at 3x zoom = 408x216)
  // Plateau spans vertex rows 0..2 -> cliff sits strictly on tile row ty=2 -> ramp cuts cleanly on ty=2..3!
  const miniW = 17;
  const miniH = 9;
  const mGridW = miniW + 1;
  const mGridH = miniH + 1;
  const mBiomes: TileBiome[] = new Array(mGridW * mGridH).fill('grass');
  for (let y = 0; y < mGridH; y++) {
    for (let x = 0; x < mGridW; x++) {
      let b: TileBiome = 'grass';
      if (y <= 2 && x >= 3 && x <= 14) b = 'plateau';
      else if (x >= 12 && y >= 3 && y <= 7) b = 'creep';
      else if (x >= 3 && x <= 11 && y >= 4 && y <= 6) b = 'dirt';
      else if (y >= 7 && x >= 5 && x <= 10) b = 'water';
      mBiomes[y * mGridW + x] = b;
    }
  }
  const miniMap: TileMapData = {
    gridW: mGridW,
    gridH: mGridH,
    biomes: mBiomes,
    ramps: [{ gx: 8, gy: 2, halfW: 1 }],
  };
  const miniSurf = composeTilemap(miniMap, tileset);

  const botH = miniSurf.height * 3 + 16;
  const W = topW;
  const H = topH + 10 + botH;
  const proof = createSurface(W, H, hexToU32('#0d1018'));

  const rowColors: readonly RGBA32[] = [
    hexToU32('#94a3b8'),
    hexToU32('#64748b'),
    hexToU32('#4ade80'),
    hexToU32('#c084fc'),
    hexToU32('#e879f9'),
    hexToU32('#38bdf8'),
    hexToU32('#fbbf24'),
    hexToU32('#0ea5e9'),
  ];

  const tileScratch = createSurface(TILE_PX, TILE_PX);
  for (let r = 0; r < ATLAS_ROWS; r++) {
    for (let c = 0; c < ATLAS_COLS; c++) {
      for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          tileScratch.pixels[y * TILE_PX + x] =
            tileset.atlas.pixels[(r * TILE_PX + y) * tileset.atlas.width + (c * TILE_PX + x)];
        }
      }
      const dx = pad + c * (cell + pad);
      const dy = pad + r * (cell + pad);
      if (r === 6) {
        // Subtle transparency checker behind Row 6 so Layer-1 alpha cliffs & cast shadows are clearly visible
        const chkA = hexToU32('#1e2636');
        const chkB = hexToU32('#2a3448');
        for (let py = 0; py < cell; py++) {
          for (let px = 0; px < cell; px++) {
            proof.pixels[(dy + py) * W + (dx + px)] = (((px >> 2) + (py >> 2)) & 1) === 0 ? chkA : chkB;
          }
        }
      }
      blitScaled(proof, tileScratch, dx, dy, zoom);
      for (let bx = 0; bx < cell; bx++) {
        proof.pixels[dy * W + dx + bx] = rowColors[r];
      }
    }
  }

  const botY = topH + 10;
  const swatchX = 8;
  const miniX = W - miniSurf.width * 3 - 8;
  const biomeOrder: readonly TileBiome[] = ['grass', 'dirt', 'creep', 'plateau', 'water'];
  for (let i = 0; i < biomeOrder.length; i++) {
    const b = biomeOrder[i];
    const swMap: TileMapData = {
      gridW: 4,
      gridH: 4,
      biomes: new Array(16).fill(b),
      ramps: [],
    };
    const sw = composeTilemap(swMap, tileset);
    const col = i % 2;
    const row = Math.floor(i / 2);
    blitScaled(proof, sw, swatchX + col * 58, botY + 8 + row * 68, 2);
  }

  blitScaled(proof, miniSurf, miniX, botY + 8, 3);
  return proof;
}
