/**
 * CLI generator for Mixed-Scale Micro-RTS sprites:
 *  - True 8x8 Infantry (6 units, 312 frames)
 *  - 14x12 to 16x16 Centerpiece Titans, Vehicles & Flyers (6 units, 312 frames)
 *  - Ultra-Micro 4x4 Infantry (3 factions, 18 frames) for 1,000+ unit swarms
 *  - Proportionally scaled micro-buildings & 5-biome terrain
 *  - Contact proofs + 206-unit Combined-Arms Battle Proof + 1,020-unit Mega-Swarm Proof
 *  - Self-contained interactive Landscape Mobile RTS Showcase
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAllBuildings, type BuildingAsset, type BuildingId } from './buildings.ts';
import { compileMicro4Frame, getMicro4Spec, MICRO4_FACTIONS } from './micro4.ts';
import { SHADOW_GROUND, SHADOW_SOFT, type FactionId, type TeamColorId } from './palette.ts';
import {
  blitScaled,
  createSurface,
  drawEllipse,
  drawLine,
  encodePNG,
  fillRect,
  hexToU32,
  scaleSurface,
  setPixel,
  surfaceToDataURL,
  type PixelSurface,
} from './pixel.ts';
import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './terrain.ts';
import {
  buildDefaultBattleTilemap,
  buildTileset,
  composeTilemap,
  renderTilesetProof,
  TILE_PX,
  type TileMapData,
  type TilesetBundle,
} from './tileset.ts';
import {
  buildHullContactShadow,
  compileRawHull,
  compileRawTurret,
  composeIsoTank,
  CORE_H as TANK_CORE_H,
  CORE_W as TANK_CORE_W,
  HULL_PIVOT as TANK_HULL_PIVOT,
  MUZZLE_REL_8 as TANK_MUZZLE_REL_8,
  OUT_H as TANK_OUT_H,
  OUT_W as TANK_OUT_W,
} from './tankIsoPrototype.ts';
import {
  compileTitanFrame,
  getTitanAnimFrameCount,
  TITAN_SPEC_BY_ID,
  TITAN_SPECS,
  type TitanId,
} from './titans.ts';
import {
  compileUnitFrame,
  compileUnitFrame8,
  DIRS_8,
  getAnimFrameCount,
  UNIT_SPECS,
  type AnimId,
  type Dir8,
  type FacingId,
  type UnitId,
} from './units.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = resolve(__dirname, '../output');
const SPRITE_DIR = resolve(OUT_ROOT, 'sprites');

const FACINGS: readonly FacingId[] = ['SE', 'SW', 'NE', 'NW'];
const ANIMS: readonly AnimId[] = ['idle', 'move', 'attack', 'death'];

// ---------- 1. Export Sprite Sheets ----------

interface ExportedSpriteMeta {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly faction: FactionId;
  readonly attackKind: string;
  readonly layer: 'ground' | 'air';
  readonly w: number;
  readonly h: number;
  readonly airAltitude: number;
  readonly rawDataUrl: string;
  readonly outlinedDataUrl: string;
  readonly has8Way?: boolean;
  readonly raw8DataUrl?: string;
  readonly outlined8DataUrl?: string;
  readonly frameOffsets: Record<AnimId, { start: number; count: number }>;
  readonly totalCols: number;
}

interface ExportedIsoTankPayload {
  readonly coreW: number;
  readonly coreH: number;
  readonly outW: number;
  readonly outH: number;
  readonly pivots: readonly (readonly [number, number])[];
  readonly muzzles: readonly (readonly [number, number])[];
  readonly hullDataUrl: string;
  readonly turretDataUrl: string;
  readonly shadowDataUrl: string;
}

interface ExportedMicro4Meta {
  readonly faction: FactionId;
  readonly name: string;
  readonly role: string;
  readonly rawDataUrl: string;
  readonly outlinedDataUrl: string;
}

function buildUnitSheets(): ExportedSpriteMeta[] {
  const results: ExportedSpriteMeta[] = [];

  for (const spec of UNIT_SPECS) {
    const frameOffsets = {} as Record<AnimId, { start: number; count: number }>;
    let colCursor = 0;
    for (const anim of ANIMS) {
      const count = getAnimFrameCount(spec.id, anim);
      frameOffsets[anim] = { start: colCursor, count };
      colCursor += count;
    }

    const rawSheet = createSurface(colCursor * 8, FACINGS.length * 8);
    const outSheet = createSurface(colCursor * 10, FACINGS.length * 10);

    for (let r = 0; r < FACINGS.length; r++) {
      const facing = FACINGS[r];
      for (const anim of ANIMS) {
        const { start, count } = frameOffsets[anim];
        for (let f = 0; f < count; f++) {
          const compiled = compileUnitFrame(spec.id, anim, facing, f);
          blitScaled(rawSheet, compiled.raw, (start + f) * 8, r * 8, 1);
          blitScaled(outSheet, compiled.outlined, (start + f) * 10, r * 10, 1);
        }
      }
    }

    writeFileSync(resolve(SPRITE_DIR, `${spec.id}-8x8.png`), encodePNG(rawSheet));
    writeFileSync(resolve(SPRITE_DIR, `${spec.id}-outlined-10x10.png`), encodePNG(outSheet));

    let raw8DataUrl: string | undefined;
    let outlined8DataUrl: string | undefined;
    if (spec.has8Way) {
      const raw8 = createSurface(colCursor * 8, DIRS_8.length * 8);
      const out8 = createSurface(colCursor * 10, DIRS_8.length * 10);
      for (let r = 0; r < DIRS_8.length; r++) {
        const dir = DIRS_8[r];
        for (const anim of ANIMS) {
          const { start, count } = frameOffsets[anim];
          for (let f = 0; f < count; f++) {
            const compiled = compileUnitFrame8(spec.id, anim, dir, f);
            blitScaled(raw8, compiled.raw, (start + f) * 8, r * 8, 1);
            blitScaled(out8, compiled.outlined, (start + f) * 10, r * 10, 1);
          }
        }
      }
      writeFileSync(resolve(SPRITE_DIR, `${spec.id}-8way-8x8.png`), encodePNG(raw8));
      writeFileSync(resolve(SPRITE_DIR, `${spec.id}-8way-outlined-10x10.png`), encodePNG(out8));
      raw8DataUrl = surfaceToDataURL(raw8);
      outlined8DataUrl = surfaceToDataURL(out8);
    }

    results.push({
      id: spec.id,
      name: spec.name,
      role: spec.role,
      faction: spec.faction,
      attackKind: spec.attackKind,
      layer: 'ground',
      w: 8,
      h: 8,
      airAltitude: 0,
      rawDataUrl: surfaceToDataURL(rawSheet),
      outlinedDataUrl: surfaceToDataURL(outSheet),
      ...(spec.has8Way ? { has8Way: true, raw8DataUrl, outlined8DataUrl } : {}),
      frameOffsets,
      totalCols: colCursor,
    });
  }

  return results;
}

function buildTitanSheets(): ExportedSpriteMeta[] {
  const results: ExportedSpriteMeta[] = [];

  for (const spec of TITAN_SPECS) {
    const frameOffsets = {} as Record<AnimId, { start: number; count: number }>;
    let colCursor = 0;
    for (const anim of ANIMS) {
      const count = getTitanAnimFrameCount(spec.id, anim);
      frameOffsets[anim] = { start: colCursor, count };
      colCursor += count;
    }

    const rw = spec.width;
    const rh = spec.height;
    const ow = rw + 2;
    const oh = rh + 2;

    const rawSheet = createSurface(colCursor * rw, FACINGS.length * rh);
    const outSheet = createSurface(colCursor * ow, FACINGS.length * oh);

    for (let r = 0; r < FACINGS.length; r++) {
      const facing = FACINGS[r];
      for (const anim of ANIMS) {
        const { start, count } = frameOffsets[anim];
        for (let f = 0; f < count; f++) {
          const compiled = compileTitanFrame(spec.id, anim, facing, f);
          blitScaled(rawSheet, compiled.raw, (start + f) * rw, r * rh, 1);
          blitScaled(outSheet, compiled.outlined, (start + f) * ow, r * oh, 1);
        }
      }
    }

    writeFileSync(resolve(SPRITE_DIR, `${spec.id}-${rw}x${rh}.png`), encodePNG(rawSheet));
    writeFileSync(resolve(SPRITE_DIR, `${spec.id}-outlined-${ow}x${oh}.png`), encodePNG(outSheet));

    results.push({
      id: spec.id,
      name: spec.name,
      role: spec.role,
      faction: spec.faction,
      attackKind: spec.attackKind,
      layer: spec.layer,
      w: rw,
      h: rh,
      airAltitude: spec.airAltitude,
      rawDataUrl: surfaceToDataURL(rawSheet),
      outlinedDataUrl: surfaceToDataURL(outSheet),
      frameOffsets,
      totalCols: colCursor,
    });
  }

  return results;
}

function buildMicro4Sheets(): ExportedMicro4Meta[] {
  const results: ExportedMicro4Meta[] = [];
  for (const faction of MICRO4_FACTIONS) {
    const spec = getMicro4Spec(faction);
    // 3 cols (move0, move1, attack) x 2 rows (right, left)
    const rawSheet = createSurface(3 * 4, 2 * 4);
    const outSheet = createSurface(3 * 6, 2 * 6);
    for (let flip = 0; flip < 2; flip++) {
      for (let f = 0; f < 3; f++) {
        const c = compileMicro4Frame(faction, f, flip === 1);
        blitScaled(rawSheet, c.raw, f * 4, flip * 4, 1);
        blitScaled(outSheet, c.outlined, f * 6, flip * 6, 1);
      }
    }
    writeFileSync(resolve(SPRITE_DIR, `micro4-${faction}-4x4.png`), encodePNG(rawSheet));
    writeFileSync(resolve(SPRITE_DIR, `micro4-${faction}-outlined-6x6.png`), encodePNG(outSheet));
    results.push({
      faction,
      name: spec.name,
      role: spec.role,
      rawDataUrl: surfaceToDataURL(rawSheet),
      outlinedDataUrl: surfaceToDataURL(outSheet),
    });
  }
  return results;
}

function buildIsoTankPayload(): ExportedIsoTankPayload {
  const hullSheet = createSurface(4 * TANK_CORE_W, DIRS_8.length * TANK_CORE_H);
  const turretSheet = createSurface(4 * TANK_CORE_W, DIRS_8.length * TANK_CORE_H);
  const shadowSheet = createSurface(DIRS_8.length * TANK_OUT_W, TANK_OUT_H);
  for (let d = 0; d < DIRS_8.length; d++) {
    const dir = DIRS_8[d];
    blitScaled(shadowSheet, buildHullContactShadow(dir), d * TANK_OUT_W, 0, 1);
    for (let p = 0; p < 4; p++) {
      blitScaled(hullSheet, compileRawHull(dir, p), p * TANK_CORE_W, d * TANK_CORE_H, 1);
      blitScaled(turretSheet, compileRawTurret(dir, p), p * TANK_CORE_W, d * TANK_CORE_H, 1);
    }
  }
  writeFileSync(resolve(SPRITE_DIR, 'vanguard-tank-8way-hull.png'), encodePNG(hullSheet));
  writeFileSync(resolve(SPRITE_DIR, 'vanguard-tank-8way-turret.png'), encodePNG(turretSheet));
  writeFileSync(resolve(SPRITE_DIR, 'vanguard-tank-8way-shadow.png'), encodePNG(shadowSheet));
  return {
    coreW: TANK_CORE_W,
    coreH: TANK_CORE_H,
    outW: TANK_OUT_W,
    outH: TANK_OUT_H,
    pivots: DIRS_8.map((d) => TANK_HULL_PIVOT[d]),
    muzzles: DIRS_8.map((d) => TANK_MUZZLE_REL_8[d]),
    hullDataUrl: surfaceToDataURL(hullSheet),
    turretDataUrl: surfaceToDataURL(turretSheet),
    shadowDataUrl: surfaceToDataURL(shadowSheet),
  };
}

function renderVanguard8WayProof(
  tileset: TilesetBundle,
  buildings: Readonly<Record<BuildingId, BuildingAsset>>,
): PixelSurface {
  const cellW = 72;
  const cellH = 68;
  const cols = 8;
  const topRows = 3; // Row 0: 8-way Marine Idle | Row 1: 8-way Marine Move | Row 2: 8-way Marine Attack A1
  const pad = 2;
  const W = cols * cellW + (cols + 1) * pad;
  const topH = topRows * cellH + (topRows + 1) * pad;
  const stripH = 104;
  const H = topH + stripH + pad;
  const sheet = createSurface(W, H, hexToU32('#0d1018'));

  const darkBg = makeTerrainSwatch(cellW, cellH, 'dark');
  const dirtBg = makeTerrainSwatch(cellW, cellH, 'dirt');

  for (let c = 0; c < cols; c++) {
    const dir = DIRS_8[c];
    const rowSpecs: ReadonlyArray<{ row: number; anim: AnimId; frame: number; bar: number; bg: PixelSurface }> = [
      { row: 0, anim: 'idle', frame: 0, bar: hexToU32('#38bdf8'), bg: darkBg },
      { row: 1, anim: 'move', frame: 0, bar: hexToU32('#22c55e'), bg: dirtBg },
      { row: 2, anim: 'attack', frame: 1, bar: hexToU32('#f97316'), bg: darkBg },
    ];
    for (const rs of rowSpecs) {
      const cx = pad + c * (cellW + pad);
      const cy = pad + rs.row * (cellH + pad);
      blitScaled(sheet, rs.bg, cx, cy, 1);
      fillRect(sheet, cx, cy, cellW, 2, rs.bar);
      const sp = compileUnitFrame8('vanguard-trooper', rs.anim, dir, rs.frame).outlined;
      const zoom = 4;
      const ox = cx + Math.floor((cellW - sp.width * zoom) / 2);
      const oy = cy + Math.floor((cellH - sp.height * zoom) / 2) + 2;
      drawEllipse(sheet, cx + Math.floor(cellW / 2), oy + sp.height * zoom - 4, 14, 5, SHADOW_GROUND);
      blitScaled(sheet, sp, ox, oy, zoom);
    }
  }

  // Row 3: Real battle-dirt scale strip (1x native top + 2x closeup bottom): Bunker + 8-way Marines + 8-way Tank!
  const dirtCols = Math.ceil((W - pad * 2) / TILE_PX);
  const dirtRows = Math.ceil(stripH / TILE_PX);
  const dirtSurf = composeTilemap(
    {
      gridW: dirtCols + 1,
      gridH: dirtRows + 1,
      biomes: new Array((dirtCols + 1) * (dirtRows + 1)).fill('dirt' as const),
      ramps: [],
    },
    tileset,
  );
  for (let y = 0; y < stripH; y++) {
    for (let x = 0; x < W - pad * 2; x++) {
      sheet.pixels[(topH + y) * W + pad + x] = dirtSurf.pixels[y * dirtSurf.width + x];
    }
  }
  fillRect(sheet, pad, topH, W - pad * 2, 2, hexToU32('#eab308'));

  const bunker = buildings['vanguard-turret'].surface;
  // 1x native scale lineup: Bunker + 8 Marines (N..NW) + 8 Tanks (N..NW)
  const y1 = topH + 14;
  blitScaled(sheet, bunker, pad + 12, y1 + 2, 1);
  for (let i = 0; i < 8; i++) {
    const dir = DIRS_8[i];
    const mx = pad + 44 + i * 20;
    drawEllipse(sheet, mx + 5, y1 + 17, 3.4, 1.3, SHADOW_SOFT);
    blitScaled(sheet, compileUnitFrame8('vanguard-trooper', 'move', dir, 0).outlined, mx, y1 + 8, 1);
  }
  for (let i = 0; i < 8; i++) {
    const dir = DIRS_8[i];
    const tx = pad + 224 + i * 44;
    blitScaled(sheet, buildHullContactShadow(dir), tx, y1, 1);
    blitScaled(sheet, composeIsoTank(dir, dir, 0, 0), tx, y1, 1);
  }

  // 2x closeup lineup: Bunker + 8 Marines (N..NW) + NE & E Siege Tanks
  const y2 = topH + 52;
  blitScaled(sheet, bunker, pad + 12, y2 + 4, 2);
  for (let i = 0; i < 8; i++) {
    const dir = DIRS_8[i];
    const mx = pad + 72 + i * 38;
    drawEllipse(sheet, mx + 10, y2 + 34, 6.8, 2.6, SHADOW_GROUND);
    blitScaled(sheet, compileUnitFrame8('vanguard-trooper', 'move', dir, 0).outlined, mx, y2 + 16, 2);
  }
  const demoDirs: readonly Dir8[] = ['NE', 'E', 'SE'];
  for (let i = 0; i < demoDirs.length; i++) {
    const dir = demoDirs[i];
    const tx = pad + 390 + i * 62;
    blitScaled(sheet, buildHullContactShadow(dir), tx, y2 + 2, 2);
    blitScaled(sheet, composeIsoTank(dir, dir, 0, 0), tx, y2 + 2, 2);
  }

  return sheet;
}

// ---------- 2. Contact Proof Sheets (8x8 Infantry + 16x16 Titans/Flyers) ----------

function makeTerrainSwatch(w: number, h: number, kind: 'grass' | 'dirt' | 'creep' | 'dark'): PixelSurface {
  const s = createSurface(w, h);
  const cols =
    kind === 'grass'
      ? [hexToU32('#2a452e'), hexToU32('#345437'), hexToU32('#3f643e')]
      : kind === 'dirt'
        ? [hexToU32('#5a4336'), hexToU32('#6d5340'), hexToU32('#7f634a')]
        : kind === 'creep'
          ? [hexToU32('#2d1335'), hexToU32('#3f1b44'), hexToU32('#532554')]
          : [hexToU32('#171b26'), hexToU32('#1c2230'), hexToU32('#1a1f2c')];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const h2 = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const tile = (((x >> 3) + (y >> 3)) & 1) === 0;
      const pick = h2 % 7 === 0 ? 2 : tile ? 1 : 0;
      s.pixels[y * w + x] = cols[pick];
    }
  }
  return s;
}

function accentBar(faction: FactionId): number {
  return faction === 'vanguard'
    ? hexToU32('#4da6ff')
    : faction === 'kraxen'
      ? hexToU32('#e048a8')
      : hexToU32('#f5c43d');
}

function renderSpriteContactProof(buildings: Readonly<Record<BuildingId, BuildingAsset>>): PixelSurface {
  const cellW = 76;
  const cellH = 74;
  const cols = 8;
  const rows = UNIT_SPECS.length + 1;
  const pad = 2;
  const W = cols * cellW + (cols + 1) * pad;
  const H = rows * cellH + (rows + 1) * pad;
  const sheet = createSurface(W, H, hexToU32('#0d1018'));

  const darkBg = makeTerrainSwatch(cellW, cellH, 'dark');
  const grassBg = makeTerrainSwatch(cellW, cellH, 'grass');
  const dirtBg = makeTerrainSwatch(cellW, cellH, 'dirt');
  const creepBg = makeTerrainSwatch(cellW, cellH, 'creep');

  for (let r = 0; r < UNIT_SPECS.length; r++) {
    const spec = UNIT_SPECS[r];
    const biomeBg =
      spec.faction === 'vanguard' ? grassBg : spec.faction === 'kraxen' ? creepBg : dirtBg;
    const barCol = accentBar(spec.faction);

    for (let c = 0; c < cols; c++) {
      const cx = pad + c * (cellW + pad);
      const cy = pad + r * (cellH + pad);
      const bg = c === 5 || c === 6 ? biomeBg : darkBg;
      blitScaled(sheet, bg, cx, cy, 1);
      fillRect(sheet, cx, cy, cellW, 2, barCol);

      if (c === 0) {
        const f = compileUnitFrame(spec.id, 'idle', 'SE', 0).outlined;
        drawEllipse(sheet, cx + 38, cy + 58, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else if (c === 1) {
        const f = compileUnitFrame(spec.id, 'move', 'SE', 0).outlined;
        drawEllipse(sheet, cx + 38, cy + 58, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else if (c === 2) {
        const f = compileUnitFrame(spec.id, 'attack', 'SE', 1).outlined;
        drawEllipse(sheet, cx + 38, cy + 58, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else if (c === 3) {
        const f = compileUnitFrame(spec.id, 'idle', 'NE', 0).outlined;
        drawEllipse(sheet, cx + 38, cy + 58, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else if (c === 4) {
        const f = compileUnitFrame(spec.id, 'death', 'SE', 1).outlined;
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else if (c === 5) {
        const f = compileUnitFrame(spec.id, 'attack', 'SE', 1).raw;
        drawEllipse(sheet, cx + 38, cy + 57, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 14, cy + 13, 6);
      } else if (c === 6) {
        const f = compileUnitFrame(spec.id, 'attack', 'SE', 1).outlined;
        drawEllipse(sheet, cx + 38, cy + 58, 19, 6, SHADOW_GROUND);
        blitScaled(sheet, f, cx + 8, cy + 7, 6);
      } else {
        const teams: readonly TeamColorId[] = ['crimson', 'emerald'];
        for (let t = 0; t < teams.length; t++) {
          const f = compileUnitFrame(spec.id, 'idle', 'SE', 0, teams[t]).outlined;
          const ox = cx + 6 + t * 34;
          drawEllipse(sheet, ox + 15, cy + 48, 10, 4, SHADOW_GROUND);
          blitScaled(sheet, f, ox, cy + 21, 3);
        }
      }
    }
  }

  // Bottom Row: Buildings + 2x Squad + 1x Micro Swarm
  const bRowY = pad + UNIT_SPECS.length * (cellH + pad);
  const buildingStrip: readonly BuildingId[] = [
    'vanguard-bastion',
    'vanguard-turret',
    'kraxen-spire',
    'kraxen-colony',
    'solaris-nexus',
    'solaris-pylon',
  ];

  for (let i = 0; i < buildingStrip.length; i++) {
    const b = buildings[buildingStrip[i]];
    const cx = pad + i * (cellW + pad);
    const bg = b.faction === 'vanguard' ? grassBg : b.faction === 'kraxen' ? creepBg : dirtBg;
    blitScaled(sheet, bg, cx, bRowY, 1);
    fillRect(sheet, cx, bRowY, cellW, 2, hexToU32('#94a3b8'));
    const zoom = 2;
    const bw = b.surface.width * zoom;
    const bh = b.surface.height * zoom;
    const ox = cx + Math.floor((cellW - bw) / 2);
    const oy = bRowY + Math.floor((cellH - bh) / 2) + 2;
    drawEllipse(sheet, cx + Math.floor(cellW / 2), oy + bh - 4, b.shadowRx * 2, b.shadowRy * 2, SHADOW_GROUND);
    blitScaled(sheet, b.surface, ox, oy, zoom);
  }

  // Col 6: 2x micro-squad
  {
    const cx = pad + 6 * (cellW + pad);
    blitScaled(sheet, dirtBg, cx, bRowY, 1);
    fillRect(sheet, cx, bRowY, cellW, 2, hexToU32('#22c55e'));
    const placements: ReadonlyArray<{ id: UnitId; x: number; y: number; f: FacingId; a: AnimId }> = [
      { id: 'vanguard-trooper', x: 6, y: 14, f: 'SE', a: 'attack' },
      { id: 'vanguard-trooper', x: 4, y: 34, f: 'SE', a: 'move' },
      { id: 'vanguard-heavy', x: 12, y: 50, f: 'SE', a: 'attack' },
      { id: 'solaris-blade', x: 30, y: 10, f: 'SE', a: 'attack' },
      { id: 'solaris-arcanist', x: 32, y: 46, f: 'SE', a: 'attack' },
      { id: 'kraxen-swarmling', x: 50, y: 18, f: 'SW', a: 'attack' },
      { id: 'kraxen-stalker', x: 52, y: 36, f: 'SW', a: 'attack' },
      { id: 'kraxen-swarmling', x: 48, y: 52, f: 'SW', a: 'move' },
    ];
    for (const p of placements) {
      const sp = compileUnitFrame(p.id, p.a, p.f, 1).outlined;
      drawEllipse(sheet, cx + p.x + 10, bRowY + p.y + 18, 6, 2.5, SHADOW_GROUND);
      blitScaled(sheet, sp, cx + p.x, bRowY + p.y, 2);
    }
  }

  // Col 7: 1x native scale dense micro-swarm
  {
    const cx = pad + 7 * (cellW + pad);
    blitScaled(sheet, grassBg, cx, bRowY, 1);
    fillRect(sheet, cx, bRowY, cellW, 2, hexToU32('#38bdf8'));
    const miniRow: readonly UnitId[] = [
      'vanguard-trooper',
      'vanguard-heavy',
      'solaris-blade',
      'solaris-arcanist',
      'kraxen-stalker',
      'kraxen-swarmling',
    ];
    for (let u = 0; u < 18; u++) {
      const id = miniRow[u % miniRow.length];
      const col = u % 6;
      const row = Math.floor(u / 6);
      const ux = cx + 6 + col * 11;
      const uy = bRowY + 14 + row * 19;
      const facing: FacingId = id.startsWith('kraxen') ? 'SW' : 'SE';
      const frame = compileUnitFrame(id, 'idle', facing, 0).outlined;
      drawEllipse(sheet, ux + 5, uy + 9, 3.5, 1.5, SHADOW_GROUND);
      blitScaled(sheet, frame, ux, uy, 1);
    }
  }

  return sheet;
}

function renderTitansContactProof(): PixelSurface {
  const cellW = 86;
  const cellH = 84;
  const cols = 7;
  const rows = TITAN_SPECS.length;
  const pad = 2;
  const W = cols * cellW + (cols + 1) * pad;
  const H = rows * cellH + (rows + 1) * pad;
  const sheet = createSurface(W, H, hexToU32('#0d1018'));

  const darkBg = makeTerrainSwatch(cellW, cellH, 'dark');
  const grassBg = makeTerrainSwatch(cellW, cellH, 'grass');
  const dirtBg = makeTerrainSwatch(cellW, cellH, 'dirt');
  const creepBg = makeTerrainSwatch(cellW, cellH, 'creep');

  const infantryByFaction: Record<FactionId, UnitId> = {
    vanguard: 'vanguard-trooper',
    kraxen: 'kraxen-stalker',
    solaris: 'solaris-blade',
  };

  // Cols: [0] SE Idle 4x | [1] SE Move/Flap 4x | [2] SE Attack 4x | [3] NE Back 4x
  //       [4] Death 4x | [5] On-Biome 4x | [6] Scale Ladder (16x16 Titan + 8x8 + 4x4 at 2x!)
  for (let r = 0; r < TITAN_SPECS.length; r++) {
    const spec = TITAN_SPECS[r];
    const biomeBg =
      spec.faction === 'vanguard' ? grassBg : spec.faction === 'kraxen' ? creepBg : dirtBg;
    const barCol = accentBar(spec.faction);

    const drawCentered = (
      cx: number,
      cy: number,
      surf: PixelSurface,
      zoom: number,
      showShadow: boolean,
    ) => {
      const sw = surf.width * zoom;
      const sh = surf.height * zoom;
      const ox = cx + Math.floor((cellW - sw) / 2);
      const oy = cy + Math.floor((cellH - sh) / 2) + (spec.layer === 'air' ? -4 : 2);
      if (showShadow) {
        const sy = spec.layer === 'air' ? cy + cellH - 12 : oy + sh - 5;
        drawEllipse(
          sheet,
          cx + Math.floor(cellW / 2),
          sy,
          spec.shadowRx * zoom * 0.72,
          spec.shadowRy * zoom * 0.72,
          SHADOW_GROUND,
        );
      }
      blitScaled(sheet, surf, ox, oy, zoom);
    };

    for (let c = 0; c < cols; c++) {
      const cx = pad + c * (cellW + pad);
      const cy = pad + r * (cellH + pad);
      const bg = c === 5 || c === 6 ? biomeBg : darkBg;
      blitScaled(sheet, bg, cx, cy, 1);
      fillRect(sheet, cx, cy, cellW, 2, barCol);

      if (c === 0) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'idle', 'SE', 0).outlined, 4, true);
      } else if (c === 1) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'move', 'SE', 2).outlined, 4, true);
      } else if (c === 2) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'attack', 'SE', 1).outlined, 4, true);
      } else if (c === 3) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'idle', 'NE', 0).outlined, 4, true);
      } else if (c === 4) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'death', 'SE', 0).outlined, 4, false);
      } else if (c === 5) {
        drawCentered(cx, cy, compileTitanFrame(spec.id, 'attack', 'SE', 1).outlined, 4, true);
      } else {
        // Scale Ladder at 2x zoom: Titan (16x16) next to Infantry (8x8) next to Ultra-Micro (4x4)!
        const titanSp = compileTitanFrame(spec.id, 'idle', 'SE', 0).outlined;
        const infSp = compileUnitFrame(infantryByFaction[spec.faction], 'idle', 'SE', 0).outlined;
        const m4Sp = compileMicro4Frame(spec.faction, 0, false).outlined;

        const baseLine = cy + cellH - 18;
        // Titan left
        drawEllipse(sheet, cx + 22, baseLine, spec.shadowRx * 1.8, spec.shadowRy * 1.8, SHADOW_GROUND);
        blitScaled(
          sheet,
          titanSp,
          cx + 4,
          baseLine - titanSp.height * 2 - (spec.layer === 'air' ? 14 : 0) + 4,
          2,
        );
        // 8x8 Infantry center-right
        drawEllipse(sheet, cx + 52, baseLine, 7, 2.5, SHADOW_GROUND);
        blitScaled(sheet, infSp, cx + 42, baseLine - infSp.height * 2 + 2, 2);
        // 4x4 Ultra-Micro far-right
        drawEllipse(sheet, cx + 72, baseLine, 4.5, 1.8, SHADOW_GROUND);
        blitScaled(sheet, m4Sp, cx + 66, baseLine - m4Sp.height * 2 + 2, 2);
      }
    }
  }

  return sheet;
}

// ---------- 3. Shared Map Buildings & Battle Proof Renderers ----------

interface StaticBuildingPlacement {
  readonly id: BuildingId;
  readonly x: number;
  readonly y: number;
}

const MAP_BUILDINGS: readonly StaticBuildingPlacement[] = [
  // West Vanguard Base
  { id: 'vanguard-bastion', x: 92, y: 152 },
  { id: 'vanguard-turret', x: 132, y: 126 },
  { id: 'vanguard-turret', x: 136, y: 188 },
  { id: 'mineral-cluster', x: 74, y: 122 },
  { id: 'mineral-cluster', x: 66, y: 140 },
  { id: 'mineral-cluster', x: 74, y: 184 },

  // North Solaris Ridge Base
  { id: 'solaris-nexus', x: 256, y: 66 },
  { id: 'solaris-pylon', x: 222, y: 74 },
  { id: 'solaris-pylon', x: 292, y: 74 },
  { id: 'mineral-cluster', x: 234, y: 50 },
  { id: 'mineral-cluster', x: 280, y: 50 },

  // East Kraxen Brood Base
  { id: 'kraxen-spire', x: 420, y: 156 },
  { id: 'kraxen-colony', x: 380, y: 124 },
  { id: 'kraxen-colony', x: 378, y: 192 },
  { id: 'mineral-cluster', x: 438, y: 128 },
  { id: 'mineral-cluster', x: 444, y: 184 },

  // Props
  { id: 'pine-tree', x: 108, y: 104 },
  { id: 'pine-tree', x: 96, y: 112 },
  { id: 'pine-tree', x: 116, y: 214 },
  { id: 'pine-tree', x: 144, y: 224 },
  { id: 'pine-tree', x: 162, y: 232 },
  { id: 'rock-crag', x: 162, y: 104 },
  { id: 'rock-crag', x: 348, y: 104 },
  { id: 'rock-crag', x: 346, y: 226 },
];

interface KeyframeTitan {
  readonly id: TitanId;
  readonly faction: FactionId;
  readonly x: number;
  readonly y: number;
  readonly facing: FacingId;
  readonly hullDir?: Dir8;
  readonly turretDir?: Dir8;
  readonly anim: AnimId;
  readonly frame: number;
}

const KEYFRAME_TITANS: readonly KeyframeTitan[] = [
  // Vanguard 8-Way Split-Hull Siege Tanks & Valkyrie Gunships
  { id: 'vanguard-tank', faction: 'vanguard', x: 158, y: 142, facing: 'SE', hullDir: 'NE', turretDir: 'E', anim: 'attack', frame: 1 },
  { id: 'vanguard-tank', faction: 'vanguard', x: 154, y: 176, facing: 'SE', hullDir: 'E', turretDir: 'E', anim: 'attack', frame: 1 },
  { id: 'vanguard-tank', faction: 'vanguard', x: 176, y: 204, facing: 'SE', hullDir: 'SE', turretDir: 'NE', anim: 'move', frame: 0 },
  { id: 'vanguard-gunship', faction: 'vanguard', x: 198, y: 132, facing: 'SE', anim: 'attack', frame: 1 },
  { id: 'vanguard-gunship', faction: 'vanguard', x: 192, y: 186, facing: 'SE', anim: 'move', frame: 0 },

  // Kraxen Brood Behemoths & Bio-Wyverns
  { id: 'kraxen-behemoth', faction: 'kraxen', x: 292, y: 156, facing: 'SW', anim: 'attack', frame: 1 },
  { id: 'kraxen-behemoth', faction: 'kraxen', x: 306, y: 192, facing: 'SW', anim: 'attack', frame: 1 },
  { id: 'kraxen-behemoth', faction: 'kraxen', x: 344, y: 148, facing: 'SW', anim: 'move', frame: 0 },
  { id: 'kraxen-wyvern', faction: 'kraxen', x: 332, y: 122, facing: 'SW', anim: 'attack', frame: 1 },
  { id: 'kraxen-wyvern', faction: 'kraxen', x: 356, y: 178, facing: 'SW', anim: 'move', frame: 0 },
  { id: 'kraxen-wyvern', faction: 'kraxen', x: 316, y: 208, facing: 'NW', anim: 'move', frame: 2 },

  // Solaris Thermal Colossi & Sky-Carriers (left Colossus faces SW to match its left-bound beam!)
  { id: 'solaris-colossus', faction: 'solaris', x: 234, y: 122, facing: 'SW', anim: 'attack', frame: 1 },
  { id: 'solaris-colossus', faction: 'solaris', x: 278, y: 124, facing: 'SE', anim: 'attack', frame: 1 },
  { id: 'solaris-carrier', faction: 'solaris', x: 256, y: 100, facing: 'SE', anim: 'idle', frame: 0 },
  { id: 'solaris-carrier', faction: 'solaris', x: 214, y: 108, facing: 'SW', anim: 'idle', frame: 1 },
];

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawCombinedArmsOverlay(
  frame: PixelSurface,
  camX: number,
  camY: number,
  titans: readonly KeyframeTitan[],
): void {
  const PSI_CYN = hexToU32('#2ce8f5');
  const PSI_HOT = hexToU32('#f0ffff');
  const TRACER_ORG = hexToU32('#ff922b');
  const TRACER_HOT = hexToU32('#fff6cc');
  const BLAST_RED = hexToU32('#ff4d2e');
  const ACID_GRN = hexToU32('#8cff2e');
  const ACID_HOT = hexToU32('#ebffb3');
  const GOLD = hexToU32('#ffe066');

  // Sweeping thermal beams from Solaris Colossi attached directly to their drawn A1 emitters!
  for (const t of titans) {
    if (t.id === 'solaris-colossus' && t.anim === 'attack') {
      const dir = t.facing === 'SW' || t.facing === 'NW' ? -1 : 1;
      // Outlined 18x18 sprite draws at (t.x - camX - 9, t.y - camY - 16);
      // SE emitter sits at outlined x=15 (+6), SW mirrored emitter sits at outlined x=2 (-7), y=5 (-11).
      const sx = t.x - camX + (dir < 0 ? -7 : 6);
      const sy = t.y - camY - 11;
      const tx = dir < 0 ? 196 - camX : 302 - camX;
      const ty = dir < 0 ? 162 - camY : 164 - camY;
      drawLine(frame, sx, sy, tx, ty, PSI_CYN);
      // Bright origin flare directly on the drawn emitter pixel
      setPixel(frame, sx, sy, PSI_HOT);
      setPixel(frame, sx, sy + 1, PSI_CYN);
      // Crisp ground scorch impact
      fillRect(frame, tx - 1, ty - 1, 3, 2, PSI_CYN);
      setPixel(frame, tx, ty, PSI_HOT);
    } else if (t.id === 'vanguard-tank' && t.anim === 'attack') {
      // Heavy fiery artillery shell originating from the exact 8-way A1 muzzle flash pixel!
      const hDir: Dir8 = t.hullDir ?? 'E';
      const tDir: Dir8 = t.turretDir ?? 'E';
      const [px, py] = TANK_HULL_PIVOT[hDir];
      const [mx, my] = TANK_MUZZLE_REL_8[tDir];
      const sx = Math.round(t.x - camX - TANK_OUT_W / 2) + 1 + px + mx;
      const sy = Math.round(t.y - camY - TANK_OUT_H + 5) + 1 + py + my;
      const bx = t.y < 160 ? 276 - camX : 284 - camX;
      const by = t.y < 160 ? 150 - camY : 184 - camY;
      drawLine(frame, sx, sy, bx, by, TRACER_ORG);
      drawEllipse(frame, bx, by, 4.5, 3.2, BLAST_RED);
      drawEllipse(frame, bx, by, 2.8, 2.0, TRACER_ORG);
      fillRect(frame, bx - 1, by - 1, 2, 2, TRACER_HOT);
    } else if (t.id === 'kraxen-wyvern' && t.anim === 'attack') {
      const sx = t.x - camX - 6;
      const sy = t.y - camY - 15 - 4;
      const tx = 274 - camX;
      const ty = 132 - camY;
      drawLine(frame, sx, sy, tx, ty, ACID_GRN);
      fillRect(frame, tx - 1, ty - 1, 2, 2, ACID_HOT);
    } else if (t.id === 'solaris-carrier') {
      // Orbiting 3x3 golden-cyan interceptor drones!
      const offsets: readonly (readonly [number, number])[] = [
        [-18, 12],
        [16, 16],
        [6, 26],
        [-10, 24],
      ];
      for (const [ox, oy] of offsets) {
        const ix = Math.round(t.x - camX + ox);
        const iy = Math.round(t.y - camY - 16 + oy);
        setPixel(frame, ix, iy, GOLD);
        setPixel(frame, ix + 1, iy, PSI_CYN);
        setPixel(frame, ix - 1, iy, PSI_HOT);
      }
    }
  }
}

function renderCombinedArmsProof(
  terrain: PixelSurface,
  buildings: Readonly<Record<BuildingId, BuildingAsset>>,
): { surface2x: PixelSurface; totalCount: number } {
  const camX = Math.floor((WORLD_W - VIEW_W) / 2);
  const camY = Math.floor((WORLD_H - VIEW_H) / 2) - 4;
  const frame = createSurface(VIEW_W, VIEW_H);

  for (let y = 0; y < VIEW_H; y++) {
    const sy = y + camY;
    for (let x = 0; x < VIEW_W; x++) {
      frame.pixels[y * VIEW_W + x] = terrain.pixels[sy * WORLD_W + (x + camX)];
    }
  }

  // Generate 188 8x8 infantry around the Titans
  const rand = seededRand(882026);
  interface InfUnit {
    id: UnitId;
    faction: FactionId;
    x: number;
    y: number;
    facing: FacingId;
    dir8?: Dir8;
    anim: AnimId;
    frame: number;
  }
  const inf: InfUnit[] = [];
  const addSquad = (
    id: UnitId,
    faction: FactionId,
    cx: number,
    cy: number,
    count: number,
    sx: number,
    sy: number,
    facing: FacingId,
    atk: number,
    dir8?: Dir8,
  ) => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * (sx / Math.max(1, sy)))));
    const rows = Math.ceil(count / cols);
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const u = cols > 1 ? col / (cols - 1) - 0.5 : 0;
      const v = rows > 1 ? row / (rows - 1) - 0.5 : 0;
      const anim: AnimId = rand() < atk ? 'attack' : 'move';
      inf.push({
        id,
        faction,
        x: cx + u * sx + (rand() - 0.5) * 7,
        y: cy + v * sy + (rand() - 0.5) * 6,
        facing,
        dir8,
        anim,
        frame: anim === 'attack' ? 1 : Math.floor(rand() * 4),
      });
    }
  };

  addSquad('vanguard-trooper', 'vanguard', 188, 156, 22, 34, 38, 'SE', 0.72, 'E');
  addSquad('vanguard-trooper', 'vanguard', 188, 126, 8, 22, 14, 'NE', 0.55, 'N');
  addSquad('vanguard-heavy', 'vanguard', 176, 198, 12, 34, 22, 'SE', 0.6);
  addSquad('vanguard-trooper', 'vanguard', 138, 158, 10, 22, 30, 'SE', 0.25, 'SE');

  addSquad('kraxen-swarmling', 'kraxen', 298, 162, 40, 48, 56, 'SW', 0.76);
  addSquad('kraxen-stalker', 'kraxen', 344, 158, 24, 34, 52, 'SW', 0.78);
  addSquad('kraxen-swarmling', 'kraxen', 322, 208, 16, 40, 20, 'NW', 0.45);

  addSquad('solaris-blade', 'solaris', 252, 140, 22, 54, 26, 'SE', 0.8);
  addSquad('solaris-arcanist', 'solaris', 256, 108, 14, 52, 16, 'SE', 0.75);

  const groundTitans = KEYFRAME_TITANS.filter((t) => TITAN_SPEC_BY_ID[t.id].layer === 'ground');
  const airTitans = KEYFRAME_TITANS.filter((t) => TITAN_SPEC_BY_ID[t.id].layer === 'air');

  // Guarantee zero outlined sprite-box overlap between any infantry (10x10) and any ground Titan!
  for (let i = inf.length - 1; i >= 0; i--) {
    const u = inf[i];
    const ux0 = Math.round(u.x - 5);
    const uy0 = Math.round(u.y - 9);
    const ux1 = ux0 + 10;
    const uy1 = uy0 + 10;
    const overlaps = groundTitans.some((t) => {
      const sp = TITAN_SPEC_BY_ID[t.id];
      const tw = sp.width + 2;
      const th = sp.height + 2;
      const tx0 = Math.round(t.x - tw / 2) - 1;
      const ty0 = Math.round(t.y - th + 2) - 1;
      const tx1 = tx0 + tw + 2;
      const ty1 = ty0 + th + 2;
      return ux0 < tx1 && ux1 > tx0 && uy0 < ty1 && uy1 > ty0;
    });
    if (overlaps) inf.splice(i, 1);
  }

  // Ground layer shadows
  for (const b of MAP_BUILDINGS) {
    const a = buildings[b.id];
    drawEllipse(frame, b.x - camX, b.y - camY, a.shadowRx, a.shadowRy, SHADOW_GROUND);
  }
  for (const u of inf) {
    drawEllipse(frame, u.x - camX, u.y - camY, 3.4, 1.3, SHADOW_SOFT);
  }
  for (const t of groundTitans) {
    if (t.id === 'vanguard-tank') {
      const hDir: Dir8 = t.hullDir ?? 'E';
      const sh = buildHullContactShadow(hDir);
      blitScaled(frame, sh, Math.round(t.x - camX - TANK_OUT_W / 2), Math.round(t.y - camY - TANK_OUT_H + 5), 1);
    } else {
      const sp = TITAN_SPEC_BY_ID[t.id];
      drawEllipse(frame, t.x - camX, t.y - camY, sp.shadowRx, sp.shadowRy, SHADOW_GROUND);
    }
  }
  // Air unit shadows projected on the ground below!
  for (const t of airTitans) {
    const sp = TITAN_SPEC_BY_ID[t.id];
    drawEllipse(frame, t.x - camX + 3, t.y - camY + 3, sp.shadowRx, sp.shadowRy, SHADOW_SOFT);
  }

  // Y-sorted ground pass (buildings + 8x8 infantry + 16x16 ground Titans)
  type GroundItem =
    | { kind: 'b'; y: number; b: StaticBuildingPlacement }
    | { kind: 'u'; y: number; u: InfUnit }
    | { kind: 't'; y: number; t: KeyframeTitan };

  const gItems: GroundItem[] = [
    ...MAP_BUILDINGS.map((b) => ({ kind: 'b' as const, y: b.y, b })),
    ...inf.map((u) => ({ kind: 'u' as const, y: u.y, u })),
    ...groundTitans.map((t) => ({ kind: 't' as const, y: t.y, t })),
  ];
  gItems.sort((a, b) => a.y - b.y);

  for (const item of gItems) {
    if (item.kind === 'b') {
      const a = buildings[item.b.id];
      blitScaled(frame, a.surface, Math.round(item.b.x - camX - a.anchorX), Math.round(item.b.y - camY - a.anchorY), 1);
    } else if (item.kind === 'u') {
      const sp =
        item.u.id === 'vanguard-trooper' && item.u.dir8
          ? compileUnitFrame8(item.u.id, item.u.anim, item.u.dir8, item.u.frame).outlined
          : compileUnitFrame(item.u.id, item.u.anim, item.u.facing, item.u.frame).outlined;
      blitScaled(frame, sp, Math.round(item.u.x - camX - 5), Math.round(item.u.y - camY - 9), 1);
    } else if (item.t.id === 'vanguard-tank') {
      const hDir: Dir8 = item.t.hullDir ?? 'E';
      const tDir: Dir8 = item.t.turretDir ?? 'E';
      const atkF = item.t.anim === 'attack' ? item.t.frame : 0;
      const sp = composeIsoTank(hDir, tDir, 0, atkF);
      blitScaled(
        frame,
        sp,
        Math.round(item.t.x - camX - TANK_OUT_W / 2),
        Math.round(item.t.y - camY - TANK_OUT_H + 5),
        1,
      );
    } else {
      const sp = compileTitanFrame(item.t.id, item.t.anim, item.t.facing, item.t.frame).outlined;
      blitScaled(
        frame,
        sp,
        Math.round(item.t.x - camX - sp.width / 2),
        Math.round(item.t.y - camY - sp.height + 2),
        1,
      );
    }
  }

  // Infantry tracers + Titan special weapon beams/blasts
  const TRACER_ORG = hexToU32('#ff922b');
  const TRACER_HOT = hexToU32('#fff6cc');
  const ACID_GRN = hexToU32('#8cff2e');
  const vanAtk = inf.filter((u) => u.faction === 'vanguard' && u.anim === 'attack');
  const krxAtk = inf.filter((u) => u.faction === 'kraxen' && u.anim === 'attack');
  for (let i = 0; i < vanAtk.length; i += 3) {
    const s = vanAtk[i];
    const d = krxAtk[i % krxAtk.length];
    if (!d) continue;
    const x0 = s.x - camX + 3;
    const y0 = s.y - camY - 4;
    const x1 = d.x - camX;
    const y1 = d.y - camY - 4;
    const ax = x0 + (x1 - x0) * 0.25;
    const ay = y0 + (y1 - y0) * 0.25;
    const bx = x0 + (x1 - x0) * 0.55;
    const by = y0 + (y1 - y0) * 0.55;
    drawLine(frame, ax, ay, bx, by, TRACER_ORG);
    setPixel(frame, bx, by, TRACER_HOT);
  }
  for (let i = 0; i < krxAtk.length; i += 6) {
    const s = krxAtk[i];
    if (s.id !== 'kraxen-stalker') continue;
    const d = vanAtk[i % vanAtk.length];
    if (!d) continue;
    const x0 = s.x - camX - 3;
    const y0 = s.y - camY - 4;
    const x1 = d.x - camX;
    const y1 = d.y - camY - 4;
    drawLine(frame, x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2, x0 + (x1 - x0) * 0.36, y0 + (y1 - y0) * 0.36, ACID_GRN);
  }

  drawCombinedArmsOverlay(frame, camX, camY, KEYFRAME_TITANS);

  // Air layer flyers rendered ABOVE ground combat & beams!
  airTitans.sort((a, b) => a.y - b.y);
  for (const t of airTitans) {
    const meta = TITAN_SPEC_BY_ID[t.id];
    const sp = compileTitanFrame(t.id, t.anim, t.facing, t.frame).outlined;
    blitScaled(
      frame,
      sp,
      Math.round(t.x - camX - sp.width / 2),
      Math.round(t.y - camY - sp.height / 2 - meta.airAltitude),
      1,
    );
  }

  return { surface2x: scaleSurface(frame, 2), totalCount: inf.length + KEYFRAME_TITANS.length };
}

function renderUltra1000Proof(
  terrain: PixelSurface,
  buildings: Readonly<Record<BuildingId, BuildingAsset>>,
): { surface2x: PixelSurface; totalCount: number } {
  const camX = Math.floor((WORLD_W - VIEW_W) / 2);
  const camY = Math.floor((WORLD_H - VIEW_H) / 2) - 4;
  const frame = createSurface(VIEW_W, VIEW_H);

  for (let y = 0; y < VIEW_H; y++) {
    const sy = y + camY;
    for (let x = 0; x < VIEW_W; x++) {
      frame.pixels[y * VIEW_W + x] = terrain.pixels[sy * WORLD_W + (x + camX)];
    }
  }

  const rand = seededRand(100044);
  interface TinyUnit {
    faction: FactionId;
    x: number;
    y: number;
    flip: boolean;
    f: number;
  }
  const tiny: TinyUnit[] = [];

  // 1,005 crisp 4x4 micro-soldiers in sweeping continental formations!
  const addWave = (
    faction: FactionId,
    cx: number,
    cy: number,
    count: number,
    rx: number,
    ry: number,
    flip: boolean,
  ) => {
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand());
      const x = cx + Math.cos(a) * rx * rad;
      const y = cy + Math.sin(a) * ry * rad;
      tiny.push({ faction, x, y, flip, f: Math.floor(rand() * 3) });
    }
  };

  addWave('vanguard', 168, 162, 340, 56, 52, false);
  addWave('kraxen', 342, 166, 430, 66, 56, true);
  addWave('solaris', 254, 128, 235, 62, 32, false);

  const groundTitans = KEYFRAME_TITANS.filter((t) => TITAN_SPEC_BY_ID[t.id].layer === 'ground');
  const airTitans = KEYFRAME_TITANS.filter((t) => TITAN_SPEC_BY_ID[t.id].layer === 'air');

  // Keep a 9-native-pixel clearance around ground Titan anchors in the 1,000-unit swarm too
  for (let i = tiny.length - 1; i >= 0; i--) {
    const u = tiny[i];
    const blocked = groundTitans.some((t) => Math.hypot(u.x - t.x, u.y - t.y) < 9.0);
    if (blocked) tiny.splice(i, 1);
  }

  // Pre-compile 4x4 frames for ultra-fast blitting
  const cache4: Record<string, PixelSurface> = {};
  for (const f of MICRO4_FACTIONS) {
    for (let flip = 0; flip < 2; flip++) {
      for (let idx = 0; idx < 3; idx++) {
        cache4[`${f}-${flip}-${idx}`] = compileMicro4Frame(f, idx, flip === 1).outlined;
      }
    }
  }

  for (const b of MAP_BUILDINGS) {
    const a = buildings[b.id];
    drawEllipse(frame, b.x - camX, b.y - camY, a.shadowRx, a.shadowRy, SHADOW_GROUND);
  }
  for (const t of groundTitans) {
    if (t.id === 'vanguard-tank') {
      const hDir: Dir8 = t.hullDir ?? 'E';
      const sh = buildHullContactShadow(hDir);
      blitScaled(frame, sh, Math.round(t.x - camX - TANK_OUT_W / 2), Math.round(t.y - camY - TANK_OUT_H + 5), 1);
    } else {
      const sp = TITAN_SPEC_BY_ID[t.id];
      drawEllipse(frame, t.x - camX, t.y - camY, sp.shadowRx, sp.shadowRy, SHADOW_GROUND);
    }
  }
  for (const t of airTitans) {
    const sp = TITAN_SPEC_BY_ID[t.id];
    drawEllipse(frame, t.x - camX + 3, t.y - camY + 3, sp.shadowRx, sp.shadowRy, SHADOW_SOFT);
  }

  type GItem =
    | { kind: 'b'; y: number; b: StaticBuildingPlacement }
    | { kind: 'm'; y: number; m: TinyUnit }
    | { kind: 't'; y: number; t: KeyframeTitan };

  const gItems: GItem[] = [
    ...MAP_BUILDINGS.map((b) => ({ kind: 'b' as const, y: b.y, b })),
    ...tiny.map((m) => ({ kind: 'm' as const, y: m.y, m })),
    ...groundTitans.map((t) => ({ kind: 't' as const, y: t.y, t })),
  ];
  gItems.sort((a, b) => a.y - b.y);

  for (const item of gItems) {
    if (item.kind === 'b') {
      const a = buildings[item.b.id];
      blitScaled(frame, a.surface, Math.round(item.b.x - camX - a.anchorX), Math.round(item.b.y - camY - a.anchorY), 1);
    } else if (item.kind === 'm') {
      const sp = cache4[`${item.m.faction}-${item.m.flip ? 1 : 0}-${item.m.f}`];
      blitScaled(frame, sp, Math.round(item.m.x - camX - 3), Math.round(item.m.y - camY - 5), 1);
    } else if (item.t.id === 'vanguard-tank') {
      const hDir: Dir8 = item.t.hullDir ?? 'E';
      const tDir: Dir8 = item.t.turretDir ?? 'E';
      const atkF = item.t.anim === 'attack' ? item.t.frame : 0;
      const sp = composeIsoTank(hDir, tDir, 0, atkF);
      blitScaled(
        frame,
        sp,
        Math.round(item.t.x - camX - TANK_OUT_W / 2),
        Math.round(item.t.y - camY - TANK_OUT_H + 5),
        1,
      );
    } else {
      const sp = compileTitanFrame(item.t.id, item.t.anim, item.t.facing, item.t.frame).outlined;
      blitScaled(
        frame,
        sp,
        Math.round(item.t.x - camX - sp.width / 2),
        Math.round(item.t.y - camY - sp.height + 2),
        1,
      );
    }
  }

  // Dense tracer fire across the 1,000-unit frontline
  const TRACER_ORG = hexToU32('#ff922b');
  const ACID_GRN = hexToU32('#8cff2e');
  const PSI_CYN = hexToU32('#2ce8f5');
  for (let i = 0; i < 42; i++) {
    const x0 = 192 + rand() * 34 - camX;
    const y0 = 122 + rand() * 88 - camY;
    const x1 = x0 + 18 + rand() * 32;
    const y1 = y0 + (rand() - 0.5) * 18;
    drawLine(frame, x0, y0, x1, y1, TRACER_ORG);
  }
  for (let i = 0; i < 24; i++) {
    const x0 = 286 + rand() * 38 - camX;
    const y0 = 126 + rand() * 82 - camY;
    drawLine(frame, x0, y0, x0 - 14 - rand() * 20, y0 + (rand() - 0.5) * 14, ACID_GRN);
  }
  for (let i = 0; i < 20; i++) {
    const x0 = 218 + rand() * 72 - camX;
    const y0 = 114 + rand() * 36 - camY;
    setPixel(frame, x0, y0, PSI_CYN);
    setPixel(frame, x0 + 1, y0, PSI_CYN);
  }

  drawCombinedArmsOverlay(frame, camX, camY, KEYFRAME_TITANS);

  for (const t of airTitans) {
    const meta = TITAN_SPEC_BY_ID[t.id];
    const sp = compileTitanFrame(t.id, t.anim, t.facing, t.frame).outlined;
    blitScaled(
      frame,
      sp,
      Math.round(t.x - camX - sp.width / 2),
      Math.round(t.y - camY - sp.height / 2 - meta.airAltitude),
      1,
    );
  }

  return { surface2x: scaleSurface(frame, 2), totalCount: tiny.length + KEYFRAME_TITANS.length };
}

// ---------- 4. Self-Contained Interactive Mixed-Scale + 1,000-Unit Showcase ----------

function buildInteractiveShowcaseHTML(
  terrain: PixelSurface,
  tileset: TilesetBundle,
  tilemap: TileMapData,
  unitsMeta: readonly ExportedSpriteMeta[],
  titansMeta: readonly ExportedSpriteMeta[],
  micro4Meta: readonly ExportedMicro4Meta[],
  isoTank: ExportedIsoTankPayload,
  buildings: Readonly<Record<BuildingId, BuildingAsset>>,
): string {
  const terrainDataUrl = surfaceToDataURL(terrain);
  const tilesetAtlasDataUrl = surfaceToDataURL(tileset.atlas);
  const buildingPayload: Record<
    string,
    { dataUrl: string; w: number; h: number; anchorX: number; anchorY: number; srx: number; sry: number }
  > = {};
  for (const [id, b] of Object.entries(buildings)) {
    buildingPayload[id] = {
      dataUrl: surfaceToDataURL(b.surface),
      w: b.surface.width,
      h: b.surface.height,
      anchorX: b.anchorX,
      anchorY: b.anchorY,
      srx: b.shadowRx,
      sry: b.shadowRy,
    };
  }

  const embeddedData = JSON.stringify({
    worldW: WORLD_W,
    worldH: WORLD_H,
    viewW: VIEW_W,
    viewH: VIEW_H,
    tilePx: TILE_PX,
    terrainDataUrl,
    tilesetAtlasDataUrl,
    tilemap,
    units: unitsMeta,
    titans: titansMeta,
    micro4: micro4Meta,
    isoTank,
    buildings: buildingPayload,
    mapBuildings: MAP_BUILDINGS,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="icon" href="data:," />
<title>Mixed-Scale 8x8 + 16x16 Titans & 4x4 1K Swarm RTS</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    color: var(--foreground, #e5e7eb);
  }
  .root {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 8px;
    background: var(--card, rgba(24, 24, 30, 0.85));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius, 10px);
  }
  .group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px;
  }
  .group-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--muted-foreground, #9ca3af);
    margin-right: 2px;
  }
  button.pill {
    appearance: none;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.14));
    background: var(--secondary, rgba(255, 255, 255, 0.06));
    color: var(--foreground, #f3f4f6);
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6.5px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
    white-space: nowrap;
  }
  button.pill:hover { border-color: var(--ring, #60a5fa); }
  button.pill:active { transform: scale(0.97); }
  button.pill.active {
    background: var(--primary, #3b82f6);
    color: var(--primary-foreground, #ffffff);
    border-color: transparent;
  }
  .viewport-shell {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #10131c;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.16));
    border-radius: var(--radius, 10px);
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }
  canvas#battle {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    cursor: grab;
  }
  canvas#battle:active { cursor: grabbing; }
  .hud-pill {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(12, 14, 22, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: #f1f5f9;
    pointer-events: none;
  }
  .hud-hint {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(12, 14, 22, 0.74);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 10.5px;
    color: #cbd5e1;
    pointer-events: none;
  }
  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-right: 3px;
    vertical-align: middle;
  }
  .dot.v { background: #52b2ff; }
  .dot.k { background: #f065c0; }
  .dot.s { background: #ffe066; }

  .cast-panel {
    padding: 9px 11px;
    background: var(--card, rgba(24, 24, 30, 0.85));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius, 10px);
  }
  .cast-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .cast-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }
  .cast-grid.cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (max-width: 580px) {
    .cast-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  .unit-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px 5px;
    background: var(--secondary, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    text-align: center;
  }
  .unit-card canvas {
    width: 60px;
    height: 60px;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    margin-bottom: 3px;
  }
  .unit-name {
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.2;
  }
  .unit-role {
    font-size: 9.5px;
    color: var(--muted-foreground, #9ca3af);
    line-height: 1.2;
    margin-top: 2px;
  }
</style>
</head>
<body>
<div class="root">
  <div class="toolbar">
    <div class="group">
      <span class="group-label">Scale</span>
      <button class="pill active" data-mode="mixed">8×8 + Titans</button>
      <button class="pill" data-mode="mega4">4×4 1K</button>
    </div>
    <div class="group">
      <span class="group-label">Brush</span>
      <button class="pill active" data-brush="pan">Pan</button>
      <button class="pill" data-brush="grass">Grass</button>
      <button class="pill" data-brush="dirt">Dirt</button>
      <button class="pill" data-brush="creep">Creep</button>
      <button class="pill" data-brush="water">Water</button>
      <button class="pill" data-brush="plateau">Cliff</button>
    </div>
    <div class="group">
      <button class="pill active" id="btn-outline">Ink</button>
      <button class="pill" id="btn-pure">Pure</button>
      <button class="pill active" data-zoom="1">1×</button>
      <button class="pill" data-zoom="1.8">1.8×</button>
      <button class="pill" id="btn-pause">Pause</button>
    </div>
  </div>

  <div class="viewport-shell">
    <canvas id="battle" width="384" height="216"></canvas>
    <div class="hud-pill" id="hud-stats">
      <span><i class="dot v"></i><b id="cnt-v">0</b></span>
      <span><i class="dot s"></i><b id="cnt-s">0</b></span>
      <span><i class="dot k"></i><b id="cnt-k">0</b></span>
      <span id="hud-total">200 units · 60 fps</span>
    </div>
    <div class="hud-hint" id="hud-hint">Drag to pan · Click to drop squad + titan</div>
  </div>

  <div class="cast-panel">
    <div class="cast-header">
      <div class="group">
        <button class="pill active" data-cast-tab="titans">16×16 Titans &amp; Flyers (6)</button>
        <button class="pill" data-cast-tab="infantry">8×8 Infantry (6)</button>
        <button class="pill" data-cast-tab="micro4">4×4 Mega-Swarm (3)</button>
      </div>
      <div class="group">
        <button class="pill active" data-cast-anim="attack">Attack</button>
        <button class="pill" data-cast-anim="move">Move</button>
        <button class="pill" data-cast-anim="idle">Idle</button>
      </div>
    </div>
    <div class="cast-grid" id="cast-grid"></div>
  </div>
</div>

<script>
const DATA = ${embeddedData};

const battleCanvas = document.getElementById('battle');
const ctx = battleCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const state = {
  mode: 'mixed', // 'mixed' (200 8x8 + 18 Titans) | 'mega4' (960 4x4 + 18 Titans)
  brush: 'pan',  // 'pan' | 'grass' | 'dirt' | 'creep' | 'water' | 'plateau'
  outlined: true,
  zoom: 1,
  paused: false,
  castTab: 'titans',
  castAnim: 'attack',
  camX: (DATA.worldW - DATA.viewW) / 2,
  camY: (DATA.worldH - DATA.viewH) / 2 - 4,
  lastTime: performance.now(),
  fps: 60,
  fpsFrames: 0,
  fpsAccum: 0,
};

const images = {
  terrain: null,
  tilesetAtlas: null,
  raw: {},
  out: {},
  raw8: {},
  out8: {},
  isoHull: null,
  isoTurret: null,
  isoShadow: null,
  micro4Raw: {},
  micro4Out: {},
  buildings: {},
};

function vecToDir8(dx, dy) {
  const shifted = Math.atan2(dy, dx) + Math.PI / 2;
  return ((Math.round(shifted / (Math.PI / 4)) % 8) + 8) % 8;
}

const tankCompositeCache = new Map();
function getCompositeTank(hullDir, phase, turretDir, atkCol, outlined) {
  const key = (outlined ? 2048 : 0) | (hullDir << 7) | (phase << 5) | (turretDir << 2) | atkCol;
  let cached = tankCompositeCache.get(key);
  if (cached) return cached;
  const T = DATA.isoTank;
  const c = document.createElement('canvas');
  c.width = T.outW; c.height = T.outH;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const [px, py] = T.pivots[hullDir];
  const dx = px - 11, dy = py - 8;
  g.drawImage(images.isoHull, phase * T.coreW, hullDir * T.coreH, T.coreW, T.coreH, 1, 1, T.coreW, T.coreH);
  g.drawImage(images.isoTurret, atkCol * T.coreW, turretDir * T.coreH, T.coreW, T.coreH, 1 + dx, 1 + dy, T.coreW, T.coreH);
  if (outlined) {
    const img = g.getImageData(0, 0, T.outW, T.outH);
    const src = new Uint8ClampedArray(img.data);
    const dst = img.data;
    const W = T.outW, H = T.outH;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (src[i + 3] > 0) continue;
        const adj =
          (x > 0 && src[i - 4 + 3] > 0) ||
          (x + 1 < W && src[i + 4 + 3] > 0) ||
          (y > 0 && src[i - W * 4 + 3] > 0) ||
          (y + 1 < H && src[i + W * 4 + 3] > 0);
        if (adj) { dst[i] = 0x13; dst[i + 1] = 0x0f; dst[i + 2] = 0x1e; dst[i + 3] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
  }
  tankCompositeCache.set(key, c);
  return c;
}

// Offscreen live 512x288 tilemap buffer + dual-grid biome vertices for real-time Wang-16 painting!
const terrainCanvas = document.createElement('canvas');
terrainCanvas.width = DATA.worldW;
terrainCanvas.height = DATA.worldH;
const terrainCtx = terrainCanvas.getContext('2d');
terrainCtx.imageSmoothingEnabled = false;
const liveBiomes = DATA.tilemap.biomes.slice();
const GRID_W = DATA.tilemap.gridW;
const GRID_H = DATA.tilemap.gridH;
const RAMPS = DATA.tilemap.ramps;

function hash2iJS(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function resolveGroundTileJS(tx, ty) {
  const rawAt = (gx, gy) => liveBiomes[gy * GRID_W + gx];
  const raw = [rawAt(tx, ty), rawAt(tx + 1, ty), rawAt(tx, ty + 1), rawAt(tx + 1, ty + 1)];
  let fb = 'grass';
  const np = raw.filter((b) => b !== 'plateau');
  if (np.length) fb = np[0];
  else {
    for (let sy = ty + 2; sy < GRID_H; sy++) { const b = rawAt(tx, sy); if (b !== 'plateau') { fb = b; break; } }
  }
  const nw = raw[0] === 'plateau' ? fb : raw[0];
  const ne = raw[1] === 'plateau' ? fb : raw[1];
  const sw = raw[2] === 'plateau' ? fb : raw[2];
  const se = raw[3] === 'plateau' ? fb : raw[3];
  const vr = hash2iJS(tx, ty, 313);
  const variant = vr < 0.52 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;
  const maskOf = (t) => (nw === t ? 1 : 0) | (ne === t ? 2 : 0) | (sw === t ? 4 : 0) | (se === t ? 8 : 0);
  const wMask = maskOf('water');
  if (wMask === 15) {
    const wr = hash2iJS(tx, ty, 811);
    return [wr > 0.9 ? 3 : wr > 0.65 ? 2 : wr > 0.35 ? 1 : 0, 1];
  }
  if (wMask > 0) {
    const dc = (nw === 'dirt' || nw === 'creep') + (ne === 'dirt' || ne === 'creep') + (sw === 'dirt' || sw === 'creep') + (se === 'dirt' || se === 'creep');
    const gc = (nw === 'grass') + (ne === 'grass') + (sw === 'grass') + (se === 'grass');
    return [wMask, dc > gc ? 7 : 5];
  }
  const cMask = maskOf('creep');
  if (cMask === 15) return [8 + variant, 0];
  if (cMask > 0) {
    const gc = (nw === 'grass') + (ne === 'grass') + (sw === 'grass') + (se === 'grass');
    const dc = (nw === 'dirt') + (ne === 'dirt') + (sw === 'dirt') + (se === 'dirt');
    return [cMask, gc >= dc ? 4 : 3];
  }
  const gMask = maskOf('grass');
  if (gMask === 15) return hash2iJS(tx, ty, 77) > 0.92 ? [14 + (variant & 1), 1] : [4 + variant, 0];
  if (gMask > 0) return [gMask, 2];
  if (tx >= 22 && tx <= 42 && ty >= 15 && ty <= 24 && hash2iJS(tx, ty, 505) > 0.94) return [11 + (variant % 3), 1];
  return [variant, 0];
}

function resolveOverlayTileJS(tx, ty) {
  const nw = liveBiomes[ty * GRID_W + tx];
  const ne = liveBiomes[ty * GRID_W + tx + 1];
  const sw = liveBiomes[(ty + 1) * GRID_W + tx];
  const se = liveBiomes[(ty + 1) * GRID_W + tx + 1];
  for (let i = 0; i < RAMPS.length; i++) {
    const r = RAMPS[i];
    if (ty >= r.gy && ty <= r.gy + 1 && Math.abs(tx - r.gx) <= r.halfW) {
      if (tx === r.gx - r.halfW) return [8, 1];
      if (tx === r.gx + r.halfW) return [10, 1];
      return [9, 1];
    }
  }
  const pMask = (nw === 'plateau' ? 1 : 0) | (ne === 'plateau' ? 2 : 0) | (sw === 'plateau' ? 4 : 0) | (se === 'plateau' ? 8 : 0);
  if (pMask === 0) return null;
  if (pMask === 15) {
    const vr = hash2iJS(tx, ty, 313);
    const variant = vr < 0.52 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;
    const patch = hash2iJS(tx, ty, 41);
    return patch > 0.86 ? [4 + (Math.floor(patch * 29) & 3), 1] : [12 + variant, 0];
  }
  return [pMask, 6];
}

function redrawTileCell(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID_W - 1 || ty >= GRID_H - 1 || !images.tilesetAtlas) return;
  const [gCol, gRow] = resolveGroundTileJS(tx, ty);
  terrainCtx.drawImage(images.tilesetAtlas, gCol * 8, gRow * 8, 8, 8, tx * 8, ty * 8, 8, 8);
  const ov = resolveOverlayTileJS(tx, ty);
  if (ov) terrainCtx.drawImage(images.tilesetAtlas, ov[0] * 8, ov[1] * 8, 8, 8, tx * 8, ty * 8, 8, 8);
}

function paintBiomeAtWorld(wx, wy, biome) {
  const gx = Math.round(wx / 8);
  const gy = Math.round(wy / 8);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 1) continue; // soft 5-vertex cross brush
      const vx = gx + dx;
      const vy = gy + dy;
      if (vx < 0 || vy < 0 || vx >= GRID_W || vy >= GRID_H) continue;
      liveBiomes[vy * GRID_W + vx] = biome;
    }
  }
  for (let ty = gy - 2; ty <= gy + 1; ty++) {
    for (let tx = gx - 2; tx <= gx + 1; tx++) {
      redrawTileCell(tx, ty);
    }
  }
}

const spriteMetaById = {};
for (const m of [...DATA.units, ...DATA.titans]) spriteMetaById[m.id] = m;

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

const STATS = {
  'vanguard-trooper': { faction: 'vanguard', hp: 56, speed: 15, range: 56, dmg: 7, cd: 0.78, proj: 'tracer', titan: false },
  'vanguard-heavy':   { faction: 'vanguard', hp: 110, speed: 11, range: 70, dmg: 15, cd: 1.35, proj: 'missile', titan: false },
  'kraxen-stalker':   { faction: 'kraxen',   hp: 62, speed: 16, range: 52, dmg: 9, cd: 0.85, proj: 'acid', titan: false },
  'kraxen-swarmling': { faction: 'kraxen',   hp: 32, speed: 26, range: 11, dmg: 8, cd: 0.5, proj: 'bite', titan: false },
  'solaris-blade':    { faction: 'solaris',  hp: 94, speed: 19, range: 12, dmg: 13, cd: 0.65, proj: 'psi-slash', titan: false },
  'solaris-arcanist': { faction: 'solaris',  hp: 52, speed: 14, range: 64, dmg: 12, cd: 1.05, proj: 'psi-orb', titan: false },

  'vanguard-tank':    { faction: 'vanguard', hp: 460, speed: 9,  range: 92, dmg: 38, cd: 1.9,  proj: 'shell', titan: true },
  'vanguard-gunship': { faction: 'vanguard', hp: 310, speed: 24, range: 76, dmg: 18, cd: 0.95, proj: 'rocket-salvo', titan: true },
  'kraxen-behemoth':  { faction: 'kraxen',   hp: 560, speed: 14, range: 17, dmg: 42, cd: 1.1,  proj: 'cleave', titan: true },
  'kraxen-wyvern':    { faction: 'kraxen',   hp: 250, speed: 27, range: 58, dmg: 16, cd: 0.9,  proj: 'glaive', titan: true },
  'solaris-colossus': { faction: 'solaris',  hp: 480, speed: 10, range: 86, dmg: 34, cd: 1.5,  proj: 'thermal-beam', titan: true },
  'solaris-carrier':  { faction: 'solaris',  hp: 520, speed: 16, range: 94, dmg: 14, cd: 0.75, proj: 'interceptors', titan: true },
};

const BASES = {
  vanguard: { x: 118, y: 158 },
  kraxen:   { x: 392, y: 158 },
  solaris:  { x: 256, y: 74 },
};

const ANIM_FPS = { idle: 2.5, move: 8, attack: 9, death: 7 };

let units = [];
let tinyUnits = []; // Used in 'mega4' 1,000-unit mode for blistering 60fps performance
let treadTracks = [];
let projectiles = [];
let beams = [];
let blasts = [];
let interceptors = [];

function spawnUnit(id, x, y) {
  const st = STATS[id];
  const meta = spriteMetaById[id];
  const initDir8 = st.faction === 'kraxen' ? 6 : st.faction === 'solaris' ? 4 : 2;
  return {
    id,
    faction: st.faction,
    layer: meta.layer,
    titan: st.titan,
    x, y,
    vx: 0, vy: 0,
    hp: st.hp,
    maxHp: st.hp,
    facing: st.faction === 'kraxen' ? 1 : 0,
    dir8: initDir8,
    turret8: initDir8,
    hullTurnCd: 0,
    moveDist: 0,
    trackAccum: 0,
    anim: 'move',
    animT: Math.random() * 4,
    cd: Math.random() * st.cd,
    attacking: false,
    attackTime: 0,
    attackDur: 0,
    attackStrikeEmitted: false,
    attackTarget: null,
    attackIsRight: true,
    deathT: 0,
    dead: false,
  };
}

function pickInfantry(faction) {
  const r = Math.random();
  if (faction === 'vanguard') return r < 0.72 ? 'vanguard-trooper' : 'vanguard-heavy';
  if (faction === 'kraxen') return r < 0.58 ? 'kraxen-swarmling' : 'kraxen-stalker';
  return r < 0.6 ? 'solaris-blade' : 'solaris-arcanist';
}

function pickTitan(faction) {
  const r = Math.random();
  if (faction === 'vanguard') return r < 0.58 ? 'vanguard-tank' : 'vanguard-gunship';
  if (faction === 'kraxen') return r < 0.52 ? 'kraxen-behemoth' : 'kraxen-wyvern';
  return r < 0.55 ? 'solaris-colossus' : 'solaris-carrier';
}

function seedTitans() {
  const presets = [
    ['vanguard-tank', 152, 138], ['vanguard-tank', 148, 178], ['vanguard-tank', 166, 202],
    ['vanguard-gunship', 176, 130], ['vanguard-gunship', 178, 188],
    ['kraxen-behemoth', 322, 148], ['kraxen-behemoth', 326, 188], ['kraxen-behemoth', 352, 166],
    ['kraxen-wyvern', 346, 126], ['kraxen-wyvern', 354, 190], ['kraxen-wyvern', 368, 152],
    ['solaris-colossus', 228, 118], ['solaris-colossus', 284, 118],
    ['solaris-carrier', 256, 98], ['solaris-carrier', 216, 108],
  ];
  for (const [id, x, y] of presets) {
    units.push(spawnUnit(id, x, y));
  }
}

function seedBattle() {
  units = [];
  tinyUnits = [];
  treadTracks = [];
  projectiles = [];
  beams = [];
  blasts = [];
  interceptors = [];
  seedTitans();

  if (state.mode === 'mixed') {
    for (let i = 0; i < 62; i++) units.push(spawnUnit(pickInfantry('vanguard'), 130 + Math.random() * 84, 112 + Math.random() * 102));
    for (let i = 0; i < 78; i++) units.push(spawnUnit(pickInfantry('kraxen'), 294 + Math.random() * 94, 112 + Math.random() * 104));
    for (let i = 0; i < 42; i++) {
      const onRamp = i < 14;
      const x = onRamp ? (i % 2 === 0 ? 196 : 318) + (Math.random() - 0.5) * 24 : 196 + Math.random() * 120;
      const y = onRamp ? 82 + Math.random() * 24 : 108 + Math.random() * 44;
      units.push(spawnUnit(pickInfantry('solaris'), x, y));
    }
  } else {
    // 1,000-unit ultra-micro 4x4 swarm + 15 Titans!
    const addTiny = (faction, cx, cy, count, rx, ry) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random());
        tinyUnits.push({
          faction,
          x: cx + Math.cos(a) * rx * rad,
          y: cy + Math.sin(a) * ry * rad,
          hp: faction === 'kraxen' ? 18 : 26,
          flip: faction === 'kraxen',
          cd: Math.random() * 0.9,
          animT: Math.random() * 4,
          atkFlash: 0,
        });
      }
    };
    addTiny('vanguard', 166, 162, 340, 56, 52);
    addTiny('kraxen',   342, 166, 430, 64, 56);
    addTiny('solaris',  254, 124, 220, 60, 30);
  }
}

function biomeAtWorld(wx, wy) {
  const gx = Math.max(0, Math.min(GRID_W - 1, Math.round(wx / 8)));
  const gy = Math.max(0, Math.min(GRID_H - 1, Math.round(wy / 8)));
  return liveBiomes[gy * GRID_W + gx];
}
function onRampWorld(wx, wy) {
  const tx = wx / 8, ty = wy / 8;
  for (let i = 0; i < DATA.tilemap.ramps.length; i++) {
    const r = DATA.tilemap.ramps[i];
    if (Math.abs(tx - r.gx) <= r.halfW + 0.65 && ty >= r.gy - 0.8 && ty <= r.gy + 2.4) return true;
  }
  return false;
}
function canGroundStep(x0, y0, x1, y1) {
  const b0 = biomeAtWorld(x0, y0);
  const b1 = biomeAtWorld(x1, y1);
  if (b1 === 'water' && b0 !== 'water') return false;
  if ((b0 === 'plateau') !== (b1 === 'plateau') && !onRampWorld(x0, y0) && !onRampWorld(x1, y1)) return false;
  return true;
}

function stepSim(dt) {
  // Per-faction balanced Titan & Infantry replenishment so all 3 factions stay dramatic & competitive!
  const tCnt = { vanguard: 0, kraxen: 0, solaris: 0 };
  const iCnt = { vanguard: 0, kraxen: 0, solaris: 0 };
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead) continue;
    if (u.titan) tCnt[u.faction]++;
    else iCnt[u.faction]++;
  }

  for (const f of ['vanguard', 'kraxen', 'solaris']) {
    if (tCnt[f] < 5) {
      const b = BASES[f];
      units.push(spawnUnit(pickTitan(f), b.x + (Math.random() - 0.5) * 32, b.y + (Math.random() - 0.5) * 20));
      tCnt[f]++;
    }
  }

  if (state.mode === 'mixed') {
    const caps = { vanguard: 56, kraxen: 74, solaris: 54 };
    for (const f of ['solaris', 'kraxen', 'vanguard']) {
      let spawned = 0;
      while (iCnt[f] < caps[f] && spawned < 2) {
        const b = BASES[f];
        const sx = f === 'solaris' ? b.x + (Math.random() - 0.5) * 86 : b.x + (Math.random() - 0.5) * 44;
        const sy = f === 'solaris' ? 62 + Math.random() * 14 : b.y + (Math.random() - 0.5) * 36;
        units.push(spawnUnit(pickInfantry(f), sx, sy));
        iCnt[f]++;
        spawned++;
      }
    }
  } else {
    // Keep 4x4 swarm around 990 units balanced across all 3 factions!
    if (tinyUnits.length < 980) {
      for (let k = 0; k < 14; k++) {
        const f = Math.random() < 0.4 ? 'kraxen' : Math.random() < 0.52 ? 'vanguard' : 'solaris';
        const b = BASES[f];
        tinyUnits.push({
          faction: f,
          x: b.x + (Math.random() - 0.5) * 44,
          y: b.y + (Math.random() - 0.5) * 28,
          hp: f === 'kraxen' ? 18 : 26,
          flip: f === 'kraxen',
          cd: Math.random() * 0.9,
          animT: Math.random() * 4,
          atkFlash: 0,
        });
      }
    }
  }

  // Spatial hash for main units (8x8 + Titans)
  const CELL = 22;
  const grid = new Map();
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead) continue;
    const key = ((u.x / CELL) | 0) * 1000 + ((u.y / CELL) | 0);
    let b = grid.get(key);
    if (!b) { b = []; grid.set(key, b); }
    b.push(u);
  }

  // Spatial hash for 4x4 mega-swarm
  const TCELL = 14;
  const tGrid = new Map();
  if (tinyUnits.length > 0) {
    for (let i = 0; i < tinyUnits.length; i++) {
      const m = tinyUnits[i];
      const key = ((m.x / TCELL) | 0) * 1000 + ((m.y / TCELL) | 0);
      let b = tGrid.get(key);
      if (!b) { b = []; tGrid.set(key, b); }
      b.push(m);
    }
  }

  // Step 8x8 + Titan units
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead) { u.deathT += dt; continue; }
    const st = STATS[u.id];
    const meta = spriteMetaById[u.id];
    u.animT += dt;
    if (u.cd > 0) u.cd -= dt;

    // Advance active non-looping attack strip and emit weapon hit ON ENTRY to strike frame (A1)!
    if (u.attacking) {
      u.attackTime += dt;
      const strikeFrame = 1;
      const curFrame = Math.floor(u.attackTime * ANIM_FPS.attack);
      if (curFrame >= strikeFrame && !u.attackStrikeEmitted) {
        u.attackStrikeEmitted = true;
        const tgt = u.attackTarget;
        if (tgt && (!tgt.dead && tgt.hp > 0)) {
          const aimDx = tgt.x - u.x;
          const aimDy = tgt.y - u.y;
          u.attackIsRight = aimDx >= 0;
          u.facing = (aimDy >= -2) ? (u.attackIsRight ? 0 : 1) : (u.attackIsRight ? 2 : 3);
          const aimDir8 = vecToDir8(aimDx, aimDy);
          if (u.id === 'vanguard-tank') u.turret8 = aimDir8;
          else u.dir8 = aimDir8;
          const alt = meta.airAltitude;
          const distHit = Math.hypot(aimDx, aimDy) || 1;
          if (st.proj === 'thermal-beam') {
            beams.push({ x0: u.x + (u.attackIsRight ? 4 : -4), y0: u.y - 12, x1: tgt.x, y1: tgt.y - 3, t: 0, dur: 0.28 });
            tgt.hp -= st.dmg;
            if (tgt.hp <= 0 && tgt.dead !== undefined) { tgt.dead = true; tgt.deathT = 0; }
            blasts.push({ x: tgt.x, y: tgt.y - 2, r: 3, col: '#2ce8f5', hot: '#ffffff', t: 0, maxT: 0.22 });
          } else if (st.proj === 'cleave' || st.proj === 'bite' || st.proj === 'psi-slash') {
            tgt.hp -= st.dmg;
            if (tgt.hp <= 0 && tgt.dead !== undefined) { tgt.dead = true; tgt.deathT = 0; }
            blasts.push({
              x: (u.x + tgt.x) * 0.5,
              y: (u.y + tgt.y) * 0.5 - 4,
              r: st.proj === 'cleave' ? 5 : 2,
              col: st.proj === 'psi-slash' ? '#2ce8f5' : '#9dff3b',
              hot: '#ffffff',
              t: 0,
              maxT: st.proj === 'cleave' ? 0.24 : 0.14,
            });
          } else if (st.proj === 'interceptors') {
            interceptors.push({
              x: u.x + (Math.random() - 0.5) * 10,
              y: u.y - alt,
              tx: tgt.x,
              ty: tgt.y - 4,
              hx: u.x,
              hy: u.y - alt,
              target: tgt,
              dmg: st.dmg,
              t: 0,
              dur: 0.72,
            });
          } else {
            let px0 = u.x + (u.attackIsRight ? 6 : -6);
            let py0 = u.y - 6 - alt;
            if (u.id === 'vanguard-tank') {
              const T = DATA.isoTank;
              const [pvx, pvy] = T.pivots[u.dir8];
              const [mx, my] = T.muzzles[u.turret8];
              px0 = Math.round(u.x - T.outW / 2) + 1 + pvx + mx;
              py0 = Math.round(u.y - T.outH + 5) + 1 + pvy + my;
            }
            projectiles.push({
              x: px0,
              y: py0,
              tx: tgt.x,
              ty: tgt.y - 4,
              target: tgt,
              dmg: st.dmg,
              kind: st.proj,
              t: 0,
              dur: Math.max(0.14, distHit / (st.proj === 'shell' ? 115 : 155)),
              fresh: true,
            });
          }
        }
      }
      if (u.attackTime >= u.attackDur) {
        u.attacking = false;
        u.attackTime = 0;
        u.attackTarget = null;
      }
    }

    const cx = (u.x / CELL) | 0;
    const cy = (u.y / CELL) | 0;
    let sepX = 0, sepY = 0;
    let target = null;
    let bestD2 = 1e9;
    if (u.hullTurnCd > 0) u.hullTurnCd -= dt;

    for (let gy = cy - 2; gy <= cy + 2; gy++) {
      for (let gx = cx - 2; gx <= cx + 2; gx++) {
        const bucket = grid.get(gx * 1000 + gy);
        if (!bucket) continue;
        for (let j = 0; j < bucket.length; j++) {
          const o = bucket[j];
          if (o === u || o.dead) continue;
          const dx = o.x - u.x;
          const dy = o.y - u.y;
          const d2 = dx * dx + dy * dy;
          if (o.layer === u.layer && d2 > 0.01) {
            // Mass-weighted separation: infantry give Tanks clean breathing room; Tanks barely budge from infantry!
            const pairRad = (u.titan && o.titan) ? 21 : (u.titan || o.titan) ? 15 : 10;
            if (d2 < pairRad * pairRad) {
              const d = Math.sqrt(d2);
              const weight = u.titan && !o.titan ? 0.14 : !u.titan && o.titan ? 1.55 : 1.0;
              const push = ((pairRad - d) / pairRad) * weight;
              sepX -= (dx / d) * push;
              sepY -= (dy / d) * push;
            }
          }
          if (o.faction !== u.faction && d2 < bestD2) {
            bestD2 = d2;
            target = o;
          }
        }
      }
    }

    // In 1K mode, Titans can also target the 4x4 swarm directly!
    if (!target && tinyUnits.length > 0) {
      for (let s = 0; s < 10; s++) {
        const m = tinyUnits[(Math.random() * tinyUnits.length) | 0];
        if (!m || m.faction === u.faction) continue;
        const d2 = (m.x - u.x) ** 2 + (m.y - u.y) ** 2;
        if (d2 < bestD2) { bestD2 = d2; target = m; }
      }
    }
    if (!target) {
      for (let s = 0; s < 12; s++) {
        const o = units[(Math.random() * units.length) | 0];
        if (!o || o.dead || o.faction === u.faction) continue;
        const d2 = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
        if (d2 < bestD2) { bestD2 = d2; target = o; }
      }
    }

    // While mid-attack, stay locked onto the committed attackTarget so sprite facing & strike always agree!
    if (u.attacking && u.attackTarget && !u.attackTarget.dead && u.attackTarget.hp > 0) {
      target = u.attackTarget;
    }

    let gx = 256, gy = 158;
    if (target) { gx = target.x; gy = target.y; }
    // Clean 2-stage bidirectional ramp routing: align 8px clear of cliff wall, then march straight through the ramp!
    if (!u.attacking && u.layer === 'ground') {
      const onPlat = biomeAtWorld(u.x, u.y) === 'plateau';
      const tgtPlat = biomeAtWorld(gx, gy) === 'plateau';
      const tgtDist = Math.hypot(gx - u.x, gy - u.y);
      if (onPlat !== tgtPlat && tgtDist > st.range) {
        const rampX = Math.abs(u.x - 196) < Math.abs(u.x - 318) ? 196 : 318;
        if (Math.abs(u.x - rampX) > 8) {
          gx = rampX;
          gy = onPlat ? 66 : 100;
        } else {
          gx = rampX;
          gy = onPlat ? 102 : 64;
        }
      }
    }

    const dx = gx - u.x;
    const dy = gy - u.y;
    const dist = Math.hypot(dx, dy) || 1;
    const isRight = dx >= 0;
    const isDown = dy >= -2;
    if (!u.attacking || (u.attackTarget && !u.attackTarget.dead && u.attackTarget.hp > 0)) {
      u.facing = isDown ? (isRight ? 0 : 1) : (isRight ? 2 : 3);
      if (u.id === 'vanguard-tank') {
        u.turret8 = vecToDir8(dx, dy);
      } else {
        u.dir8 = vecToDir8(dx, dy);
      }
    }

    if (target && dist <= st.range) {
      // Flyers gently orbit while firing; ground units hold line with separation (Tanks stay planted!)
      if (u.layer === 'air') {
        u.vx = (-dy / dist) * st.speed * 0.55 + sepX * 18;
        u.vy = (dx / dist) * st.speed * 0.45 + sepY * 14;
      } else {
        const sepMul = u.titan ? 6 : 14;
        u.vx = sepX * sepMul;
        u.vy = sepY * (sepMul * 0.85);
      }
      u.anim = u.attacking ? 'attack' : u.layer === 'air' ? 'move' : 'idle';

      if (!u.attacking && u.cd <= 0) {
        u.cd = st.cd * (0.85 + Math.random() * 0.3);
        const atkCount = u.id === 'vanguard-tank' ? 4 : meta.frameOffsets.attack.count;
        u.attacking = true;
        u.attackTime = 0;
        u.attackDur = atkCount / ANIM_FPS.attack;
        u.attackStrikeEmitted = false;
        u.attackTarget = target;
        u.attackIsRight = isRight;
        u.anim = 'attack';
      }
    } else {
      u.vx = (dx / dist) * st.speed + sepX * 22;
      u.vy = (dy / dist) * st.speed + sepY * 18;
      u.anim = 'move';
    }

    const oldX = u.x, oldY = u.y;
    let candX = Math.max(70, Math.min(DATA.worldW - 70, u.x + u.vx * dt));
    let candY = Math.max(54, Math.min(DATA.worldH - 42, u.y + u.vy * dt));
    if (u.layer === 'ground' && !canGroundStep(oldX, oldY, candX, candY)) {
      if (canGroundStep(oldX, oldY, candX, oldY)) candY = oldY;
      else if (canGroundStep(oldX, oldY, oldX, candY)) candX = oldX;
      else { candX = oldX; candY = oldY; }
    }
    u.x = candX;
    u.y = candY;
    const stepD = Math.hypot(u.x - oldX, u.y - oldY);
    // Tanks only rotate hull & lay tread marks while actively driving (zero separation jitter!)
    if (u.id === 'vanguard-tank' && u.anim === 'move' && stepD > 0.14) {
      if (u.hullTurnCd <= 0) {
        const nextDir = vecToDir8(u.x - oldX, u.y - oldY);
        if (nextDir !== u.dir8) {
          u.dir8 = nextDir;
          u.hullTurnCd = 0.22;
        }
      }
      u.moveDist += stepD;
      u.trackAccum += stepD;
      if (u.trackAccum >= 4.5) {
        u.trackAccum = 0;
        const nx = (u.x - oldX) / stepD, ny = (u.y - oldY) / stepD;
        const px = -ny * 4.0, py = nx * 2.5;
        const horiz = Math.abs(nx) >= Math.abs(ny);
        treadTracks.push({ x: u.x + px, y: u.y + py, w: horiz ? 2 : 1, h: horiz ? 1 : 2, life: 3.4 });
        treadTracks.push({ x: u.x - px, y: u.y - py, w: horiz ? 2 : 1, h: horiz ? 1 : 2, life: 3.4 });
        if (treadTracks.length > 220) treadTracks.splice(0, 2);
      }
    }
  }

  for (let i = treadTracks.length - 1; i >= 0; i--) {
    treadTracks[i].life -= dt;
    if (treadTracks[i].life <= 0) treadTracks.splice(i, 1);
  }

  // Step 1,000-unit 4x4 mega-swarm (lightweight O(N) hash!)
  if (tinyUnits.length > 0) {
    for (let i = tinyUnits.length - 1; i >= 0; i--) {
      const m = tinyUnits[i];
      if (m.hp <= 0) { tinyUnits.splice(i, 1); continue; }
      m.animT += dt;
      if (m.cd > 0) m.cd -= dt;
      if (m.atkFlash > 0) m.atkFlash -= dt;

      const cx = (m.x / TCELL) | 0;
      const cy = (m.y / TCELL) | 0;
      let sepX = 0, sepY = 0;
      let enemy = null;
      let bestD2 = 1e9;

      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const b = tGrid.get(gx * 1000 + gy);
          if (!b) continue;
          const lim = Math.min(b.length, 6);
          for (let j = 0; j < lim; j++) {
            const o = b[j];
            if (o === m) continue;
            const dx = o.x - m.x;
            const dy = o.y - m.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 20 && d2 > 0.01) {
              sepX -= dx * 0.25;
              sepY -= dy * 0.25;
            }
            if (o.faction !== m.faction && d2 < bestD2) {
              bestD2 = d2;
              enemy = o;
            }
          }
        }
      }

      const gx = enemy ? enemy.x : 256;
      const gy = enemy ? enemy.y : 162;
      const dx = gx - m.x;
      const dy = gy - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      m.flip = dx < 0;

      const range = m.faction === 'vanguard' ? 28 : m.faction === 'solaris' ? 14 : 11;
      if (enemy && dist <= range) {
        m.x += sepX * dt * 10;
        m.y += sepY * dt * 10;
        if (m.cd <= 0) {
          m.cd = 0.65 + Math.random() * 0.45;
          m.atkFlash = 0.22;
          enemy.hp -= 8;
          if (Math.random() < 0.22) {
            projectiles.push({
              x: m.x, y: m.y - 2, tx: enemy.x, ty: enemy.y - 2, target: null, dmg: 0,
              kind: m.faction === 'vanguard' ? 'tracer' : m.faction === 'kraxen' ? 'acid' : 'psi-orb',
              t: 0, dur: 0.14,
            });
          }
        }
      } else {
        const spd = m.faction === 'kraxen' ? 22 : m.faction === 'solaris' ? 18 : 15;
        m.x += ((dx / dist) * spd + sepX * 14) * dt;
        m.y += ((dy / dist) * spd + sepY * 12) * dt;
      }
      m.x = Math.max(72, Math.min(DATA.worldW - 72, m.x));
      m.y = Math.max(58, Math.min(DATA.worldH - 44, m.y));
    }
  }

  // Advance projectiles, beams, blasts, interceptors
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.fresh) { p.fresh = false; continue; }
    p.t += dt;
    if (p.t >= p.dur) {
      if (p.target && p.dmg > 0) {
        p.target.hp -= p.dmg;
        if (p.target.hp <= 0 && p.target.dead !== undefined) { p.target.dead = true; p.target.deathT = 0; }
      }
      if (p.dmg > 0) {
        blasts.push({
          x: p.tx, y: p.ty,
          r: p.kind === 'shell' ? 5 : p.kind === 'rocket-salvo' ? 3 : 2,
          col: p.kind === 'acid' || p.kind === 'glaive' ? '#8cff2e' : p.kind === 'psi-orb' ? '#2ce8f5' : '#ff6b2b',
          hot: '#fffbe6',
          t: 0,
          maxT: p.kind === 'shell' ? 0.28 : 0.14,
        });
      }
      projectiles.splice(i, 1);
    }
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].t += dt;
    if (beams[i].t >= beams[i].dur) beams.splice(i, 1);
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    blasts[i].t += dt;
    if (blasts[i].t >= blasts[i].maxT) blasts.splice(i, 1);
  }
  for (let i = interceptors.length - 1; i >= 0; i--) {
    const d = interceptors[i];
    d.t += dt;
    if (d.t >= d.dur * 0.5 && !d.hit) {
      d.hit = true;
      if (d.target) {
        d.target.hp -= d.dmg;
        if (d.target.hp <= 0 && d.target.dead !== undefined) { d.target.dead = true; d.target.deathT = 0; }
      }
      blasts.push({ x: d.tx, y: d.ty, r: 2, col: '#2ce8f5', hot: '#ffffff', t: 0, maxT: 0.14 });
    }
    if (d.t >= d.dur) interceptors.splice(i, 1);
  }
  units = units.filter((u) => !u.dead || u.deathT < 0.42);
}

function renderBattle() {
  const z = state.zoom;
  const visW = DATA.viewW / z;
  const visH = DATA.viewH / z;
  const cx = Math.max(0, Math.min(DATA.worldW - visW, state.camX));
  const cy = Math.max(0, Math.min(DATA.worldH - visH, state.camY));
  state.camX = cx;
  state.camY = cy;

  ctx.save();
  ctx.scale(z, z);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(images.terrain, Math.floor(cx), Math.floor(cy), Math.ceil(visW) + 1, Math.ceil(visH) + 1, -(cx % 1), -(cy % 1), Math.ceil(visW) + 1, Math.ceil(visH) + 1);

  const groundList = [];
  const airList = [];
  for (let i = 0; i < DATA.mapBuildings.length; i++) groundList.push({ kind: 0, y: DATA.mapBuildings[i].y, b: DATA.mapBuildings[i] });
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.layer === 'air') airList.push(u);
    else groundList.push({ kind: 1, y: u.y, u });
  }
  for (let i = 0; i < tinyUnits.length; i++) groundList.push({ kind: 2, y: tinyUnits[i].y, m: tinyUnits[i] });
  groundList.sort((a, b) => a.y - b.y);
  airList.sort((a, b) => a.y - b.y);

  // Fading twin tank tread tracks
  for (let i = 0; i < treadTracks.length; i++) {
    const tr = treadTracks[i];
    ctx.fillStyle = 'rgba(18, 12, 24, ' + (Math.min(1, tr.life / 3.4) * 0.24).toFixed(2) + ')';
    ctx.fillRect(Math.round(tr.x - cx), Math.round(tr.y - cy), tr.w, tr.h);
  }

  // Ground shadows (buildings, units, and flyers projected below)
  ctx.fillStyle = 'rgba(14, 10, 24, 0.42)';
  for (let i = 0; i < groundList.length; i++) {
    const it = groundList[i];
    if (it.kind === 0) {
      const bm = DATA.buildings[it.b.id];
      ctx.beginPath();
      ctx.ellipse(it.b.x - cx, it.b.y - cy, bm.srx, bm.sry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === 1 && (!it.u.dead || it.u.deathT < 0.42)) {
      if (it.u.id === 'vanguard-tank' && !it.u.dead) {
        const T = DATA.isoTank;
        ctx.drawImage(
          images.isoShadow,
          it.u.dir8 * T.outW, 0, T.outW, T.outH,
          Math.round(it.u.x - cx - T.outW / 2), Math.round(it.u.y - cy - T.outH + 5), T.outW, T.outH,
        );
      } else {
        const deathFrame = Math.min(2, Math.floor(it.u.deathT * ANIM_FPS.death));
        const shrink = it.u.dead ? (deathFrame < 2 ? 0.8 : 0.6) : 1;
        const w = Math.max(4, Math.round((it.u.titan ? 12 : 6) * shrink));
        const h = Math.max(2, Math.round((it.u.titan ? 4 : 2) * shrink));
        ctx.fillRect(Math.round(it.u.x - cx - w / 2), Math.round(it.u.y - cy - h / 2), w, h);
      }
    }
  }
  ctx.fillStyle = 'rgba(14, 10, 24, 0.32)';
  for (let i = 0; i < airList.length; i++) {
    const a = airList[i];
    if (a.dead) continue;
    ctx.beginPath();
    ctx.ellipse(a.x - cx + 3, a.y - cy + 3, 6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground pass
  for (let i = 0; i < groundList.length; i++) {
    const it = groundList[i];
    if (it.kind === 0) {
      const bm = DATA.buildings[it.b.id];
      ctx.drawImage(images.buildings[it.b.id], Math.round(it.b.x - cx - bm.anchorX), Math.round(it.b.y - cy - bm.anchorY));
    } else if (it.kind === 2) {
      const m = it.m;
      const sx = Math.round(m.x - cx);
      const sy = Math.round(m.y - cy);
      if (sx < -6 || sx > visW + 6 || sy < -6 || sy > visH + 6) continue;
      const cell = state.outlined ? 6 : 4;
      const img = state.outlined ? images.micro4Out[m.faction] : images.micro4Raw[m.faction];
      const fCol = m.atkFlash > 0 ? 2 : (Math.floor(m.animT * 6) & 1);
      ctx.drawImage(img, fCol * cell, (m.flip ? 1 : 0) * cell, cell, cell, sx - (cell >> 1), sy - cell + 1, cell, cell);
    } else {
      const u = it.u;
      const sx = Math.round(u.x - cx);
      const sy = Math.round(u.y - cy);
      const meta = spriteMetaById[u.id];
      const cw = state.outlined ? meta.w + 2 : meta.w;
      const ch = state.outlined ? meta.h + 2 : meta.h;
      if (u.id === 'vanguard-tank' && !u.dead) {
        const T = DATA.isoTank;
        if (sx < -T.outW || sx > visW + T.outW || sy < -T.outH || sy > visH + T.outH) continue;
        const phase = Math.floor(u.moveDist * 0.45) & 3;
        const atkCol = u.attacking ? Math.min(3, Math.floor(u.attackTime * ANIM_FPS.attack)) : 0;
        const comp = getCompositeTank(u.dir8, phase, u.turret8, atkCol, state.outlined);
        ctx.drawImage(comp, Math.round(sx - T.outW / 2), Math.round(sy - T.outH + 5));
      } else {
        if (sx < -cw || sx > visW + cw || sy < -ch || sy > visH + ch) continue;
        const animName = u.dead ? 'death' : u.attacking ? 'attack' : u.anim;
        const seg = meta.frameOffsets[animName];
        const fIdx = u.dead
          ? Math.min(seg.count - 1, Math.floor(u.deathT * ANIM_FPS.death))
          : animName === 'attack'
            ? Math.min(seg.count - 1, Math.floor(u.attackTime * ANIM_FPS.attack))
            : Math.floor(u.animT * ANIM_FPS[animName]) % seg.count;
        const use8 = Boolean(meta.has8Way && images.out8[u.id]);
        const img = use8
          ? (state.outlined ? images.out8[u.id] : images.raw8[u.id])
          : (state.outlined ? images.out[u.id] : images.raw[u.id]);
        const rowIdx = use8 ? u.dir8 : u.facing;
        ctx.drawImage(img, (seg.start + fIdx) * cw, rowIdx * ch, cw, ch, sx - (cw >> 1), sy - ch + 1, cw, ch);
      }

      if (!u.dead && u.hp < u.maxHp) {
        const bw = u.titan ? 12 : 6;
        const ratio = Math.max(0, u.hp / u.maxHp);
        const bx = sx - (bw >> 1);
        const by = sy - ch - 2;
        ctx.fillStyle = '#130f1e';
        ctx.fillRect(bx, by, bw, u.titan ? 2 : 1);
        ctx.fillStyle = ratio > 0.6 ? '#4ade80' : ratio > 0.35 ? '#facc15' : '#f87171';
        ctx.fillRect(bx, by, Math.max(1, Math.round(ratio * bw)), u.titan ? 2 : 1);
      }
    }
  }

  // Sweeping Solaris Colossus Thermal Beams
  for (let i = 0; i < beams.length; i++) {
    const b = beams[i];
    const sweep = (b.t / b.dur - 0.5) * 8;
    ctx.strokeStyle = '#2ce8f5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x0 - cx, b.y0 - cy);
    ctx.lineTo(b.x1 + sweep - cx, b.y1 - cy);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x0 - cx, b.y0 - cy);
    ctx.lineTo(b.x1 + sweep - cx, b.y1 - cy);
    ctx.stroke();
  }

  // Projectiles
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    const u = Math.min(1, p.t / p.dur);
    const px = p.x + (p.tx - p.x) * u - cx;
    const py = p.y + (p.ty - p.y) * u - cy;
    const tailU = Math.max(0, u - (p.kind === 'shell' ? 0.34 : 0.24));
    const tx = p.x + (p.tx - p.x) * tailU - cx;
    const ty = p.y + (p.ty - p.y) * tailU - cy;

    if (p.kind === 'psi-orb') {
      ctx.fillStyle = '#2ce8f5';
      ctx.fillRect(Math.round(px - 1), Math.round(py - 1), 3, 3);
      ctx.fillStyle = '#e8ffff';
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    } else {
      ctx.strokeStyle = p.kind === 'acid' || p.kind === 'glaive' ? '#8cff2e' : p.kind === 'shell' ? '#ff5522' : '#ff922b';
      ctx.lineWidth = p.kind === 'shell' ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = p.kind === 'acid' || p.kind === 'glaive' ? '#ebffb3' : '#fff6cc';
      ctx.fillRect(Math.round(px), Math.round(py), p.kind === 'shell' ? 2 : 1, p.kind === 'shell' ? 2 : 1);
    }
  }

  // Blasts & impact sparks
  for (let i = 0; i < blasts.length; i++) {
    const s = blasts[i];
    const px = Math.round(s.x - cx);
    const py = Math.round(s.y - cy);
    const rad = Math.max(1, Math.round(s.r * (1 - s.t / s.maxT * 0.4)));
    ctx.fillStyle = s.col;
    ctx.fillRect(px - rad, py - (rad >> 1), rad * 2 + 1, rad + 1);
    ctx.fillRect(px - (rad >> 1), py - rad, rad + 1, rad * 2 + 1);
    ctx.fillStyle = s.hot;
    ctx.fillRect(px, py, 1, 1);
  }

  // Orbiting 3x3 Solaris Sky-Carrier Interceptor Drones
  for (let i = 0; i < interceptors.length; i++) {
    const d = interceptors[i];
    const p = d.t / d.dur;
    const out = p < 0.5 ? p * 2 : (1 - p) * 2;
    const arc = Math.sin(p * Math.PI) * 10;
    const ix = Math.round(d.hx + (d.tx - d.hx) * out - cx);
    const iy = Math.round(d.hy + (d.ty - d.hy) * out - arc - cy);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(ix - 1, iy, 3, 1);
    ctx.fillStyle = '#2ce8f5';
    ctx.fillRect(ix, iy - 1, 1, 3);
  }

  // Air Layer Flyers rendered ABOVE beams & infantry!
  for (let i = 0; i < airList.length; i++) {
    const u = airList[i];
    const meta = spriteMetaById[u.id];
    const sx = Math.round(u.x - cx);
    const sy = Math.round(u.y - cy - meta.airAltitude);
    const cw = state.outlined ? meta.w + 2 : meta.w;
    const ch = state.outlined ? meta.h + 2 : meta.h;
    const animName = u.dead ? 'death' : u.attacking ? 'attack' : u.anim;
    const seg = meta.frameOffsets[animName];
    const fIdx = u.dead
      ? Math.min(seg.count - 1, Math.floor(u.deathT * ANIM_FPS.death))
      : animName === 'attack'
        ? Math.min(seg.count - 1, Math.floor(u.attackTime * ANIM_FPS.attack))
        : Math.floor(u.animT * ANIM_FPS[animName]) % seg.count;
    const img = state.outlined ? images.out[u.id] : images.raw[u.id];
    ctx.drawImage(img, (seg.start + fIdx) * cw, u.facing * ch, cw, ch, sx - (cw >> 1), sy - (ch >> 1), cw, ch);
  }

  ctx.restore();
}

// Cast Inspector (tabs: 16x16 Titans | 8x8 Infantry | 4x4 Mega-Swarm)
let castItems = [];
function rebuildCastInspector() {
  const grid = document.getElementById('cast-grid');
  grid.innerHTML = '';
  grid.classList.toggle('cols-3', state.castTab === 'micro4');
  castItems = [];

  if (state.castTab === 'micro4') {
    for (const m of DATA.micro4) {
      const card = document.createElement('div');
      card.className = 'unit-card';
      const cv = document.createElement('canvas');
      cv.width = 54; cv.height = 54;
      const cctx = cv.getContext('2d'); cctx.imageSmoothingEnabled = false;
      const n = document.createElement('div'); n.className = 'unit-name'; n.textContent = m.name;
      const r = document.createElement('div'); r.className = 'unit-role'; r.textContent = m.role;
      card.append(cv, n, r);
      grid.appendChild(card);
      castItems.push({ kind: 'm4', meta: m, ctx: cctx });
    }
    return;
  }

  const list = state.castTab === 'titans' ? DATA.titans : DATA.units;
  for (const meta of list) {
    const card = document.createElement('div');
    card.className = 'unit-card';
    const cv = document.createElement('canvas');
    cv.width = 60; cv.height = 60;
    const cctx = cv.getContext('2d'); cctx.imageSmoothingEnabled = false;
    const n = document.createElement('div');
    n.className = 'unit-name';
    n.textContent = meta.name.replace('Vanguard ', 'V. ').replace('Kraxen ', 'K. ').replace('Solaris ', 'S. ');
    const r = document.createElement('div');
    r.className = 'unit-role';
    const roleLabel = meta.id === 'vanguard-tank' ? '22×20 · 8-Way Tank' : meta.has8Way ? meta.w + '×' + meta.h + ' · 8-Way Rifle' : meta.w + '×' + meta.h + ' · ' + meta.role;
    r.textContent = roleLabel;
    card.append(cv, n, r);
    grid.appendChild(card);
    castItems.push({ kind: 'sprite', meta, ctx: cctx });
  }
}

function renderCastInspector(nowSec) {
  for (const item of castItems) {
    const cctx = item.ctx;
    cctx.clearRect(0, 0, 60, 60);
    if (item.kind === 'm4') {
      const cell = state.outlined ? 6 : 4;
      const img = state.outlined ? images.micro4Out[item.meta.faction] : images.micro4Raw[item.meta.faction];
      const fCol = state.castAnim === 'attack' ? 2 : (Math.floor(nowSec * 5) & 1);
      const zoom = state.outlined ? 6 : 8;
      const ds = cell * zoom;
      const pad = Math.floor((60 - ds) / 2);
      cctx.fillStyle = 'rgba(14,10,24,0.35)';
      cctx.beginPath(); cctx.ellipse(30, 50, 13, 4, 0, 0, Math.PI * 2); cctx.fill();
      cctx.drawImage(img, fCol * cell, 0, cell, cell, pad, pad, ds, ds);
    } else {
      const meta = item.meta;
      if (meta.id === 'vanguard-tank') {
        const T = DATA.isoTank;
        const dir = Math.floor(nowSec * 0.45) % 8;
        const tDir = state.castAnim === 'idle' ? dir : Math.floor(nowSec * 1.15) % 8;
        const phase = state.castAnim === 'move' ? (Math.floor(nowSec * 8) & 3) : 0;
        const atkCol = state.castAnim === 'attack' ? (Math.floor(nowSec * 5.5) & 3) : 0;
        const comp = getCompositeTank(dir, phase, tDir, atkCol, state.outlined);
        const zoom = 2;
        const dw = T.outW * zoom, dh = T.outH * zoom;
        const px = Math.floor((60 - dw) / 2), py = Math.floor((60 - dh) / 2) + 2;
        cctx.drawImage(images.isoShadow, dir * T.outW, 0, T.outW, T.outH, px, py, dw, dh);
        cctx.drawImage(comp, px, py, dw, dh);
      } else {
        const seg = meta.frameOffsets[state.castAnim];
        const fps = ANIM_FPS[state.castAnim];
        const fIdx = Math.floor(nowSec * fps) % seg.count;
        const cw = state.outlined ? meta.w + 2 : meta.w;
        const ch = state.outlined ? meta.h + 2 : meta.h;
        const use8 = Boolean(meta.has8Way && images.out8[meta.id]);
        const img = use8
          ? (state.outlined ? images.out8[meta.id] : images.raw8[meta.id])
          : (state.outlined ? images.out[meta.id] : images.raw[meta.id]);
        const rowIdx = use8 ? (Math.floor(nowSec * 0.85) % 8) : 0;
        const zoom = meta.w >= 14 ? 3 : (state.outlined ? 4 : 5);
        const dw = cw * zoom;
        const dh = ch * zoom;
        const px = Math.floor((60 - dw) / 2);
        const py = Math.floor((60 - dh) / 2) + (meta.layer === 'air' ? -3 : 1);
        cctx.fillStyle = 'rgba(14,10,24,0.35)';
        cctx.beginPath(); cctx.ellipse(30, 52, meta.w >= 14 ? 20 : 13, 4, 0, 0, Math.PI * 2); cctx.fill();
        cctx.drawImage(img, (seg.start + fIdx) * cw, rowIdx * ch, cw, ch, px, py, dw, dh);
      }
    }
  }
}

// Pan/drop OR live Wang-16 8x8 tile painter!
let drag = null;
function clientToWorld(e) {
  const rect = battleCanvas.getBoundingClientRect();
  return [
    state.camX + ((e.clientX - rect.left) / rect.width) * (DATA.viewW / state.zoom),
    state.camY + ((e.clientY - rect.top) / rect.height) * (DATA.viewH / state.zoom),
  ];
}
function paintBiomeSegment(x0, y0, x1, y1, biome) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    paintBiomeAtWorld(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, biome);
  }
}

battleCanvas.addEventListener('pointerdown', (e) => {
  battleCanvas.setPointerCapture(e.pointerId);
  if (state.brush !== 'pan') {
    const [wx, wy] = clientToWorld(e);
    paintBiomeAtWorld(wx, wy, state.brush);
    drag = { painting: true, lastWx: wx, lastWy: wy };
    return;
  }
  drag = { painting: false, x: e.clientX, y: e.clientY, camX: state.camX, camY: state.camY, moved: false };
});
battleCanvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.painting) {
    const [wx, wy] = clientToWorld(e);
    paintBiomeSegment(drag.lastWx, drag.lastWy, wx, wy, state.brush);
    drag.lastWx = wx;
    drag.lastWy = wy;
    return;
  }
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) drag.moved = true;
  const rect = battleCanvas.getBoundingClientRect();
  state.camX = drag.camX - dx * ((DATA.viewW / state.zoom) / rect.width);
  state.camY = drag.camY - dy * ((DATA.viewH / state.zoom) / rect.height);
});
battleCanvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.painting && !drag.moved) {
    const [wx, wy] = clientToWorld(e);
    const faction = wx < 210 ? 'vanguard' : wx > 305 ? 'kraxen' : 'solaris';
    units.push(spawnUnit(pickTitan(faction), wx, wy));
    if (state.mode === 'mixed') {
      for (let i = 0; i < 10; i++) units.push(spawnUnit(pickInfantry(faction), wx + (Math.random() - 0.5) * 24, wy + (Math.random() - 0.5) * 18));
    } else {
      for (let i = 0; i < 60; i++) tinyUnits.push({ faction, x: wx + (Math.random() - 0.5) * 28, y: wy + (Math.random() - 0.5) * 22, hp: 22, flip: faction === 'kraxen', cd: 0.4, animT: 0, atkFlash: 0 });
    }
    blasts.push({ x: wx, y: wy, r: 5, col: '#38bdf8', hot: '#ffffff', t: 0, maxT: 0.25 });
  }
  drag = null;
});

document.querySelectorAll('[data-brush]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-brush]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.brush = btn.dataset.brush;
    battleCanvas.style.cursor = state.brush === 'pan' ? 'grab' : 'crosshair';
    const hint = document.getElementById('hud-hint');
    hint.textContent = state.brush === 'pan'
      ? 'Drag to pan · Click to drop squad + titan'
      : 'Painting ' + state.brush + ' 8×8 Wang-16 transition tiles — drag across map!';
  });
});

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    seedBattle();
    for (let i = 0; i < 16; i++) stepSim(0.05);
    updateHUD();
  });
});

document.getElementById('btn-outline').addEventListener('click', () => {
  state.outlined = true;
  document.getElementById('btn-outline').classList.add('active');
  document.getElementById('btn-pure').classList.remove('active');
});
document.getElementById('btn-pure').addEventListener('click', () => {
  state.outlined = false;
  document.getElementById('btn-pure').classList.add('active');
  document.getElementById('btn-outline').classList.remove('active');
});

document.querySelectorAll('[data-zoom]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-zoom]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const oldZ = state.zoom;
    const newZ = Number(btn.dataset.zoom);
    const midX = state.camX + (DATA.viewW / oldZ) / 2;
    const midY = state.camY + (DATA.viewH / oldZ) / 2;
    state.zoom = newZ;
    state.camX = midX - (DATA.viewW / newZ) / 2;
    state.camY = midY - (DATA.viewH / newZ) / 2;
  });
});

document.getElementById('btn-pause').addEventListener('click', (e) => {
  state.paused = !state.paused;
  e.target.textContent = state.paused ? 'Resume' : 'Pause';
  e.target.classList.toggle('active', state.paused);
});

document.querySelectorAll('[data-cast-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cast-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.castTab = btn.dataset.castTab;
    rebuildCastInspector();
  });
});

document.querySelectorAll('[data-cast-anim]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cast-anim]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.castAnim = btn.dataset.castAnim;
  });
});

function updateHUD() {
  let cv = 0, ck = 0, cs = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead) continue;
    if (u.faction === 'vanguard') cv++;
    else if (u.faction === 'kraxen') ck++;
    else cs++;
  }
  for (let i = 0; i < tinyUnits.length; i++) {
    const f = tinyUnits[i].faction;
    if (f === 'vanguard') cv++;
    else if (f === 'kraxen') ck++;
    else cs++;
  }
  document.getElementById('cnt-v').textContent = String(cv);
  document.getElementById('cnt-s').textContent = String(cs);
  document.getElementById('cnt-k').textContent = String(ck);
  document.getElementById('hud-total').textContent = (cv + ck + cs) + ' units · ' + Math.round(state.fps) + ' fps';
}

function loop(now) {
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  state.fpsFrames++;
  state.fpsAccum += dt;
  if (state.fpsAccum >= 0.35) {
    state.fps = state.fpsFrames / state.fpsAccum;
    state.fpsFrames = 0;
    state.fpsAccum = 0;
    updateHUD();
  }
  if (!state.paused) stepSim(dt);
  renderBattle();
  renderCastInspector(now / 1000);
  requestAnimationFrame(loop);
}

async function init() {
  images.terrain = await loadImage(DATA.terrainDataUrl);
  images.tilesetAtlas = await loadImage(DATA.tilesetAtlasDataUrl);
  terrainCtx.drawImage(images.terrain, 0, 0);
  images.terrain = terrainCanvas;
  await Promise.all([
    ...[...DATA.units, ...DATA.titans].map(async (u) => {
      images.raw[u.id] = await loadImage(u.rawDataUrl);
      images.out[u.id] = await loadImage(u.outlinedDataUrl);
      if (u.has8Way && u.raw8DataUrl && u.outlined8DataUrl) {
        images.raw8[u.id] = await loadImage(u.raw8DataUrl);
        images.out8[u.id] = await loadImage(u.outlined8DataUrl);
      }
    }),
    loadImage(DATA.isoTank.hullDataUrl).then((img) => { images.isoHull = img; }),
    loadImage(DATA.isoTank.turretDataUrl).then((img) => { images.isoTurret = img; }),
    loadImage(DATA.isoTank.shadowDataUrl).then((img) => { images.isoShadow = img; }),
    ...DATA.micro4.map(async (m) => {
      images.micro4Raw[m.faction] = await loadImage(m.rawDataUrl);
      images.micro4Out[m.faction] = await loadImage(m.outlinedDataUrl);
    }),
    ...Object.entries(DATA.buildings).map(async ([id, b]) => {
      images.buildings[id] = await loadImage(b.dataUrl);
    }),
  ]);
  rebuildCastInspector();
  seedBattle();
  for (let i = 0; i < 24; i++) stepSim(0.05);
  updateHUD();
  renderBattle();
  renderCastInspector(0);
  requestAnimationFrame(loop);
}

init();
</script>
</body>
</html>
`;
}

// ---------- Main Entrypoint ----------

function main(): void {
  const tilesetDir = resolve(OUT_ROOT, 'tilesets');
  mkdirSync(SPRITE_DIR, { recursive: true });
  mkdirSync(tilesetDir, { recursive: true });

  const unitsMeta = buildUnitSheets();
  const titansMeta = buildTitanSheets();
  const micro4Meta = buildMicro4Sheets();
  const isoTank = buildIsoTankPayload();
  const buildings = buildAllBuildings();

  // Build true 8x8 tiling & Wang-16 transitioning terrain tileset, then compose the 512x288 map strictly from tiles!
  const tileset = buildTileset();
  const tilemap = buildDefaultBattleTilemap(WORLD_W / TILE_PX, WORLD_H / TILE_PX);
  const terrain = composeTilemap(tilemap, tileset);

  writeFileSync(resolve(tilesetDir, 'terrain-tileset-8x8.png'), encodePNG(tileset.atlas));
  writeFileSync(
    resolve(tilesetDir, 'tileset-manifest.json'),
    JSON.stringify(
      {
        tilePx: tileset.tilePx,
        atlasCols: tileset.cols,
        atlasRows: tileset.rows,
        wangCornerBits: { NW: 1, NE: 2, SW: 4, SE: 8 },
        rows: tileset.rowIndex,
        mapGrid: { width: tilemap.gridW, height: tilemap.gridH, ramps: tilemap.ramps },
      },
      null,
      2,
    ),
  );
  writeFileSync(resolve(OUT_ROOT, 'proof-tileset-8x8.png'), encodePNG(renderTilesetProof(tileset)));
  writeFileSync(resolve(OUT_ROOT, 'terrain-micro-512x288.png'), encodePNG(terrain));
  for (const [id, b] of Object.entries(buildings)) {
    writeFileSync(resolve(SPRITE_DIR, `building-${id}.png`), encodePNG(b.surface));
  }

  writeFileSync(
    resolve(SPRITE_DIR, 'manifest.json'),
    JSON.stringify(
      {
        infantryTilePx: 8,
        ultraMicroTilePx: 4,
        facings: FACINGS,
        anims: ANIMS,
        infantry: unitsMeta.map(({ id, name, role, faction, w, h, attackKind, frameOffsets, totalCols }) => ({
          id,
          name,
          role,
          faction,
          w,
          h,
          attackKind,
          frameOffsets,
          totalCols,
        })),
        titans: titansMeta.map(({ id, name, role, faction, layer, w, h, airAltitude, attackKind, frameOffsets, totalCols }) => ({
          id,
          name,
          role,
          faction,
          layer,
          w,
          h,
          airAltitude,
          attackKind,
          frameOffsets,
          totalCols,
        })),
      },
      null,
      2,
    ),
  );

  // Proofs
  const contactInf = renderSpriteContactProof(buildings);
  const contactTitans = renderTitansContactProof();
  const combinedBattle = renderCombinedArmsProof(terrain, buildings);
  const ultraBattle = renderUltra1000Proof(terrain, buildings);

  // Dedicated 4x Building Close-Up Proof (6 faction buildings on native biomes)
  const bCellW = 152;
  const bCellH = 136;
  const bPad = 3;
  const bList: readonly BuildingId[] = [
    'vanguard-bastion',
    'vanguard-turret',
    'kraxen-spire',
    'kraxen-colony',
    'solaris-nexus',
    'solaris-pylon',
  ];
  const bSheet = createSurface(3 * bCellW + 4 * bPad, 2 * bCellH + 3 * bPad, hexToU32('#0d1018'));
  const bGrass = makeTerrainSwatch(bCellW, bCellH, 'grass');
  const bCreep = makeTerrainSwatch(bCellW, bCellH, 'creep');
  const bDirt = makeTerrainSwatch(bCellW, bCellH, 'dirt');
  for (let i = 0; i < bList.length; i++) {
    const b = buildings[bList[i]];
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = bPad + col * (bCellW + bPad);
    const cy = bPad + row * (bCellH + bPad);
    const bg = b.faction === 'vanguard' ? bGrass : b.faction === 'kraxen' ? bCreep : bDirt;
    blitScaled(bSheet, bg, cx, cy, 1);
    fillRect(bSheet, cx, cy, bCellW, 3, accentBar(b.faction === 'neutral' ? 'vanguard' : b.faction));
    const zoom = 4;
    const bw = b.surface.width * zoom;
    const bh = b.surface.height * zoom;
    const ox = cx + Math.floor((bCellW - bw) / 2);
    const oy = cy + Math.floor((bCellH - bh) / 2) + 4;
    drawEllipse(bSheet, cx + Math.floor(bCellW / 2), oy + b.anchorY * zoom, b.shadowRx * zoom * 0.9, b.shadowRy * zoom * 0.9, SHADOW_GROUND);
    blitScaled(bSheet, b.surface, ox, oy, zoom);
  }
  const bProofPath = resolve(OUT_ROOT, 'proof-buildings.png');
  writeFileSync(bProofPath, encodePNG(bSheet));

  // Dedicated 3x Titan Animation Filmstrip Proof: BOTH SE and NE rows for all 6 Titans (12 rows)
  // Cols 0..3 = Move[0..3] | Cols 4..8 = Attack[0..4] (blank if atkN < 5!) | Cols 9..11 = Death[0..2]
  const aCellW = 68;
  const aCellH = 60;
  const aPad = 2;
  const aCols = 12;
  const aRows = TITAN_SPECS.length * 2;
  const aSheet = createSurface(
    aCols * aCellW + (aCols + 1) * aPad,
    aRows * aCellH + (aRows + 1) * aPad,
    hexToU32('#0d1018'),
  );
  const aDark = makeTerrainSwatch(aCellW, aCellH, 'dark');
  const aBlank = createSurface(aCellW, aCellH, hexToU32('#10131b'));

  for (let tIdx = 0; tIdx < TITAN_SPECS.length; tIdx++) {
    const spec = TITAN_SPECS[tIdx];
    const moveN = getTitanAnimFrameCount(spec.id, 'move');
    const atkN = getTitanAnimFrameCount(spec.id, 'attack');
    const deathN = getTitanAnimFrameCount(spec.id, 'death');

    const pairFacings: readonly FacingId[] = ['SE', 'NE'];
    for (let fRow = 0; fRow < pairFacings.length; fRow++) {
      const facing = pairFacings[fRow];
      const r = tIdx * 2 + fRow;
      const isNE = facing === 'NE';

      const seq: Array<{ anim: AnimId; idx: number; bar: number } | null> = [];
      for (let i = 0; i < 4; i++) {
        seq.push(i < moveN ? { anim: 'move', idx: i, bar: isNE ? hexToU32('#0ea5e9') : hexToU32('#38bdf8') } : null);
      }
      for (let i = 0; i < 5; i++) {
        seq.push(i < atkN ? { anim: 'attack', idx: i, bar: isNE ? hexToU32('#ea580c') : hexToU32('#f97316') } : null);
      }
      for (let i = 0; i < 3; i++) {
        seq.push(i < deathN ? { anim: 'death', idx: i, bar: isNE ? hexToU32('#b91c1c') : hexToU32('#ef4444') } : null);
      }

      for (let c = 0; c < aCols; c++) {
        const cx = aPad + c * (aCellW + aPad);
        const cy = aPad + r * (aCellH + aPad);
        const slot = seq[c];
        if (!slot) {
          blitScaled(aSheet, aBlank, cx, cy, 1);
          continue;
        }
        blitScaled(aSheet, aDark, cx, cy, 1);
        fillRect(aSheet, cx, cy, aCellW, 2, slot.bar);
        // Subtle 2px left marker on NE rows so SE vs NE pairs read at a glance
        if (isNE) {
          fillRect(aSheet, cx, cy + 2, 2, aCellH - 2, hexToU32('#6366f1'));
        }
        const sp = compileTitanFrame(spec.id, slot.anim, facing, slot.idx).outlined;
        const zoom = 3;
        const ox = cx + Math.floor((aCellW - sp.width * zoom) / 2);
        const oy = cy + Math.floor((aCellH - sp.height * zoom) / 2) + 2;
        if (slot.anim !== 'death' || spec.layer === 'ground' || slot.idx < 2) {
          const sScale = slot.anim === 'death' ? (slot.idx < 2 ? 0.8 : 0.6) : 1;
          drawEllipse(
            aSheet,
            cx + Math.floor(aCellW / 2),
            cy + aCellH - 7,
            spec.shadowRx * 2.2 * sScale,
            spec.shadowRy * 2.0 * sScale,
            SHADOW_GROUND,
          );
        }
        blitScaled(aSheet, sp, ox, oy, zoom);
      }
    }
  }
  const animProofPath = resolve(OUT_ROOT, 'proof-titan-anims.png');
  writeFileSync(animProofPath, encodePNG(aSheet));

  const infProofPath = resolve(OUT_ROOT, 'proof-8x8-sprites.png');
  const titanProofPath = resolve(OUT_ROOT, 'proof-titans-16x16.png');
  const vanguard8Path = resolve(OUT_ROOT, 'proof-8way-vanguard.png');
  const combinedPath = resolve(OUT_ROOT, 'proof-combined-arms-battle.png');
  const ultraPath = resolve(OUT_ROOT, 'proof-ultra-1000-swarm.png');
  const htmlPath = resolve(OUT_ROOT, 'micro-rts-showcase.html');

  writeFileSync(infProofPath, encodePNG(contactInf));
  writeFileSync(titanProofPath, encodePNG(contactTitans));
  writeFileSync(vanguard8Path, encodePNG(renderVanguard8WayProof(tileset, buildings)));
  writeFileSync(combinedPath, encodePNG(combinedBattle.surface2x));
  writeFileSync(ultraPath, encodePNG(ultraBattle.surface2x));
  writeFileSync(
    htmlPath,
    buildInteractiveShowcaseHTML(terrain, tileset, tilemap, unitsMeta, titansMeta, micro4Meta, isoTank, buildings),
    'utf8',
  );

  console.log(
    `Generated Mixed-Scale Micro-RTS Kit:\n` +
      `  - 6 8x8 infantry (8-way Vanguard Marine) + 6 Titans (22x20 8-way Iso Tank) + 3 4x4 factions\n` +
      `  - ${vanguard8Path}\n` +
      `  - ${titanProofPath}\n` +
      `  - ${combinedPath} (${combinedBattle.totalCount} units on screen)\n` +
      `  - ${ultraPath} (${ultraBattle.totalCount} units on screen)\n` +
      `  - ${htmlPath}`,
  );
}

main();
