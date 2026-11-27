/**
 * Multi-biome micro-pixel RTS battlefield terrain painter (512x288 world, 384x216 viewport).
 *
 * Designed specifically for mass 8x8 unit legibility:
 *  - Calm, low-contrast earthy/mossy/plum tones with crisp dithered transitions & subtle 8x8 tile rhythm
 *  - Five distinct biomes that transition organically:
 *      1. West Vanguard Highland Grasslands
 *      2. North Solaris Elevated Sandstone Ridge Plateau + 9px Stepped Cliff + Dual Ramps
 *      3. Central Sun-Baked Ochre Dirt Battlefield + Blast Craters
 *      4. East Kraxen Creeping Plum Blight + Glowing Violet Veins
 *      5. South Turquoise Coastal Stream + Sandy Bank
 */

import { createSurface, hexToU32, type PixelSurface, type RGBA32 } from './pixel.ts';

export const WORLD_W = 512;
export const WORLD_H = 288;
export const VIEW_W = 384;
export const VIEW_H = 216;

function hash2i(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy);
  const b = hash2i(ix + 1, iy);
  const c = hash2i(ix, iy + 1);
  const d = hash2i(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number): number {
  return (
    noise2D(x, y) * 0.58 +
    noise2D(x * 2.1 + 7.3, y * 2.1 - 4.1) * 0.28 +
    noise2D(x * 4.3 - 3.7, y * 4.3 + 9.2) * 0.14
  );
}

