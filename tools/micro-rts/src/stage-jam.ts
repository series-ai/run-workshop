/**
 * Stages built RUN Micro-RTS (`micro-rts`) assets into a `jam-ready-assets` checkout:
 *   - Leaf 1: `<target>/run-micro-rts/2D/space-scifi/`
 *       units/, buildings/, environment/, vfx/, micro-rts-manifest.json, Samples/, License.txt, README.md
 *   - Leaf 2: `<target>/run-micro-rts/ui/`
 *       selection-rings/, cursors/, markers/, icons/, ui-manifest.json, Samples/, License.txt, README.md
 *   - Hero 512x512 square preview sources in `<target>/scripts/preview-inputs/`
 *   - Upserts `preview-sources.json` and generates `<leaf>/preview.webp` if `sharp` is available in `<target>`
 *
 * Usage:
 *   cd tools/micro-rts && npm run build:all && npm run stage -- --target ~/dev/jam-ready-assets
 */

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
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
const TOOL_ROOT = resolve(HERE, '..');
const OUT = join(TOOL_ROOT, 'output');
const REPO_LICENSE = resolve(TOOL_ROOT, '../../LICENSE.md');

const PACK_DIR = 'run-micro-rts';
const LEAF_2D = `${PACK_DIR}/2D/space-scifi`;
const LEAF_UI = `${PACK_DIR}/ui`;

const SOURCE_URL = 'https://github.com/series-ai/run-workshop/tree/main/tools/micro-rts';
const RUN_LICENSE = 'LicenseRef-RUN-Repository-Supplemental-1.0';
const VERIFIED_BY = 'run-workshop maintainers';
const TODAY = new Date().toISOString().slice(0, 10);

const PREVIEW_MAX_BYTES = 100 * 1024;
const PREVIEW_MAX_DIMENSION = 512;

interface SharpPipeline {
  rotate: () => SharpPipeline;
  extract: (region: { left: number; top: number; width: number; height: number }) => SharpPipeline;
  resize: (
    w: number,
    h: number,
    opts?: { fit?: string; withoutEnlargement?: boolean; kernel?: string; background?: { r: number; g: number; b: number; alpha: number } },
  ) => SharpPipeline;
  composite: (inputs: Array<{ input: Buffer; left: number; top: number }>) => SharpPipeline;
  png: () => SharpPipeline;
  webp: (opts: { quality: number; effort: number }) => SharpPipeline;
  toBuffer: ((opts: { resolveWithObject: true }) => Promise<{ data: Buffer; info: { width: number; height: number } }>) &
    (() => Promise<Buffer>);
}

interface SharpModule {
  (input: Buffer | { create: { width: number; height: number; channels: 4; background: { r: number; g: number; b: number; alpha: number } } }, opts?: Record<string, unknown>): SharpPipeline;
  versions: { sharp: string; webp: string };
}

function loadTargetSharp(target: string): SharpModule {
  const req = createRequire(join(target, 'package.json'));
  return req('sharp') as SharpModule;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJson<T>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, 'utf8')) as T;
}

function writeJson(absPath: string, data: unknown): void {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function copyChecked(src: string, dst: string): void {
  if (!existsSync(src)) {
    throw new Error(`Missing built asset: ${src}. Run \`npm run build:all\` first.`);
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

function licenseText(subtitle: string): string {
  const license = readFileSync(REPO_LICENSE, 'utf8');
  const spdx = `SPDX-License-Identifier: ${RUN_LICENSE}`;
  if (!license.includes(spdx)) {
    throw new Error(`${REPO_LICENSE} is missing ${spdx}`);
  }
  return `${spdx}
Source: ${SOURCE_URL}
Verified-by: ${VERIFIED_BY}, ${TODAY}

RUN Micro-RTS (${PACK_DIR}) — ${subtitle}
Copyright (c) 2026 Series Entertainment, Inc.
Made for the RUN platform. Licensed under the RUN Repository Supplemental
License v1.0 below: use it in RUN projects; it converts to MIT on January 1,
2028.

${license.trim()}
`;
}

function fillRect(s: PixelSurface, x0: number, y0: number, w: number, h: number, col: number): void {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= s.height) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= s.width) continue;
      s.pixels[y * s.width + x] = col;
    }
  }
}

