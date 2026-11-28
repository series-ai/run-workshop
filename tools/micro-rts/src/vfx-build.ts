/**
 * Combat Attack & VFX Pack Builder:
 *  - Exports all 18 pixel-art VFX sprite strips (projectiles, melee slashes, explosions, status/utility)
 *  - Exports output/vfx/vfx-manifest.json & output/vfx/unit-attacks.json (complete 84-unit mapping!)
 *  - Exports output/vfx/proof-vfx-sprites.png (all VFX strips at 3x zoom on dark tactical grid)
 *  - Exports output/vfx/proof-vfx-beam-ramp.png (side-by-side Tier 1 -> Tier 2 -> Tier 3 discrete procedural beam!)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blitScaled,
  createSurface,
  encodePNG,
  hexToU32,
  type PixelSurface,
} from './pixel.ts';
import {
  bakeAllVfxSprites,
  drawDiscreteChainArc,
  drawDiscreteRampBeam,
  UNIT_ATTACK_CATALOG,
} from './vfx-attacks.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../output/vfx');

function drawChecker(dst: PixelSurface, x0: number, y0: number, w: number, h: number, cA: number, cB: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dst.pixels[(y0 + y) * dst.width + (x0 + x)] = (((x >> 3) + (y >> 3)) & 1) === 0 ? cA : cB;
    }
  }
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const baked = bakeAllVfxSprites();
  const manifest: unknown[] = [];

  for (const b of baked) {
    const file = `${b.spec.id}.png`;
    writeFileSync(resolve(OUT_DIR, file), encodePNG(b.strip));
    manifest.push({
      id: b.spec.id,
      name: b.spec.name,
      category: b.spec.category,
      outline: b.spec.outline,
      cellW: b.cellW,
      cellH: b.cellH,
      frames: b.frames.length,
      sheet: file,
    });
  }

  // Proof 1: All 18 VFX Sprite Strips at 3x zoom
  const zoom = 3;
  const maxW = Math.max(...baked.map((b) => b.strip.width));
  const colW = maxW * zoom + 16;
  const rowH = 38;
  const cols = 2;
  const rows = Math.ceil(baked.length / cols);
  const proof = createSurface(cols * colW + 4, rows * rowH + 4, hexToU32('#0d1018'));

  for (let i = 0; i < baked.length; i++) {
    const b = baked[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x0 = 2 + c * colW;
    const y0 = 2 + r * rowH;
    drawChecker(proof, x0 + 1, y0 + 1, colW - 2, rowH - 2, hexToU32('#1e242f'), hexToU32('#181d26'));
    const ox = x0 + Math.floor((colW - b.strip.width * zoom) / 2);
    const oy = y0 + Math.floor((rowH - b.strip.height * zoom) / 2);
    blitScaled(proof, b.strip, ox, oy, zoom);
  }
  writeFileSync(resolve(OUT_DIR, 'proof-vfx-sprites.png'), encodePNG(proof));

  // Proof 2: Discrete Procedural Ramping Laser (T1 / T2 / T3) + Chain Lightning showcase at 3x
  const beamDemo = createSurface(120, 64, hexToU32('#1b222c'));
  drawChecker(beamDemo, 0, 0, 120, 64, hexToU32('#212a27'), hexToU32('#1c2422'));
  drawDiscreteRampBeam(beamDemo, 10, 12, 108, 12, 1, 2, 'plasma');
  drawDiscreteRampBeam(beamDemo, 10, 26, 108, 26, 2, 4, 'plasma');
  drawDiscreteRampBeam(beamDemo, 10, 40, 108, 40, 3, 6, 'plasma');
  drawDiscreteChainArc(beamDemo, 10, 54, 60, 52, 1, true);
  drawDiscreteChainArc(beamDemo, 60, 52, 108, 56, 2, false);
  const beamProof = createSurface(120 * 3, 64 * 3, 0);
  blitScaled(beamProof, beamDemo, 0, 0, 3);
  writeFileSync(resolve(OUT_DIR, 'proof-vfx-beam-ramp.png'), encodePNG(beamProof));

  // Write manifests
  writeFileSync(resolve(OUT_DIR, 'vfx-manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(resolve(OUT_DIR, 'unit-attacks.json'), JSON.stringify(UNIT_ATTACK_CATALOG, null, 2));

  console.log(
    `Built Combat Attack & VFX Pack: ${baked.length} VFX sprite strips + ${UNIT_ATTACK_CATALOG.length}-unit attack mapping -> ${OUT_DIR}`,
  );
}

main();
