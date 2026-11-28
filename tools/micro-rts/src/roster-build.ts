/**
 * Full 72-Unit Production Roster Builder (V01..V24, K01..K24, S01..S24).
 *
 * Exports:
 *  - output/roster/<ID>-8way.png         (all 72 units: 8 headings x 12 frames = idle/move/attack/death)
 *  - output/roster/<ID>-hull.png         (12 two-layer units: 8 headings x 4 move phases)
 *  - output/roster/<ID>-turret.png       (12 two-layer units: 8 headings x 4 attack/recoil frames)
 *  - output/roster/<ID>-shadow.png       (12 two-layer units: 8 headings x 1 contact shadow)
 *  - output/roster/K18-body.png & tail   (multi-segment path-following creature)
 *  - output/roster/V20-rotors.png        (2-frame spinning rotor overlay)
 *  - output/roster/worker-mineral-carry.png (shared mineral-crystal carry overlay for all 9 workers)
 *  - output/roster/roster-manifest.json  (complete engine-ready metadata for all 72 units)
 *  - output/roster/proof-8way-{vanguard,kraxen,solaris}.png (all 24 units x 8 headings per faction)
 *  - output/roster/proof-2layer-turrets.png (all 12 two-layer units: hull SE x turret N..NW firing!)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INK_OUTLINE, SHADOW_GROUND, type FactionId } from './palette.ts';
import {
  addPixelOutline,
  blitScaled,
  createSurface,
  drawEllipse,
  encodePNG,
  fillRect,
  hexToU32,
  type PixelSurface,
} from './pixel.ts';
import { KRAXEN_RIGS } from './roster-kraxen.ts';
import { SOLARIS_RIGS } from './roster-solaris.ts';
import { VANGUARD_RIGS } from './roster-vanguard.ts';
import {
  buildTankContactShadow,
  compileRawTankHull,
  compileRawTankTurret,
  composeIsoTank,
  TANK_HULL_PIVOT,
  TANK_MUZZLE_REL_8,
  TANK_OUT_H,
  TANK_OUT_W,
} from './tankIso.ts';
import { compileTitanFrame8, TITAN_SPEC_BY_ID, type TitanId } from './titans.ts';
import { DIRS_8, type Dir8 } from './units.ts';
import {
  bakeRigUnit,
  buildWorkerMineralCarryOverlay,
  composeBakedTwoLayer,
  type UnitRigSpec,
} from './voxel-baker.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../output/roster');

interface RosterManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly role: string;
  readonly layer: 'ground' | 'air';
  readonly twoLayer: boolean;
  readonly special?: 'worker' | 'rotor' | 'centipede';
  readonly source: 'hand-authored' | 'rig-baked';
  readonly cellW: number;
  readonly cellH: number;
  readonly cols: number;
  readonly sheet: string;
  readonly hullSheet?: string;
  readonly turretSheet?: string;
  readonly shadowSheet?: string;
  readonly overlaySheet?: string;
  readonly bodySheet?: string;
  readonly tailSheet?: string;
  readonly muzzleRel8?: Readonly<Record<Dir8, readonly [number, number]>>;
  /** Exact [x, y] pixel coordinate inside (cellW, cellH) for each of the 8 headings! */
  readonly muzzleCell8?: Readonly<Record<Dir8, readonly [number, number]>>;
}

// Tiny crisp 3x5 bitmap font for proof sheet ID badges
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
  V: ['101', '101', '101', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
};

function drawBadgeText(dst: PixelSurface, text: string, x0: number, y0: number, scale: number, col: number): void {
  let cx = x0;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) {
      cx += 4 * scale;
      continue;
    }
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === '1') fillRect(dst, cx + c * scale, y0 + r * scale, scale, scale, col);
      }
    }
    cx += 4 * scale;
  }
}