function strokeRect(s: PixelSurface, x0: number, y0: number, w: number, h: number, col: number): void {
  fillRect(s, x0, y0, w, 1, col);
  fillRect(s, x0, y0 + h - 1, w, 1, col);
  fillRect(s, x0, y0, 1, h, col);
  fillRect(s, x0 + w - 1, y0, 1, h, col);
}

/** Crisp 512x512 (170x170 @ 3x nearest-neighbor) square showcase of all UI chrome assets. */
function buildUiPreviewPng(): Buffer {
  const base = createSurface(170, 170, hexToU32('#101622'));
  const cardBg = hexToU32('#172030');
  const cardBorder = hexToU32('#2c3c56');

  // Panel 1: 4x4 Selection Rings (top half, generous 39px column pitch so 36px sel-bldg never overlaps)
  fillRect(base, 4, 5, 162, 78, cardBg);
  strokeRect(base, 4, 5, 162, 78, cardBorder);
  const ringSizes = [
    { w: 14, h: 9, y: 10 },
    { w: 20, h: 12, y: 23 },
    { w: 26, h: 15, y: 39 },
    { w: 36, h: 20, y: 58 },
  ];
  const states: readonly SelectionState[] = ['selected', 'hover', 'enemy', 'ally'];
  const colCenters = [26, 65, 105, 144];
  for (const tier of ringSizes) {
    for (let si = 0; si < states.length; si++) {
      const ring = buildSelectionRing(tier.w, tier.h, states[si]);
      const drawX = Math.round(colCenters[si] - tier.w / 2);
      blitScaled(base, ring, drawX, tier.y, 1);
    }
  }

  const allUi = bakeAllUiSprites();
  const cursors = allUi.filter((u) => u.spec.category === 'cursor');
  const markers = allUi.filter((u) => u.spec.category === 'marker');
  const icons = allUi.filter((u) => u.spec.category === 'icon');

  // Panel 2: 8 Tactical Cursors (top row) + 5 World Order & Placement Markers (bottom row)
  fillRect(base, 4, 88, 162, 39, cardBg);
  strokeRect(base, 4, 88, 162, 39, cardBorder);
  for (let i = 0; i < cursors.length; i++) {
    const f = cursors[i].frames[0];
    const cx = 18 + i * 19;
    blitScaled(base, f, Math.round(cx - f.width / 2), 93 + Math.floor((12 - f.height) / 2), 1);
  }
  for (let i = 0; i < markers.length; i++) {
    const f = markers[i].frames[Math.min(1, markers[i].frames.length - 1)];
    const cx = 25 + i * 30;
    blitScaled(base, f, Math.round(cx - f.width / 2), 112 + Math.floor((10 - f.height) / 2), 1);
  }

  // Panel 3: 12 HUD Resource & Command Icons (2 crisp rows of 6)
  fillRect(base, 4, 132, 162, 33, cardBg);
  strokeRect(base, 4, 132, 162, 33, cardBorder);
  for (let i = 0; i < icons.length; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const f = icons[i].frames[0];
    const cx = 22 + col * 25;
    blitScaled(base, f, Math.round(cx - f.width / 2), 137 + row * 13, 1);
  }

  const hi = createSurface(512, 512, hexToU32('#101622'));
  blitScaled(hi, base, 1, 1, 3);
  return encodePNG(hi);
}

