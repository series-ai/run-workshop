/**
 * @file assetLibrary.ts
 * Pinned 3D GLTF asset mappings from run-inkline.
 */

export const ASSET_PATHS = {
  // Characters (Animated Stick Figures)
  playerStickman: '/run-inkline/3D/characters/stick-agent.glb',
  squadmateStickman: '/run-inkline/3D/characters/stick-runner.glb',
  rivalStickman: '/run-inkline/3D/characters/stick-striker.glb',
  fighterStickman: '/run-inkline/3D/characters/stick-fighter.glb',
  heavyStickman: '/run-inkline/3D/characters/stick-heavy.glb',

  // Machine Defenses (PvE Robots)
  turretAutomated: '/run-inkline/3D/space-scifi/turret-automated.glb',
  droneScout: '/run-inkline/3D/space-scifi/drone-scout.glb',

  // Sector 7 Industrial Depot Environment
  cargoContainer: '/run-inkline/3D/city/cargo-container.glb',
  cargoContainerOpen: '/run-inkline/3D/city/cargo-container-open.glb',
  floodlightTower: '/run-inkline/3D/city/floodlight-tower.glb',
} as const;

export type AssetKey = keyof typeof ASSET_PATHS;

export function getAssetUrl(key: AssetKey): string {
  return ASSET_PATHS[key];
}