export function paintMicroTerrain(w = WORLD_W, h = WORLD_H): PixelSurface {
  const surface = createSurface(w, h);
  const buf = surface.pixels;

  // Calm, value-controlled micro-RTS terrain ramps (sprites are brighter & higher chroma!)
  const GRASS_DARK = hexToU32('#253d2b');
  const GRASS_BASE = hexToU32('#315034');
  const GRASS_MID = hexToU32('#3d613b');
  const GRASS_HI = hexToU32('#4e7544');
  const GRASS_LIP = hexToU32('#5c874c');

  const DIRT_SHADOW = hexToU32('#402e28');
  const DIRT_DARK = hexToU32('#574134');
  const DIRT_BASE = hexToU32('#6b523e');
  const DIRT_MID = hexToU32('#7d6249');
  const DIRT_HI = hexToU32('#917456');

  const SAND_DARK = hexToU32('#66513c');
  const SAND_BASE = hexToU32('#876f50');
  const SAND_HI = hexToU32('#a38962');

  const CLIFF_TOP = hexToU32('#b0976f');
  const CLIFF_LIT = hexToU32('#7a644e');
  const CLIFF_MID = hexToU32('#54423b');
  const CLIFF_DARK = hexToU32('#33252d');
  const CLIFF_INK = hexToU32('#1a1220');

  const CREEP_INK = hexToU32('#1d0c24');
  const CREEP_DARK = hexToU32('#2e1336');
  const CREEP_BASE = hexToU32('#401b45');
  const CREEP_VEIN = hexToU32('#592857');
  const CREEP_RIM = hexToU32('#733969');

  const WATER_DEEP = hexToU32('#183854');
  const WATER_MID = hexToU32('#214e6b');
  const WATER_SHALLOW = hexToU32('#2f6a82');
  const WATER_FOAM = hexToU32('#69adba');
  const WET_SAND = hexToU32('#4f3f33');

  const CRATER_CORE = hexToU32('#241821');
  const CRATER_RING = hexToU32('#3d2b2b');

  const plateauField = new Float32Array(w * h);
  const dirtField = new Float32Array(w * h);
  const creepField = new Float32Array(w * h);
  const waterField = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const nBig = (fbm2D(x * 0.028, y * 0.038) - 0.5) * 22;
      const nMed = (fbm2D(x * 0.075 + 11, y * 0.095 - 5) - 0.5) * 10;

      // 1. North Solaris Sandstone Ridge Plateau with twin carved ramps at x=195 and x=315
      const ridgeY = 82 + Math.abs(x - 256) * -0.11 + Math.sin(x * 0.022) * 8 + nBig * 0.45;
      const rampLeft = Math.max(0, 20 - Math.abs(x - 196)) * 0.78;
      const rampRight = Math.max(0, 20 - Math.abs(x - 318)) * 0.78;
      plateauField[idx] = ridgeY - y - Math.max(rampLeft, rampRight);

      // 2. Central Ochre Dirt War-Corridor & Battle Basin (W -> Center -> E)
      const roadY = 160 + Math.sin(x * 0.018) * 14 - (x - 256) * 0.07;
      const distRoad = Math.abs(y - roadY);
      const basin = Math.exp(-((x - 256) * (x - 256)) / (118 * 118)) * 42;
      dirtField[idx] = 28 + basin - distRoad + nBig * 0.7 + nMed * 0.35;

      // 3. East Kraxen Organic Brood Creep spreading from the East Spire (x=426, y=156)
      const dxC = (x - 426) / 1.24;
      const dyC = (y - 156) / 0.84;
      const distC = Math.hypot(dxC, dyC);
      const lobe = Math.sin(Math.atan2(dyC, dxC) * 7 + fbm2D(x * 0.045, y * 0.045) * 4) * 11;
      creepField[idx] = 114 - distC + lobe + nBig * 0.75 + nMed * 0.55;

      // 4. South Turquoise Stream / Cove along bottom edge (clearly visible 5th biome!)
      const dxW = (x - 256) / 1.85;
      const dyW = (y - 266) / 0.56;
      waterField[idx] = 68 - Math.hypot(dxW, dyW) + nBig * 0.5;
    }
  }

  const craters: ReadonlyArray<readonly [number, number, number]> = [
    [214, 158, 7],
    [258, 174, 8],
    [292, 146, 6],
    [240, 136, 5],
    [322, 182, 6],
  ];

  // Pass 1: Biome fill + subtle 8x8 tile rhythm
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pf = plateauField[idx];
      const df = dirtField[idx];
      const cf = creepField[idx];
      const wf = waterField[idx];

      // Subtle 8x8 pixel-tile grid rhythm (iconic micro-RTS feel!)
      const tileCheck = (((x >> 3) + (y >> 3)) & 1) === 0;
      const nTex = fbm2D(x * 0.16, y * 0.2);
      const nFine = hash2i(x, y);
      const dither = ((x ^ y) & 1) === 1;

      let col: RGBA32;

      if (pf > 0) {
        if (pf < 2.0) {
          col = CLIFF_TOP;
        } else if (pf < 3.6 && dither) {
          col = SAND_HI;
        } else {
          const grassPatch = fbm2D(x * 0.08 + 23, y * 0.09 - 11);
          if (grassPatch > 0.61) {
            col = nTex > 0.55 ? GRASS_MID : GRASS_BASE;
          } else if (nTex > 0.64) {
            col = SAND_HI;
          } else if (nTex < 0.34) {
            col = SAND_DARK;
          } else {
            col = tileCheck ? SAND_BASE : nFine > 0.72 ? SAND_HI : SAND_BASE;
          }
        }
      } else if (pf > -9.5) {
        const depth = -pf;
        const seam = hash2i(x >> 2, (y >> 1) + 9);
        if (depth < 1.2) {
          col = CLIFF_INK;
        } else if (depth < 3.2) {
          col = seam > 0.45 ? CLIFF_LIT : CLIFF_MID;
        } else if (depth < 6.8) {
          col = (x & 3) === 0 || seam < 0.28 ? CLIFF_DARK : CLIFF_MID;
        } else if (depth < 8.4) {
          col = CLIFF_DARK;
        } else {
          col = CLIFF_INK;
        }
      } else if (wf > 0) {
        if (wf < 2.2) {
          col = dither ? WATER_FOAM : WATER_SHALLOW;
        } else if (wf < 7.5) {
          col = WATER_SHALLOW;
        } else if (wf < 16) {
          col = nTex > 0.6 && (y & 1) === 0 ? WATER_SHALLOW : WATER_MID;
        } else {
          col = nTex > 0.68 && (y & 1) === 0 ? WATER_MID : WATER_DEEP;
        }
      } else if (wf > -5.5) {
        col = wf > -2.0 ? WET_SAND : dither ? SAND_DARK : SAND_BASE;
      } else {
        // Base grass vs dirt road
        const isDirt = df > 0 || (df > -2.8 && dither && nTex > 0.44);
        if (isDirt) {
          if (df < 3.5 && pf < -10) {
            col = DIRT_DARK;
          } else if (nTex > 0.66) {
            col = DIRT_HI;
          } else if (nTex > 0.5) {
            col = DIRT_MID;
          } else if (nTex < 0.3) {
            col = DIRT_DARK;
          } else {
            col = tileCheck ? DIRT_BASE : DIRT_MID;
          }
        } else {
          if (nTex > 0.65) {
            col = GRASS_HI;
          } else if (nTex > 0.48) {
            col = GRASS_MID;
          } else if (nTex < 0.28) {
            col = GRASS_DARK;
          } else {
            col = tileCheck ? GRASS_BASE : GRASS_MID;
          }
          if (df > -4.2 && df <= 0 && nFine > 0.45) {
            col = GRASS_LIP;
          }
        }

        // Brood Creep overlay (veiny plum mat with crisp organic edge)
        if (cf > 0 || (cf > -3.5 && dither && nTex > 0.46)) {
          const vein = Math.abs(fbm2D(x * 0.14 + 4, y * 0.14 - 3) - 0.5);
          if (cf < 1.8) {
            col = CREEP_INK;
          } else if (cf < 3.6) {
            col = dither ? CREEP_RIM : CREEP_DARK;
          } else if (vein < 0.045) {
            col = CREEP_RIM;
          } else if (vein < 0.1) {
            col = CREEP_VEIN;
          } else if (nTex < 0.32) {
            col = CREEP_DARK;
          } else {
            col = CREEP_BASE;
          }
        }

        // Cliff cast shadow onto valley below
        if (pf <= -9.5 && pf > -13.0) {
          col = cf > 0 ? CREEP_INK : isDirt ? DIRT_SHADOW : GRASS_DARK;
        }
      }

      buf[idx] = col;
    }
  }

  // Pass 2: Micro scorch craters on central battlefield
  for (const [cx, cy, rad] of craters) {
    for (let dy = -rad - 1; dy <= rad + 1; dy++) {
      for (let dx = -rad - 1; dx <= rad + 1; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const dist = Math.hypot(dx, dy * 1.45);
        if (dist < rad * 0.45) {
          buf[py * w + px] = CRATER_CORE;
        } else if (dist < rad * 0.85) {
          buf[py * w + px] = ((px ^ py) & 1) === 0 ? CRATER_RING : DIRT_SHADOW;
        }
      }
    }
  }

  // Pass 3: Subtle pixel tufts & pebbles (sparse so 8x8 units stay 100% dominant!)
  for (let y = 12; y < h - 12; y += 5) {
    for (let x = 8; x < w - 8; x += 7) {
      const idx = y * w + x;
      const hVal = hash2i(x * 3, y * 5);
      if (hVal < 0.86) continue;
      const pf = plateauField[idx];
      const df = dirtField[idx];
      const cf = creepField[idx];
      const wf = waterField[idx];
      if (pf <= -14 && wf < -6 && cf < -4 && df < -4) {
        // Tiny 2px grass tuft
        buf[idx] = GRASS_LIP;
        buf[idx - w] = GRASS_HI;
      } else if (df > 4 && cf < -4 && pf < -14) {
        // Tiny 1px dirt pebble
        buf[idx] = DIRT_HI;
      }
    }
  }

  return surface;
}