/** Crisp 512x512 square hero cover for the 2D micro-RTS pack combining battle scene + buildings + biomes. */
async function build2dPreviewPng(sharp: SharpModule): Promise<Buffer> {
  const battle = readFileSync(join(OUT, 'proof-combined-arms-battle.png'));
  const buildings = readFileSync(join(OUT, 'proof-buildings.png'));
  const biomes = readFileSync(join(OUT, 'environment/proof-env-biomes.png'));

  // Top hero (512x336): crisp native-pixel center crop of the 768x432 combined-arms battle proof
  const topHero = await sharp(battle)
    .extract({ left: 128, top: 48, width: 512, height: 336 })
    .png()
    .toBuffer();

  // Bottom-left (255x174): grounded faction buildings proof (3 faction rows + props, nearest-neighbor fit)
  const botLeft = await sharp(buildings)
    .resize(255, 174, {
      fit: 'contain',
      kernel: 'nearest',
      background: { r: 16, g: 22, b: 34, alpha: 1 },
    })
    .png()
    .toBuffer();

  // Bottom-right (255x174): 4 planet biomes + cliffs proof (nearest-neighbor fit)
  const botRight = await sharp(biomes)
    .resize(255, 174, {
      fit: 'contain',
      kernel: 'nearest',
      background: { r: 16, g: 22, b: 34, alpha: 1 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 13, g: 17, b: 26, alpha: 1 },
    },
  })
    .composite([
      { input: topHero, left: 0, top: 0 },
      { input: botLeft, left: 0, top: 338 },
      { input: botRight, left: 257, top: 338 },
    ])
    .png()
    .toBuffer();
}

async function renderLeafWebp(
  sharp: SharpModule,
  sourceBytes: Buffer,
  sourceSha256: string,
  outPath: string,
): Promise<{
  outputSha256: string;
  outputSourceSha256: string;
  width: number;
  height: number;
  bytes: number;
  recipe: string;
}> {
  const recipe = `sharp-${sharp.versions.sharp}-webp-${sharp.versions.webp}-512-fit-inside-q85-75-65-v1-frame0`;
  let result: { data: Buffer; info: { width: number; height: number } } | undefined;
  for (const quality of [85, 75, 65]) {
    result = await sharp(sourceBytes, { page: 0, pages: 1, limitInputPixels: 100_000_000 })
      .rotate()
      .resize(PREVIEW_MAX_DIMENSION, PREVIEW_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length <= PREVIEW_MAX_BYTES) break;
  }
  if (!result || result.data.length > PREVIEW_MAX_BYTES) {
    throw new Error(`${outPath}: generated preview.webp exceeds ${PREVIEW_MAX_BYTES} bytes`);
  }
  writeFileSync(outPath, result.data);
  return {
    outputSha256: sha256(result.data),
    outputSourceSha256: sourceSha256,
    width: result.info.width,
    height: result.info.height,
    bytes: result.data.length,
    recipe,
  };
}