function buildHandAuthoredTitanSheet(titanId: TitanId): { sheet: PixelSurface; cellW: number; cellH: number } {
  const spec = TITAN_SPEC_BY_ID[titanId];
  const sample = compileTitanFrame8(titanId, 'idle', 'SE', 0).outlined;
  const cellW = sample.width;
  const cellH = sample.height;
  const sheet = createSurface(cellW * 12, cellH * 8, 0);
  const seq: ReadonlyArray<['idle' | 'move' | 'attack' | 'death', number]> = [
    ['idle', 0],
    ['move', 0],
    ['move', 1],
    ['move', 2],
    ['move', 3],
    ['attack', 0],
    ['attack', 1],
    ['attack', 2],
    ['attack', 3],
    ['death', 0],
    ['death', 1],
    ['death', 2],
  ];
  for (let d = 0; d < 8; d++) {
    for (let c = 0; c < seq.length; c++) {
      const f = compileTitanFrame8(titanId, seq[c][0], DIRS_8[d], seq[c][1]).outlined;
      blitScaled(sheet, f, c * cellW, d * cellH, 1);
    }
  }
  return { sheet, cellW, cellH };
}

function buildHandAuthoredTankSheets(): {
  sheet8Way: PixelSurface;
  hullSheet: PixelSurface;
  turretSheet: PixelSurface;
  shadowSheet: PixelSurface;
  cellW: number;
  cellH: number;
} {
  const cellW = TANK_OUT_W;
  const cellH = TANK_OUT_H;
  const sheet8Way = createSurface(cellW * 12, cellH * 8, 0);
  const hullSheet = createSurface(cellW * 4, cellH * 8, 0);
  const turretSheet = createSurface(cellW * 4, cellH * 8, 0);
  const shadowSheet = createSurface(cellW, cellH * 8, 0);

  for (let d = 0; d < 8; d++) {
    const dir = DIRS_8[d];
    // Idle[0] + Move[0..3] + Attack[0..3] + Death[0..2]
    blitScaled(sheet8Way, composeIsoTank(dir, dir, 0, 0, 'default'), 0, d * cellH, 1);
    for (let m = 0; m < 4; m++) {
      blitScaled(sheet8Way, composeIsoTank(dir, dir, m, 0, 'default'), (1 + m) * cellW, d * cellH, 1);
      blitScaled(hullSheet, addPixelOutline(compileRawTankHull(dir, m, 'default'), INK_OUTLINE), m * cellW, d * cellH, 1);
    }
    for (let a = 0; a < 4; a++) {
      blitScaled(sheet8Way, composeIsoTank(dir, dir, 0, a, 'default'), (5 + a) * cellW, d * cellH, 1);
      blitScaled(turretSheet, addPixelOutline(compileRawTankTurret(dir, a, 'default'), INK_OUTLINE), a * cellW, d * cellH, 1);
    }
    for (let k = 0; k < 3; k++) {
      const dead = compileTitanFrame8('vanguard-tank', 'death', dir, k).outlined;
      const ox = Math.floor((cellW - dead.width) / 2);
      const oy = Math.floor((cellH - dead.height) / 2);
      blitScaled(sheet8Way, dead, (9 + k) * cellW + ox, d * cellH + oy, 1);
    }
    blitScaled(shadowSheet, buildTankContactShadow(dir), 0, d * cellH, 1);
  }
  return { sheet8Way, hullSheet, turretSheet, shadowSheet, cellW, cellH };
}

