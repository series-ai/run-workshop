/**
 * Full Environment Pack Builder:
 *  - 4 Planet Biomes (Temperate, Tundra, Volcanic, Desert) Wang-16 8x8 tilesets + 3f hazard anims + 4-way ramps + bridges
 *  - 31 Terrain Objects (Resources, Destructible Chokes, Neutral Capture Objectives, Biome Flora, Wreckage)
 *  - 12 Neutral 8-Way Units (6 Ambient Critters + 6 Creep Guardians, including 2 two-layer neutral turret/mech guardians)
 *  - Proof Sheets:
 *      * output/environment/proof-env-biomes.png    (4-biome diorama patches with objects & neutral critters/guardians!)
 *      * output/environment/proof-env-objects.png   (all 31 terrain objects + all multi-state strips)
 *      * output/environment/proof-env-neutrals.png  (all 12 neutral units across all 8 headings N..NW)
 *      * output/environment/env-manifest.json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPlanetAtlas,
  PLANET_THEMES,
  renderPlanetShowcasePatch,
  type BiomeAtlasBundle,
  type PlanetThemeId,
} from './env-tileset.ts';
import { bakeAllEnvObjects, type BakedEnvObject } from './env-objects.ts';
import { NEUTRAL_RIGS } from './env-neutrals.ts';
import {
  blitScaled,
  createSurface,
  drawEllipse,
  encodePNG,
  fillRect,
  hexToU32,
  type PixelSurface,
} from './pixel.ts';
import { SHADOW_GROUND } from './palette.ts';
import { DIRS_8 } from './units.ts';
import { bakeRigUnit, composeBakedTwoLayer } from './voxel-baker.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../output/environment');

const FONT: Readonly<Record<string, readonly string[]>> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  N: ['101', '111', '111', '101', '101'],
};

function drawBadge(dst: PixelSurface, text: string, x0: number, y0: number, scale: number, col: number): void {
  let cx = x0;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) { cx += 4 * scale; continue; }
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === '1') fillRect(dst, cx + c * scale, y0 + r * scale, scale, scale, col);
      }
    }
    cx += 4 * scale;
  }
}

function drawCheckerBg(dst: PixelSurface, x0: number, y0: number, w: number, h: number, cA: number, cB: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dst.pixels[(y0 + y) * dst.width + (x0 + x)] = (((x >> 3) + (y >> 3)) & 1) === 0 ? cA : cB;
    }
  }
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Build & export all 4 Planet Biome Tilesets
  const bundles = {} as Record<PlanetThemeId, BiomeAtlasBundle>;
  const biomeManifest: unknown[] = [];

  for (const theme of PLANET_THEMES) {
    const b = buildPlanetAtlas(theme);
    bundles[theme] = b;
    writeFileSync(resolve(OUT_DIR, `tileset-${theme}.png`), encodePNG(b.atlas));
    writeFileSync(resolve(OUT_DIR, `bridge-${theme}-h.png`), encodePNG(b.bridgeH));
    writeFileSync(resolve(OUT_DIR, `bridge-${theme}-v.png`), encodePNG(b.bridgeV));
    for (const dir of ['S', 'N', 'E', 'W'] as const) {
      writeFileSync(resolve(OUT_DIR, `ramp-${theme}-${dir}.png`), encodePNG(b.rampTiles[dir]));
    }
    // Export 3-frame hazard anim strip (32x24: 3 rows of 4x 8x8 tiles)
    const hazStrip = createSurface(32, 24, 0);
    for (let f = 0; f < 3; f++) blitScaled(hazStrip, b.hazardAnimFrames[f], 0, f * 8, 1);
    writeFileSync(resolve(OUT_DIR, `hazard-anim-${theme}.png`), encodePNG(hazStrip));

    biomeManifest.push({
      theme,
      label: b.label,
      atlas: `tileset-${theme}.png`,
      hazardAnim: `hazard-anim-${theme}.png`,
      bridgeH: `bridge-${theme}-h.png`,
      bridgeV: `bridge-${theme}-v.png`,
      ramps: {
        S: `ramp-${theme}-S.png`,
        N: `ramp-${theme}-N.png`,
        E: `ramp-${theme}-E.png`,
        W: `ramp-${theme}-W.png`,
      },
    });
  }

  // 2. Build & export all 31 Terrain Objects
  const bakedObjects = bakeAllEnvObjects();
  const objById = new Map<string, BakedEnvObject>();
  const objectManifest: unknown[] = [];

  for (const obj of bakedObjects) {
    objById.set(obj.spec.id, obj);
    const file = `obj-${obj.spec.id}.png`;
    writeFileSync(resolve(OUT_DIR, file), encodePNG(obj.strip));
    objectManifest.push({
      id: obj.spec.id,
      name: obj.spec.name,
      category: obj.spec.category,
      biome: obj.spec.biome,
      stateMode: obj.spec.stateMode,
      stateLabels: obj.spec.stateLabels,
      blocksMovement: obj.spec.blocksMovement,
      blocksVision: Boolean(obj.spec.blocksVision),
      cellW: obj.cellW,
      cellH: obj.cellH,
      frames: obj.frameSurfaces.length,
      sheet: file,
    });
  }

  // 3. Build & export all 12 Neutral 8-Way Units (with N11 & N12 as true 2-layer units!)
  const neutralManifest: unknown[] = [];
  const bakedNeutrals = NEUTRAL_RIGS.map((rig) => {
    const res = bakeRigUnit(rig, 'default');
    writeFileSync(resolve(OUT_DIR, `${rig.id}-8way.png`), encodePNG(res.sheet8Way));
    if (res.twoLayer && res.hullSheet && res.turretSheet && res.shadowSheet) {
      writeFileSync(resolve(OUT_DIR, `${rig.id}-hull.png`), encodePNG(res.hullSheet));
      writeFileSync(resolve(OUT_DIR, `${rig.id}-turret.png`), encodePNG(res.turretSheet));
      writeFileSync(resolve(OUT_DIR, `${rig.id}-shadow.png`), encodePNG(res.shadowSheet));
    }
    neutralManifest.push({
      id: rig.id,
      name: rig.name,
      role: rig.role,
      layer: rig.layer,
      twoLayer: res.twoLayer,
      cellW: res.cellW,
      cellH: res.cellH,
      cols: 12,
      sheet: `${rig.id}-8way.png`,
      ...(res.twoLayer
        ? {
            hullSheet: `${rig.id}-hull.png`,
            turretSheet: `${rig.id}-turret.png`,
            shadowSheet: `${rig.id}-shadow.png`,
          }
        : {}),
      muzzleRel8: res.muzzleRel8,
    });
    return { rig, res };
  });

  // 4. Render Proof 1: 4-Biome Living Environment Dioramas (each 160x96 patch populated with biome props & neutral units, at 2x!)
  const patchW = 160;
  const patchH = 96;
  const z = 2;
  const gap = 8;
  const dioramaProof = createSurface(patchW * z * 2 + gap * 3, patchH * z * 2 + gap * 3, hexToU32('#0d1018'));

  const stampObj = (dst: PixelSurface, id: string, x: number, y: number, frame = 0) => {
    const o = objById.get(id);
    if (!o) return;
    const f = o.frameSurfaces[frame % o.frameSurfaces.length];
    blitScaled(dst, f, x - Math.floor(f.width / 2), y - f.height, 1);
  };
  const stampNeutral = (dst: PixelSurface, id: string, dirIdx: number, x: number, y: number, col = 0) => {
    const entry = bakedNeutrals.find((n) => n.rig.id === id);
    if (!entry) return;
    const { res, rig } = entry;
    const cw = res.cellW;
    const ch = res.cellH;
    const cell = createSurface(cw, ch, 0);
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        cell.pixels[py * cw + px] = res.sheet8Way.pixels[(dirIdx * ch + py) * res.sheet8Way.width + (col * cw + px)];
      }
    }
    drawEllipse(dst, x, y + (rig.layer === 'air' ? 2 : -1), Math.max(3, Math.round(cw * 0.28)), 2, SHADOW_GROUND);
    blitScaled(dst, cell, x - Math.floor(cw / 2), y - ch + (rig.layer === 'air' ? -5 : 1), 1);
  };

  const placements: ReadonlyArray<{
    theme: PlanetThemeId;
    col: number;
    row: number;
    populate: (s: PixelSurface) => void;
  }> = [
    {
      theme: 'temperate',
      col: 0,
      row: 0,
      populate: (s) => {
        // High-ground minerals + gas + watchtower
        stampObj(s, 'mineral-blue', 30, 18, 0);
        stampObj(s, 'mineral-blue', 44, 15, 1);
        stampObj(s, 'gas-geyser', 92, 22, 0);
        stampObj(s, 'neutral-watchtower', 124, 28, 1);
        // Forest, sight-blocker reeds, mossy boulders, choke rocks, tank wreck
        stampObj(s, 'tree-pine', 12, 48);
        stampObj(s, 'tree-oak', 22, 58);
        stampObj(s, 'brush-reeds', 36, 62);
        stampObj(s, 'obstacle-rocks', 58, 56, 0);
        stampObj(s, 'wreck-tank', 136, 56);
        stampObj(s, 'prop-crates', 146, 64);
        stampObj(s, 'rock-mossy', 14, 84);
        stampObj(s, 'fallen-log', 138, 86);
        // Neutral critters + Stone Golem guardian
        stampNeutral(s, 'N01', 3, 24, 76);
        stampNeutral(s, 'N05', 2, 118, 74);
        stampNeutral(s, 'N07', 4, 108, 46);
      },
    },
    {
      theme: 'tundra',
      col: 1,
      row: 0,
      populate: (s) => {
        stampObj(s, 'mineral-blue', 34, 18, 0);
        stampObj(s, 'gas-geyser', 88, 20, 1);
        stampObj(s, 'neutral-medpad', 124, 24, 1);
        stampObj(s, 'tree-frost-pine', 14, 48);
        stampObj(s, 'tree-frost-pine', 26, 62);
        stampObj(s, 'ice-spire', 132, 46);
        stampObj(s, 'ice-spire', 146, 62);
        stampObj(s, 'obstacle-barricade', 60, 56, 0);
        stampObj(s, 'wreck-droppod', 102, 56);
        stampObj(s, 'rock-frozen', 18, 86);
        // Frost Yeti-Ram + Frost Stalker + Rogue Scrapper
        stampNeutral(s, 'N03', 3, 24, 74);
        stampNeutral(s, 'N09', 5, 116, 48);
        stampNeutral(s, 'N12', 3, 140, 82);
      },
    },
    {
      theme: 'volcanic',
      col: 0,
      row: 1,
      populate: (s) => {
        stampObj(s, 'mineral-gold', 34, 18, 0);
        stampObj(s, 'mineral-gold', 48, 16, 0);
        stampObj(s, 'magma-vent', 92, 22, 0);
        stampObj(s, 'obsidian-spire', 14, 52);
        stampObj(s, 'tree-charred', 28, 60);
        stampObj(s, 'basalt-arch', 134, 52);
        stampObj(s, 'ash-crater', 108, 58);
        stampObj(s, 'obstacle-ribwall', 60, 56, 0);
        stampObj(s, 'obsidian-spire', 146, 82);
        // Ash-Salamander + Magma Elemental + Drift-Lantern
        stampNeutral(s, 'N04', 2, 22, 74);
        stampNeutral(s, 'N08', 4, 114, 42);
        stampNeutral(s, 'N06', 3, 134, 74);
      },
    },
    {
      theme: 'desert',
      col: 1,
      row: 1,
      populate: (s) => {
        stampObj(s, 'mineral-gold', 34, 18, 0);
        stampObj(s, 'neutral-shrine', 94, 24, 1);
        stampObj(s, 'ruin-arch', 124, 26);
        stampObj(s, 'tree-palm', 18, 62);
        stampObj(s, 'tree-palm', 142, 82);
        stampObj(s, 'ruin-obelisk', 14, 42);
        stampObj(s, 'desert-cactus', 32, 72);
        stampObj(s, 'obstacle-pillar', 60, 56, 0);
        stampObj(s, 'fossil-leviathan', 132, 56);
        // Canyon Scuttler + Dune Wyrm + Auto-Sentry Relic
        stampNeutral(s, 'N02', 3, 22, 84);
        stampNeutral(s, 'N10', 5, 110, 48);
        stampNeutral(s, 'N11', 3, 130, 82);
      },
    },
  ];

  for (const pl of placements) {
    const patch = renderPlanetShowcasePatch(bundles[pl.theme]);
    pl.populate(patch);
    const dx = gap + pl.col * (patchW * z + gap);
    const dy = gap + pl.row * (patchH * z + gap);
    blitScaled(dioramaProof, patch, dx, dy, z);
    // Also export individual 1x diorama patch for interactive HTML!
    writeFileSync(resolve(OUT_DIR, `diorama-${pl.theme}.png`), encodePNG(patch));
  }
  writeFileSync(resolve(OUT_DIR, 'proof-env-biomes.png'), encodePNG(dioramaProof));

  // 5. Render Proof 2: All 31 Terrain Objects + Multi-State Strips (2x zoom on crisp dark slate checker)
  const rowH = 38;
  const maxStripW = Math.max(...bakedObjects.map((o) => o.strip.width));
  const colW = maxStripW * 2 + 16;
  const gridCols = 4;
  const gridRows = Math.ceil(bakedObjects.length / gridCols);
  const objProof = createSurface(gridCols * colW + 4, gridRows * rowH + 4, hexToU32('#10141f'));
  for (let i = 0; i < bakedObjects.length; i++) {
    const o = bakedObjects[i];
    const gc = i % gridCols;
    const gr = Math.floor(i / gridCols);
    const x0 = 2 + gc * colW;
    const y0 = 2 + gr * rowH;
    drawCheckerBg(objProof, x0 + 1, y0 + 1, colW - 2, rowH - 2, hexToU32('#232d27'), hexToU32('#1d2621'));
    const ox = x0 + Math.floor((colW - o.strip.width * 2) / 2);
    const oy = y0 + rowH - 4 - o.strip.height * 2;
    blitScaled(objProof, o.strip, ox, oy, 2);
  }
  writeFileSync(resolve(OUT_DIR, 'proof-env-objects.png'), encodePNG(objProof));

  // 6. Render Proof 3: All 12 Neutral Units x 8 Headings (N..NW at 2x zoom!)
  const labelW = 42;
  const cellW = 54;
  const cellH = 50;
  const nProof = createSurface(labelW + cellW * 8, cellH * bakedNeutrals.length, hexToU32('#10131c'));
  for (let r = 0; r < bakedNeutrals.length; r++) {
    const { rig, res } = bakedNeutrals[r];
    const y0 = r * cellH;
    fillRect(nProof, 0, y0, labelW, cellH, hexToU32('#141824'));
    drawBadge(nProof, rig.id, 6, y0 + Math.floor((cellH - 10) / 2), 2, rig.twoLayer ? hexToU32('#ffd359') : hexToU32('#a8c98a'));
    for (let d = 0; d < 8; d++) {
      const x0 = labelW + d * cellW;
      drawCheckerBg(nProof, x0, y0, cellW, cellH, hexToU32('#2a2824'), hexToU32('#23211d'));
      const frame = rig.twoLayer
        ? composeBakedTwoLayer(rig, 'SE', DIRS_8[d], 0, 1, 'default')
        : (() => {
            const c = createSurface(res.cellW, res.cellH, 0);
            for (let py = 0; py < res.cellH; py++) {
              for (let px = 0; px < res.cellW; px++) {
                c.pixels[py * res.cellW + px] = res.sheet8Way.pixels[(d * res.cellH + py) * res.sheet8Way.width + px];
              }
            }
            return c;
          })();
      drawEllipse(nProof, x0 + Math.floor(cellW / 2), y0 + cellH - 8, Math.max(6, Math.round(frame.width * 0.5)), 4, SHADOW_GROUND);
      const sx = x0 + Math.floor((cellW - frame.width * 2) / 2);
      const sy = y0 + cellH - 7 - frame.height * 2 - (rig.layer === 'air' ? 5 : 0);
      blitScaled(nProof, frame, sx, sy, 2);
      fillRect(nProof, x0, y0, 1, cellH, hexToU32('#0d1018'));
    }
    fillRect(nProof, 0, y0, nProof.width, 1, hexToU32('#0d1018'));
  }
  writeFileSync(resolve(OUT_DIR, 'proof-env-neutrals.png'), encodePNG(nProof));

  // 7. Write unified Environment Manifest
  writeFileSync(
    resolve(OUT_DIR, 'env-manifest.json'),
    JSON.stringify(
      {
        biomes: biomeManifest,
        objects: objectManifest,
        neutrals: neutralManifest,
      },
      null,
      2,
    ),
  );

  console.log(
    `Built full Environment Pack: ${PLANET_THEMES.length} biomes, ${bakedObjects.length} objects, ${bakedNeutrals.length} neutral units -> ${OUT_DIR}`,
  );
}

main();