async function main(): Promise<void> {
  const t = process.argv.indexOf('--target');
  const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '');
  if (!target || !existsSync(join(target, 'scripts/build-manifest.mjs'))) {
    throw new Error('--target must point to a jam-ready-assets checkout');
  }
  const selectionsFile = join(target, 'preview-sources.json');
  if (!existsSync(selectionsFile)) {
    throw new Error(`Missing ${selectionsFile} in target checkout`);
  }
  if (!existsSync(join(OUT, 'micro-rts-manifest.json'))) {
    throw new Error('Build outputs missing; run `npm run build:all` first.');
  }

  const sharp = loadTargetSharp(target);
  const packDest = join(target, PACK_DIR);
  const leaf2dDest = join(target, LEAF_2D);
  const leafUiDest = join(target, LEAF_UI);

  rmSync(packDest, { recursive: true, force: true });
  mkdirSync(leaf2dDest, { recursive: true });
  mkdirSync(leafUiDest, { recursive: true });

  // -------------------------------------------------------------------------
  // 1. Stage Leaf 1: run-micro-rts/2D/space-scifi/
  // -------------------------------------------------------------------------
  interface RosterEntry {
    id: string;
    name: string;
    faction: string;
    sheet: string;
    hullSheet?: string;
    turretSheet?: string;
    shadowSheet?: string;
    overlaySheet?: string;
    bodySheet?: string;
    tailSheet?: string;
    [k: string]: unknown;
  }

  const rawRoster = readJson<RosterEntry[]>(join(OUT, 'roster/roster-manifest.json'));
  const stagedRoster: RosterEntry[] = [];
  for (const unit of rawRoster) {
    const slug = slugify(unit.name);
    const base = `units/${unit.faction}/${unit.id}-${slug}`;
    const copyUnitSheet = (srcName: string, suffix: string): string => {
      const rel = `${base}-${suffix}.png`;
      copyChecked(join(OUT, 'roster', srcName), join(leaf2dDest, rel));
      return rel;
    };
    const next: RosterEntry = {
      ...unit,
      sheet: copyUnitSheet(unit.sheet, '8way'),
    };
    if (unit.hullSheet) next.hullSheet = copyUnitSheet(unit.hullSheet, 'hull');
    if (unit.turretSheet) next.turretSheet = copyUnitSheet(unit.turretSheet, 'turret');
    if (unit.shadowSheet) next.shadowSheet = copyUnitSheet(unit.shadowSheet, 'shadow');
    if (unit.overlaySheet) next.overlaySheet = copyUnitSheet(unit.overlaySheet, 'rotors');
    if (unit.bodySheet) next.bodySheet = copyUnitSheet(unit.bodySheet, 'body');
    if (unit.tailSheet) next.tailSheet = copyUnitSheet(unit.tailSheet, 'tail');
    stagedRoster.push(next);
  }
  copyChecked(
    join(OUT, 'roster/worker-mineral-carry.png'),
    join(leaf2dDest, 'units/shared/worker-mineral-carry.png'),
  );
  for (const f of readdirSync(join(OUT, 'sprites')).filter((n) => n.startsWith('micro4-') && n.endsWith('.png'))) {
    copyChecked(join(OUT, 'sprites', f), join(leaf2dDest, 'units/swarm4x4', f));
  }
  writeJson(join(leaf2dDest, 'units/roster-manifest.json'), stagedRoster);

  // Buildings & core props
  interface SpritesManifest {
    teamColors: unknown;
    buildingStates: unknown;
    buildings: Array<{ id: string; stateSheet?: string; [k: string]: unknown }>;
  }
  const rawSprites = readJson<SpritesManifest>(join(OUT, 'sprites/manifest.json'));
  for (const f of readdirSync(join(OUT, 'sprites')).filter((n) => n.startsWith('building-') && n.endsWith('.png'))) {
    copyChecked(join(OUT, 'sprites', f), join(leaf2dDest, 'buildings', f));
  }
  const stagedBuildings = {
    teamColors: rawSprites.teamColors,
    buildingStates: rawSprites.buildingStates,
    buildings: rawSprites.buildings.map((b) => ({
      ...b,
      idleSheet: `building-${b.id}.png`,
    })),
  };
  writeJson(join(leaf2dDest, 'buildings/buildings-manifest.json'), stagedBuildings);

  // Environment: biomes, terrain objects, neutral units
  interface EnvManifest {
    biomes: Array<{
      theme: string;
      label: string;
      atlas: string;
      hazardAnim: string;
      bridgeH: string;
      bridgeV: string;
      ramps: Record<string, string>;
    }>;
    objects: Array<{ id: string; sheet: string; [k: string]: unknown }>;
    neutrals: Array<{
      id: string;
      name: string;
      sheet: string;
      hullSheet?: string;
      turretSheet?: string;
      shadowSheet?: string;
      [k: string]: unknown;
    }>;
  }
  const rawEnv = readJson<EnvManifest>(join(OUT, 'environment/env-manifest.json'));
  const stagedBiomes = rawEnv.biomes.map((b) => {
    const copyTile = (file: string): string => {
      const rel = `tilesets/${file}`;
      copyChecked(join(OUT, 'environment', file), join(leaf2dDest, 'environment', rel));
      return rel;
    };
    const ramps: Record<string, string> = {};
    for (const [dir, file] of Object.entries(b.ramps)) {
      ramps[dir] = copyTile(file);
    }
    return {
      ...b,
      atlas: copyTile(b.atlas),
      hazardAnim: copyTile(b.hazardAnim),
      bridgeH: copyTile(b.bridgeH),
      bridgeV: copyTile(b.bridgeV),
      ramps,
    };
  });
  const stagedObjects = rawEnv.objects.map((o) => {
    const rel = `objects/${o.sheet}`;
    copyChecked(join(OUT, 'environment', o.sheet), join(leaf2dDest, 'environment', rel));
    return { ...o, sheet: rel };
  });
  const stagedNeutrals = rawEnv.neutrals.map((n) => {
    const slug = slugify(n.name);
    const base = `neutrals/${n.id}-${slug}`;
    const copyNeutral = (srcName: string, suffix: string): string => {
      const rel = `${base}-${suffix}.png`;
      copyChecked(join(OUT, 'environment', srcName), join(leaf2dDest, 'environment', rel));
      return rel;
    };
    const next = { ...n, sheet: copyNeutral(n.sheet, '8way') };
    if (n.hullSheet) next.hullSheet = copyNeutral(n.hullSheet, 'hull');
    if (n.turretSheet) next.turretSheet = copyNeutral(n.turretSheet, 'turret');
    if (n.shadowSheet) next.shadowSheet = copyNeutral(n.shadowSheet, 'shadow');
    return next;
  });
  writeJson(join(leaf2dDest, 'environment/env-manifest.json'), {
    biomes: stagedBiomes,
    objects: stagedObjects,
    neutrals: stagedNeutrals,
  });

  // Combat VFX strips & 84-unit attack profiles
  const rawVfx = readJson<Array<{ id: string; sheet: string; [k: string]: unknown }>>(
    join(OUT, 'vfx/vfx-manifest.json'),
  );
  for (const fx of rawVfx) {
    copyChecked(join(OUT, 'vfx', fx.sheet), join(leaf2dDest, 'vfx', fx.sheet));
  }
  copyChecked(join(OUT, 'vfx/vfx-manifest.json'), join(leaf2dDest, 'vfx/vfx-manifest.json'));
  copyChecked(join(OUT, 'vfx/unit-attacks.json'), join(leaf2dDest, 'vfx/unit-attacks.json'));

  // Unified 2D leaf manifest
  writeJson(join(leaf2dDest, 'micro-rts-manifest.json'), {
    id: 'micro-rts',
    name: 'RUN Micro-RTS',
    version: '0.1.0',
    pixelGrid: '8x8',
    factions: ['vanguard', 'kraxen', 'solaris', 'neutral'],
    counts: {
      factionUnits: stagedRoster.length,
      factionTwoLayerUnits: stagedRoster.filter((u) => u.twoLayer).length,
      buildings: rawSprites.buildings.length,
      biomes: stagedBiomes.length,
      terrainObjects: stagedObjects.length,
      neutralUnits: stagedNeutrals.length,
      neutralTwoLayerUnits: stagedNeutrals.filter((n) => n.twoLayer).length,
      vfxStrips: rawVfx.length,
      unitAttackProfiles: Object.keys(readJson<Record<string, unknown>>(join(OUT, 'vfx/unit-attacks.json'))).length,
    },
    manifests: {
      units: 'units/roster-manifest.json',
      buildings: 'buildings/buildings-manifest.json',
      environment: 'environment/env-manifest.json',
      vfx: 'vfx/vfx-manifest.json',
      unitAttacks: 'vfx/unit-attacks.json',
    },
  });

  // Samples gallery for 2D leaf (non-runtime)
  const samples2d: Array<[string, string]> = [
    ['proof-combined-arms-battle.png', 'Samples/battle-scene.png'],
    ['proof-buildings.png', 'Samples/buildings-overview.png'],
    ['environment/proof-env-biomes.png', 'Samples/environment-biomes.png'],
    ['environment/proof-env-objects.png', 'Samples/environment-objects.png'],
    ['environment/proof-env-neutrals.png', 'Samples/neutral-units.png'],
    ['vfx/proof-vfx-sprites.png', 'Samples/combat-vfx.png'],
  ];
  for (const [srcRel, dstRel] of samples2d) {
    copyChecked(join(OUT, srcRel), join(leaf2dDest, dstRel));
  }

  writeFileSync(join(leaf2dDest, 'License.txt'), licenseText('2D Units, Buildings, Terrain & Combat VFX'), 'utf8');
  writeFileSync(
    join(leaf2dDest, 'README.md'),
    `# RUN Micro-RTS — 2D Units, Buildings, Terrain & Combat VFX

Crisp \`8×8\`-grid sci-fi micro-RTS pixel art designed for nearest-neighbor rendering on the RUN platform.

## Contents

- \`units/\` — **72 faction units** (\`vanguard\`, \`kraxen\`, \`solaris\` × 24) in 8-way × 12-frame sheets (\`N, NE, E, SE, S, SW, W, NW\` rows; \`idle 2\`, \`move 4\`, \`attack 4\`, \`death 2\` columns), including **12 two-layer hull + independent-turret split units**, shared mineral-carry overlay, \`swarm4x4/\` ultra-micro sprites, and \`units/roster-manifest.json\` (with exact \`muzzleCell8\` weapon origins).
- \`buildings/\` — **21 grounded faction buildings** across 7 lifecycle states (\`build_1\`, \`build_2\`, \`idle\`, \`active_0\`, \`active_1\`, \`damaged\`, \`rubble\`) plus mineral/terrain props and \`buildings/buildings-manifest.json\`.
- \`environment/\` — **4 planet biome \`8×8\` Wang-16 tilesets** (\`temperate\`, \`tundra\`, \`volcanic\`, \`desert\`) with Layer-1 alpha cliffs, 3-frame animated hazards, 4-way ramps, H/V bridges, **31 terrain objects**, **12 neutral 8-way units** (critters + guardians including 2 two-layer turrets), and \`environment/env-manifest.json\`.
- \`vfx/\` — **19 combat VFX strips** (projectiles, missiles, flames, explosions, shields, slashes), \`vfx/vfx-manifest.json\`, and complete 84-unit attack profiles in \`vfx/unit-attacks.json\`.
- \`micro-rts-manifest.json\` — Top-level index of every sub-manifest and asset count.

## Rendering Notes

- Use **nearest-neighbor / point texture filtering** (\`image-rendering: pixelated\`).
- Matching selection rings, tactical cursors, world pings, and HUD icons live in the sibling \`run-micro-rts/ui\` pack.
`,
    'utf8',
  );

  // -------------------------------------------------------------------------
  // 2. Stage Leaf 2: run-micro-rts/ui/
  // -------------------------------------------------------------------------
  interface UiManifest {
    selectionRings: Array<{ id: string; cellW: number; cellH: number; states: string[]; sheet: string }>;
    sprites: Array<{ id: string; name: string; category: string; cellW: number; cellH: number; frames: number; sheet: string }>;
  }
  const rawUi = readJson<UiManifest>(join(OUT, 'ui/ui-manifest.json'));
  const stagedRings = rawUi.selectionRings.map((r) => {
    const rel = `selection-rings/${r.sheet}`;
    copyChecked(join(OUT, 'ui', r.sheet), join(leafUiDest, rel));
    return { ...r, sheet: rel };
  });
  const catDir: Record<string, string> = {
    cursor: 'cursors',
    marker: 'markers',
    icon: 'icons',
  };
  const stagedUiSprites = rawUi.sprites.map((s) => {
    const folder = catDir[s.category] ?? 'misc';
    const rel = `${folder}/${s.sheet}`;
    copyChecked(join(OUT, 'ui', s.sheet), join(leafUiDest, rel));
    return { ...s, sheet: rel };
  });
  writeJson(join(leafUiDest, 'ui-manifest.json'), {
    selectionRings: stagedRings,
    sprites: stagedUiSprites,
  });

  const uiPreviewPng = buildUiPreviewPng();
  mkdirSync(join(leafUiDest, 'Samples'), { recursive: true });
  writeFileSync(join(leafUiDest, 'Samples/ui-chrome-showcase.png'), uiPreviewPng);
  copyChecked(join(OUT, 'ui/proof-ui-chrome.png'), join(leafUiDest, 'Samples/ui-chrome-overview.png'));

  writeFileSync(join(leafUiDest, 'License.txt'), licenseText('RTS UI & HUD Chrome'), 'utf8');
  writeFileSync(
    join(leafUiDest, 'README.md'),
    `# RUN Micro-RTS — RTS UI & HUD Chrome

Native pixel-art RTS UI chrome designed to pair with \`run-micro-rts/2D/space-scifi\` at exact \`8×8\` grid scale.

## Contents

- \`selection-rings/\` — 4 footprint tiers (\`sel-sm\`, \`sel-md\`, \`sel-lg\`, \`sel-bldg\`), each a 4-column strip for \`selected\`, \`hover\`, \`enemy\`, and \`ally\` states in 3/4 RTS ellipse perspective.
- \`cursors/\` — 8 tactical cursors (pointer, attack, move, gather, repair, patrol, ability AOE, invalid) in 1–2 frame strips.
- \`markers/\` — 5 in-world order and placement markers (move ping, attack ping, animated rally flag, valid/blocked \`8×8\` build grid tiles).
- \`icons/\` — 12 HUD resource and command card icons (minerals, rich gold, plasma gas, supply, move, stop, hold, attack, patrol, build, repair, rally).
- \`ui-manifest.json\` — Cell dimensions, frame counts, and relative file paths for every UI strip.
`,
    'utf8',
  );

  // -------------------------------------------------------------------------
  // 3. Generate preview inputs, preview.webp derivatives & update preview-sources.json
  // -------------------------------------------------------------------------
  const previewInputsDir = join(target, 'scripts/preview-inputs');
  mkdirSync(previewInputsDir, { recursive: true });

  const preview2dPng = await build2dPreviewPng(sharp);
  const src2dRel = `scripts/preview-inputs/${LEAF_2D.replaceAll('/', '--')}.png`;
  const srcUiRel = `scripts/preview-inputs/${LEAF_UI.replaceAll('/', '--')}.png`;
  writeFileSync(join(target, src2dRel), preview2dPng);
  writeFileSync(join(target, srcUiRel), uiPreviewPng);

  const sha2d = sha256(preview2dPng);
  const shaUi = sha256(uiPreviewPng);

  const deriv2d = await renderLeafWebp(sharp, preview2dPng, sha2d, join(leaf2dDest, 'preview.webp'));
  const derivUi = await renderLeafWebp(sharp, uiPreviewPng, shaUi, join(leafUiDest, 'preview.webp'));

  const selections = readJson<{
    schemaVersion: number;
    packs: Record<string, Record<string, unknown>>;
  }>(selectionsFile);

  selections.packs[LEAF_2D] = {
    kind: 'derived',
    licenseEvidence: `${LEAF_2D}/License.txt`,
    sourceUrl: SOURCE_URL,
    sourcePath: src2dRel,
    sourceSha256: sha2d,
    description:
      'Square pixel-art preview of RUN Micro-RTS combining a combined-arms battle scene, grounded faction buildings, and 4 planet biome tilesets.',
    gallery: samples2d.map(([, dstRel]) => dstRel),
    ...deriv2d,
  };

  selections.packs[LEAF_UI] = {
    kind: 'derived',
    licenseEvidence: `${LEAF_UI}/License.txt`,
    sourceUrl: SOURCE_URL,
    sourcePath: srcUiRel,
    sourceSha256: shaUi,
    description:
      'Square pixel-art preview of RUN Micro-RTS UI chrome showing 4x4 perspective selection rings, 8 tactical cursors, 5 world order markers, and 12 HUD icons.',
    gallery: ['Samples/ui-chrome-showcase.png', 'Samples/ui-chrome-overview.png'],
    ...derivUi,
  };

  writeJson(selectionsFile, selections);

  console.log(`Staged ${LEAF_2D} -> ${leaf2dDest} (preview.webp: ${deriv2d.width}x${deriv2d.height}, ${deriv2d.bytes} B)`);
  console.log(`Staged ${LEAF_UI} -> ${leafUiDest} (preview.webp: ${derivUi.width}x${derivUi.height}, ${derivUi.bytes} B)`);
  console.log('Next in target checkout:');
  console.log('  npm run previews:check && SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs && node scripts/check-visual-assets.mjs && npm test');
}

await main();