function cropCell(sheet: PixelSurface, col: number, row: number, cellW: number, cellH: number): PixelSurface {
  const out = createSurface(cellW, cellH, 0);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      out.pixels[y * cellW + x] = sheet.pixels[(row * cellH + y) * sheet.width + (col * cellW + x)];
    }
  }
  return out;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'worker-mineral-carry.png'), encodePNG(buildWorkerMineralCarryOverlay()));

  const manifest: RosterManifestEntry[] = [];
  const sheetsById = new Map<string, { sheet: PixelSurface; cellW: number; cellH: number; layer: 'ground' | 'air' }>();
  const rigById = new Map<string, UnitRigSpec>();

  // 1. Export the 4 verified hand-authored hero sheets (V16, V22, K16, S22)
  {
    const tank = buildHandAuthoredTankSheets();
    writeFileSync(resolve(OUT_DIR, 'V16-8way.png'), encodePNG(tank.sheet8Way));
    writeFileSync(resolve(OUT_DIR, 'V16-hull.png'), encodePNG(tank.hullSheet));
    writeFileSync(resolve(OUT_DIR, 'V16-turret.png'), encodePNG(tank.turretSheet));
    writeFileSync(resolve(OUT_DIR, 'V16-shadow.png'), encodePNG(tank.shadowSheet));
    sheetsById.set('V16', { sheet: tank.sheet8Way, cellW: tank.cellW, cellH: tank.cellH, layer: 'ground' });
    const tankMuzzleCell8 = Object.fromEntries(
      DIRS_8.map((d) => {
        const [px, py] = TANK_HULL_PIVOT[d];
        const [mx, my] = TANK_MUZZLE_REL_8[d];
        const tipBonusX = d === 'E' ? 2 : d === 'W' ? -2 : 0;
        return [d, [px + mx + 1 + tipBonusX, py + my + 1]];
      }),
    ) as Record<Dir8, readonly [number, number]>;
    manifest.push({
      id: 'V16',
      name: 'Siege Tank',
      faction: 'vanguard',
      role: 'Heavy Ground',
      layer: 'ground',
      twoLayer: true,
      source: 'hand-authored',
      cellW: tank.cellW,
      cellH: tank.cellH,
      cols: 12,
      sheet: 'V16-8way.png',
      hullSheet: 'V16-hull.png',
      turretSheet: 'V16-turret.png',
      shadowSheet: 'V16-shadow.png',
      muzzleRel8: TANK_MUZZLE_REL_8,
      muzzleCell8: tankMuzzleCell8,
    });
  }

  const handTitans: ReadonlyArray<{ id: string; titanId: TitanId; name: string; faction: FactionId; role: string; layer: 'ground' | 'air' }> = [
    { id: 'V22', titanId: 'vanguard-gunship', name: 'Valkyrie', faction: 'vanguard', role: 'Heavy Air', layer: 'air' },
    { id: 'K16', titanId: 'kraxen-behemoth', name: 'Behemoth', faction: 'kraxen', role: 'Heavy Ground', layer: 'ground' },
    { id: 'S22', titanId: 'solaris-carrier', name: 'Sky-Carrier', faction: 'solaris', role: 'Heavy Air', layer: 'air' },
  ];
  for (const ht of handTitans) {
    const built = buildHandAuthoredTitanSheet(ht.titanId);
    const file = `${ht.id}-8way.png`;
    writeFileSync(resolve(OUT_DIR, file), encodePNG(built.sheet));
    sheetsById.set(ht.id, { sheet: built.sheet, cellW: built.cellW, cellH: built.cellH, layer: ht.layer });
    manifest.push({
      id: ht.id,
      name: ht.name,
      faction: ht.faction,
      role: ht.role,
      layer: ht.layer,
      twoLayer: false,
      source: 'hand-authored',
      cellW: built.cellW,
      cellH: built.cellH,
      cols: 12,
      sheet: file,
    });
  }

  // 2. Bake all 68 articulated 3D micro-pixel rigs across Vanguard, Kraxen, and Solaris
  const allRigs: readonly UnitRigSpec[] = [...VANGUARD_RIGS, ...KRAXEN_RIGS, ...SOLARIS_RIGS];
  for (const spec of allRigs) {
    rigById.set(spec.id, spec);
    const baked = bakeRigUnit(spec, 'default');
    const sheetFile = `${spec.id}-8way.png`;
    writeFileSync(resolve(OUT_DIR, sheetFile), encodePNG(baked.sheet8Way));
    sheetsById.set(spec.id, { sheet: baked.sheet8Way, cellW: baked.cellW, cellH: baked.cellH, layer: spec.layer });

    let hullSheet: string | undefined;
    let turretSheet: string | undefined;
    let shadowSheet: string | undefined;
    if (baked.hullSheet && baked.turretSheet && baked.shadowSheet) {
      hullSheet = `${spec.id}-hull.png`;
      turretSheet = `${spec.id}-turret.png`;
      shadowSheet = `${spec.id}-shadow.png`;
      writeFileSync(resolve(OUT_DIR, hullSheet), encodePNG(baked.hullSheet));
      writeFileSync(resolve(OUT_DIR, turretSheet), encodePNG(baked.turretSheet));
      writeFileSync(resolve(OUT_DIR, shadowSheet), encodePNG(baked.shadowSheet));
    }

    let overlaySheet: string | undefined;
    if (baked.overlaySheet) {
      overlaySheet = `${spec.id}-rotors.png`;
      writeFileSync(resolve(OUT_DIR, overlaySheet), encodePNG(baked.overlaySheet));
    }
    let bodySheet: string | undefined;
    let tailSheet: string | undefined;
    if (baked.bodySheet && baked.tailSheet) {
      bodySheet = `${spec.id}-body.png`;
      tailSheet = `${spec.id}-tail.png`;
      writeFileSync(resolve(OUT_DIR, bodySheet), encodePNG(baked.bodySheet));
      writeFileSync(resolve(OUT_DIR, tailSheet), encodePNG(baked.tailSheet));
    }

    const baseY =
      spec.baseOffsetY ?? (spec.layer === 'air' ? Math.round(spec.coreH * 0.44) : Math.max(3, Math.round(spec.coreH * 0.2)));
    const rigMuzzleCell8 = Object.fromEntries(
      DIRS_8.map((d) => {
        const [rx, ry] = baked.muzzleRel8[d];
        return [d, [Math.floor(spec.coreW / 2) + rx + 1, spec.coreH - baseY + ry + 1]];
      }),
    ) as Record<Dir8, readonly [number, number]>;
    manifest.push({
      id: spec.id,
      name: spec.name,
      faction: spec.faction as FactionId,
      role: spec.role,
      layer: spec.layer,
      twoLayer: baked.twoLayer,
      ...(spec.special ? { special: spec.special } : {}),
      source: 'rig-baked',
      cellW: baked.cellW,
      cellH: baked.cellH,
      cols: 12,
      sheet: sheetFile,
      ...(hullSheet ? { hullSheet, turretSheet, shadowSheet } : {}),
      ...(overlaySheet ? { overlaySheet } : {}),
      ...(bodySheet ? { bodySheet, tailSheet } : {}),
      muzzleRel8: baked.muzzleRel8,
      muzzleCell8: rigMuzzleCell8,
    });
  }

  // Sort manifest cleanly by faction & numeric ID (V01..V24, K01..K24, S01..S24)
  const fOrder: Record<FactionId, number> = { vanguard: 0, kraxen: 1, solaris: 2 };
  manifest.sort((a, b) => fOrder[a.faction] - fOrder[b.faction] || a.id.localeCompare(b.id));
  writeFileSync(resolve(OUT_DIR, 'roster-manifest.json'), JSON.stringify(manifest, null, 2));

  // 3. Render 3 faction 8-way turntable proof sheets (24 rows x 8 headings at 2x!)
  const bgMap: Record<FactionId, readonly [number, number, number]> = {
    vanguard: [hexToU32('#2f4d31'), hexToU32('#375a38'), hexToU32('#7cc4ff')],
    kraxen: [hexToU32('#34193c'), hexToU32('#42214c'), hexToU32('#ff8ad4')],
    solaris: [hexToU32('#77654a'), hexToU32('#867355'), hexToU32('#ffe074')],
  };

  for (const f of ['vanguard', 'kraxen', 'solaris'] as const) {
    const fEntries = manifest.filter((m) => m.faction === f);
    const cellW = 58;
    const cellH = 46;
    const pad = 2;
    const labelW = 36;
    const proof = createSurface(
      labelW + 8 * cellW + 9 * pad,
      fEntries.length * cellH + (fEntries.length + 1) * pad,
      hexToU32('#0d1018'),
    );
    const [cA, cB, badgeCol] = bgMap[f];
    for (let r = 0; r < fEntries.length; r++) {
      const ent = fEntries[r];
      const info = sheetsById.get(ent.id)!;
      const cy = pad + r * (cellH + pad);
      fillRect(proof, pad, cy, labelW - pad, cellH, hexToU32('#141925'));
      drawBadgeText(proof, ent.id, pad + 5, cy + Math.floor((cellH - 10) / 2), 2, badgeCol);

      for (let d = 0; d < 8; d++) {
        const cx = labelW + pad + d * (cellW + pad);
        for (let py = 0; py < cellH; py += 8) {
          for (let px = 0; px < cellW; px += 8) {
            fillRect(proof, cx + px, cy + py, Math.min(8, cellW - px), Math.min(8, cellH - py), (((px >> 3) + (py >> 3)) & 1) ? cB : cA);
          }
        }
        const frame = cropCell(info.sheet, 0, d, info.cellW, info.cellH);
        const z = 2;
        const ox = cx + Math.floor((cellW - frame.width * z) / 2);
        const oy = cy + Math.floor((cellH - frame.height * z) / 2);
        drawEllipse(
          proof,
          cx + Math.floor(cellW / 2),
          oy + frame.height * z - (ent.layer === 'air' ? 1 : 4),
          Math.max(8, Math.floor(frame.width * 0.72)),
          4,
          SHADOW_GROUND,
        );
        blitScaled(proof, frame, ox, oy - (ent.layer === 'air' ? 3 : 0), z);
      }
    }
    writeFileSync(resolve(OUT_DIR, `proof-8way-${f}.png`), encodePNG(proof));
  }

  // 4. Render dedicated 2-Layer Independent Turret Rotation Proof (12 rows x 8 turret headings on fixed SE hull!)
  const twoLayerIds = ['V12', 'V13', 'V14', 'V16', 'V17', 'V18', 'K14', 'K17', 'S14', 'S16', 'S17', 'S18'];
  {
    const cellW = 72;
    const cellH = 66;
    const pad = 2;
    const labelW = 40;
    const proof = createSurface(
      labelW + 8 * cellW + 9 * pad,
      twoLayerIds.length * cellH + (twoLayerIds.length + 1) * pad,
      hexToU32('#0d1018'),
    );
    for (let r = 0; r < twoLayerIds.length; r++) {
      const id = twoLayerIds[r];
      const ent = manifest.find((m) => m.id === id)!;
      const [cA, cB, badgeCol] = bgMap[ent.faction];
      const cy = pad + r * (cellH + pad);
      fillRect(proof, pad, cy, labelW - pad, cellH, hexToU32('#141925'));
      drawBadgeText(proof, id, pad + 6, cy + Math.floor((cellH - 10) / 2), 2, badgeCol);

      for (let d = 0; d < 8; d++) {
        const tDir = DIRS_8[d];
        const cx = labelW + pad + d * (cellW + pad);
        for (let py = 0; py < cellH; py += 8) {
          for (let px = 0; px < cellW; px += 8) {
            fillRect(proof, cx + px, cy + py, Math.min(8, cellW - px), Math.min(8, cellH - py), (((px >> 3) + (py >> 3)) & 1) ? cB : cA);
          }
        }
        // Show firing flash on odd headings so muzzle flashes & recoil are verified too!
        const atkFrame = d % 2 === 1 ? 1 : 0;
        const surf =
          id === 'V16'
            ? composeIsoTank('SE', tDir, 0, atkFrame, 'default')
            : composeBakedTwoLayer(rigById.get(id)!, 'SE', tDir, 0, atkFrame, 'default');
        const z = 3;
        const ox = cx + Math.floor((cellW - surf.width * z) / 2);
        const oy = cy + Math.floor((cellH - surf.height * z) / 2);
        drawEllipse(proof, cx + Math.floor(cellW / 2), oy + surf.height * z - 6, Math.floor(surf.width * 1.1), 6, SHADOW_GROUND);
        blitScaled(proof, surf, ox, oy, z);
      }
    }
    writeFileSync(resolve(OUT_DIR, 'proof-2layer-turrets.png'), encodePNG(proof));
  }

  console.log(
    `Built full 72-unit roster (${manifest.filter((m) => m.twoLayer).length} two-layer split units) -> ${OUT_DIR}`,
  );
}

main();
