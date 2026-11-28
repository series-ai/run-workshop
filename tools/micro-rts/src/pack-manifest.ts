import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'output');

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(join(OUT, relPath), 'utf8')) as T;
}

const roster = readJson<Array<{ id: string; faction: string; twoLayer?: boolean }>>('roster/roster-manifest.json');
const env = readJson<{
  biomes: Array<{ theme: string }>;
  objects: Array<{ id: string }>;
  neutrals: Array<{ id: string; twoLayer?: boolean }>;
}>('environment/env-manifest.json');
const vfx = readJson<Array<{ id: string }>>('vfx/vfx-manifest.json');
const unitAttacks = readJson<Record<string, unknown>>('vfx/unit-attacks.json');
const ui = readJson<{
  selectionRings: Array<{ id: string; states: string[] }>;
  sprites: Array<{ id: string; category: string }>;
}>('ui/ui-manifest.json');
const sprites = readJson<{
  buildings?: unknown[];
  units?: unknown[];
}>('sprites/manifest.json');

const packManifest = {
  id: 'micro-rts',
  name: 'RUN Micro-RTS',
  version: '0.1.0',
  pixelGrid: '8x8',
  factions: ['vanguard', 'kraxen', 'solaris', 'neutral'],
  counts: {
    factionUnits: roster.length,
    factionTwoLayerUnits: roster.filter((u) => u.twoLayer).length,
    buildings: sprites.buildings?.length ?? 21,
    biomes: env.biomes.length,
    terrainObjects: env.objects.length,
    neutralUnits: env.neutrals.length,
    neutralTwoLayerUnits: env.neutrals.filter((u) => u.twoLayer).length,
    vfxStrips: vfx.length,
    unitAttackProfiles: Object.keys(unitAttacks).length,
    uiSelectionRingTiers: ui.selectionRings.length,
    uiSelectionRingVariants: ui.selectionRings.reduce((sum, r) => sum + r.states.length, 0),
    uiSprites: ui.sprites.length,
  },
  manifests: {
    coreSprites: 'sprites/manifest.json',
    roster: 'roster/roster-manifest.json',
    environment: 'environment/env-manifest.json',
    vfx: 'vfx/vfx-manifest.json',
    unitAttacks: 'vfx/unit-attacks.json',
    ui: 'ui/ui-manifest.json',
  },
};

const dest = join(OUT, 'micro-rts-manifest.json');
writeFileSync(dest, `${JSON.stringify(packManifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${dest}`);
console.log(JSON.stringify(packManifest.counts, null, 2));
