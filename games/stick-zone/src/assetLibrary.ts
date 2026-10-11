/**
 * @file assetLibrary.ts
 * Pinned 3D GLTF asset mappings from run-inkline via RundotGameAPI.assetLibrary.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

export { EFFECT_PRESET_IDS, type EffectPresetId } from './render/inkEffectsPresets.js';

/**
 * Pinned asset packs from run-inkline in the RUN.game Asset Library.
 */
export const INKLINE_PACKS = {
  characters: {
    id: 'run-inkline/3D/characters',
    version: '4548550a5cf6',
  },
  scifi: {
    id: 'run-inkline/3D/space-scifi',
    version: 'b3e7a8122565',
  },
  city: {
    id: 'run-inkline/3D/city',
    version: '48f4942c1ceb',
  },
  weapons: {
    id: 'run-inkline/3D/weapons',
    version: '75cd4d2eef61',
  },
} as const;

export type InklinePackKey = keyof typeof INKLINE_PACKS;

export interface AssetReference {
  pack: InklinePackKey;
  path: string;
}

const baseUrls = new Map<InklinePackKey, Promise<string>>();
let initialization: Promise<void> | undefined;

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = RundotGameAPI.initializeAsync()
      .then(() => undefined)
      .catch((error) => {
        initialization = undefined;
        throw error;
      });
  }
  return initialization;
}

export function clearAssetLibraryCacheForTests(): void {
  baseUrls.clear();
  initialization = undefined;
}

/**
 * Resolves a pack-relative reference to a fully-qualified CDN URL via RundotGameAPI.assetLibrary.
 */
export async function resolveAssetUrl(reference: AssetReference): Promise<string> {
  await ensureInitialized();
  const pack = INKLINE_PACKS[reference.pack];
  let base = baseUrls.get(reference.pack);
  if (!base) {
    base = RundotGameAPI.assetLibrary
      .getPackBaseUrl(pack.id, pack.version)
      .then((url) => {
        if (!url) throw new Error('Asset library returned an empty pack URL');
        return url.replace(/\/+$/, '');
      })
      .catch((error) => {
        baseUrls.delete(reference.pack);
        throw error;
      });
    baseUrls.set(reference.pack, base);
  }
  const path = reference.path.split('/').map(encodePathSegment).join('/');
  return `${await base}/${path}`;
}

export const ASSET_REFS = {
  // Characters (Animated Stick Figures)
  playerStickman: { pack: 'characters', path: 'stick-agent.glb' },
  squadmateStickman: { pack: 'characters', path: 'stick-runner.glb' },
  rivalStickman: { pack: 'characters', path: 'stick-striker.glb' },
  hubSentinel: { pack: 'characters', path: 'stick-heavy.glb' },
  scavRunner: { pack: 'characters', path: 'stick-runner.glb' },
  scavEnforcer: { pack: 'characters', path: 'stick-agent.glb' },
  scavBoss: { pack: 'characters', path: 'stick-heavy.glb' },

  // Machine Defenses & Spatial Airlock
  turretAutomated: { pack: 'scifi', path: 'turret-automated.glb' },
  droneScout: { pack: 'scifi', path: 'drone-scout.glb' },
  teleporterPad: { pack: 'scifi', path: 'teleporter-pad.glb' },
  warpBeacon: { pack: 'scifi', path: 'warp-beacon.glb' },
  powerCore: { pack: 'scifi', path: 'power-core.glb' },
  terminalConsole: { pack: 'scifi', path: 'terminal-console.glb' },

  // Depot Environment & Tactical Containers
  cargoContainer: { pack: 'city', path: 'cargo-container.glb' },
  floodlightTower: { pack: 'city', path: 'floodlight-tower.glb' },
  barrierConcrete: { pack: 'city', path: 'barrier-jersey-concrete.glb' },
  dumpster: { pack: 'city', path: 'dumpster.glb' },
  barrel: { pack: 'city', path: 'barrel.glb' },
  trashCan: { pack: 'city', path: 'trash-can.glb' },

  // Modular Industrial Props
  pipeStraight: { pack: 'city', path: 'pipe-straight.glb' },
  pipeCurve: { pack: 'city', path: 'pipe-elbow.glb' },
  valveWheel: { pack: 'city', path: 'pipe-valve.glb' },
  catwalkStraight: { pack: 'city', path: 'catwalk.glb' },
  watertankIndustrial: { pack: 'city', path: 'tank-silo.glb' },
  crateMilitary: { pack: 'city', path: 'crate-military.glb' },
  stackedPallets: { pack: 'city', path: 'stacked-pallets.glb' },
  generatorLarge: { pack: 'city', path: 'generator-diesel-large.glb' },

  // Weapons Arsenal
  rifle: { pack: 'weapons', path: 'rifle.glb' },
  shotgun: { pack: 'weapons', path: 'shotgun.glb' },
  pistol: { pack: 'weapons', path: 'pistol.glb' },
  sword: { pack: 'weapons', path: 'sword.glb' },
} as const satisfies Record<string, AssetReference>;

export type AssetKey = keyof typeof ASSET_REFS;

export function getAssetRef(key: AssetKey): AssetReference {
  return ASSET_REFS[key];
}
