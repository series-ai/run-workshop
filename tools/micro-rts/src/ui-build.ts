/**
 * RTS UI & HUD Chrome Pack Builder:
 *  - Exports 4 sizes x 4 states of 3/4 selection ellipses (sel-{sm,md,lg,bldg}.png)
 *  - Exports 8 tactical cursors, 5 in-world order/placement markers, and 12 command/resource icons
 *  - Exports output/ui/ui-manifest.json & output/ui/proof-ui-chrome.png
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
  bakeAllUiSprites,
  buildSelectionRing,
  type SelectionState,
} from './ui-chrome.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../output/ui');

function drawChecker(dst: PixelSurface, x0: number, y0: number, w: number, h: number, cA: number, cB: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dst.pixels[(y0 + y) * dst.width + (x0 + x)] = (((x >> 3) + (y >> 3)) & 1) === 0 ? cA : cB;
    }
  }
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const ringSizes: ReadonlyArray<{ id: string; w: number; h: number }> = [
    { id: 'sel-sm', w: 14, h: 9 },
    { id: 'sel-md', w: 20, h: 12 },
    { id: 'sel-lg', w: 26, h: 15 },
    { id: 'sel-bldg', w: 36, h: 20 },
  ];
  const ringStates: readonly SelectionState[] = ['selected', 'hover', 'enemy', 'ally'];
  const ringManifest: unknown[] = [];

  for (const rs of ringSizes) {
    const strip = createSurface(rs.w * ringStates.length, rs.h, 0);
    for (let i = 0; i < ringStates.length; i++) {
      const ring = buildSelectionRing(rs.w, rs.h, ringStates[i], ringStates[i] === 'hover');
      blitScaled(strip, ring, i * rs.w, 0, 1);
    }
    const file = `${rs.id}.png`;
    writeFileSync(resolve(OUT_DIR, file), encodePNG(strip));
    ringManifest.push({ id: rs.id, cellW: rs.w, cellH: rs.h, states: ringStates, sheet: file });
  }

  const baked = bakeAllUiSprites();
  const spriteManifest: unknown[] = [];
  for (const b of baked) {
    const file = `${b.spec.id}.png`;
    writeFileSync(resolve(OUT_DIR, file), encodePNG(b.strip));
    spriteManifest.push({
      id: b.spec.id,
      name: b.spec.name,
      category: b.spec.category,
      cellW: b.cellW,
      cellH: b.cellH,
      frames: b.frames.length,
      sheet: file,
    });
  }

  // Render proof sheet at 2x
  const cols = 5;
  const cellW = 92;
  const cellH = 38;
  const rows = Math.ceil(baked.length / cols);
  const proof = createSurface(cols * cellW + 4, rows * cellH + 4, hexToU32('#0d1018'));
  for (let i = 0; i < baked.length; i++) {
    const b = baked[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x0 = 2 + c * cellW;
    const y0 = 2 + r * cellH;
    drawChecker(proof, x0 + 1, y0 + 1, cellW - 2, cellH - 2, hexToU32('#232d27'), hexToU32('#1d2521'));
    const ox = x0 + Math.floor((cellW - b.strip.width * 2) / 2);
    const oy = y0 + Math.floor((cellH - b.strip.height * 2) / 2);
    blitScaled(proof, b.strip, ox, oy, 2);
  }
  writeFileSync(resolve(OUT_DIR, 'proof-ui-chrome.png'), encodePNG(proof));

  writeFileSync(
    resolve(OUT_DIR, 'ui-manifest.json'),
    JSON.stringify({ selectionRings: ringManifest, sprites: spriteManifest }, null, 2),
  );

  console.log(`Built RTS UI Chrome Pack: ${ringSizes.length} selection ring sets + ${baked.length} UI sprites -> ${OUT_DIR}`);
}

main();
