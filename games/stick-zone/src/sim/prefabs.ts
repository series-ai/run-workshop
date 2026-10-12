import type { AssetKey } from "../assetLibrary.js";
import type { ObstacleBox } from "./game.js";

export interface LocalCollisionBox {
  halfWidth: number;
  halfDepth: number;
  height?: number;
  offsetX?: number;
  offsetZ?: number;
}

export interface PrefabDefinition {
  assetKey?: AssetKey;
  collision?: LocalCollisionBox;
  defaultScale?: number;
}

export interface PrefabInstance {
  id: string;
  prefabKey: string;
  assetKey?: AssetKey;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  solid?: boolean;
}

/**
 * Canonical registry of environment prop prefabs with physical collision footprints.
 * When placed anywhere in the map, collision bounds are automatically calculated.
 */
export const PREFAB_CATALOG: Record<string, PrefabDefinition> = {
  barrierConcrete: {
    assetKey: "barrierConcrete",
    collision: { halfWidth: 1.1, halfDepth: 0.35, height: 1.2 },
    defaultScale: 1.4,
  },
  barrierWater: {
    assetKey: "barrierWater",
    collision: { halfWidth: 1.0, halfDepth: 0.35, height: 1.0 },
    defaultScale: 1.4,
  },
  bollardHeavy: {
    assetKey: "bollardHeavy",
    collision: { halfWidth: 0.25, halfDepth: 0.25, height: 1.1 },
    defaultScale: 1.5,
  },
  trafficCone: {
    assetKey: "trafficCone",
    collision: { halfWidth: 0.22, halfDepth: 0.22, height: 0.8 },
    defaultScale: 1.5,
  },
  terminalConsole: {
    assetKey: "terminalConsole",
    collision: { halfWidth: 0.5, halfDepth: 0.4, height: 1.4 },
    defaultScale: 1.3,
  },
  powerCore: {
    assetKey: "powerCore",
    collision: { halfWidth: 0.55, halfDepth: 0.55, height: 2.0 },
    defaultScale: 1.5,
  },
  generatorLarge: {
    assetKey: "generatorLarge",
    collision: { halfWidth: 1.25, halfDepth: 0.8, height: 1.8 },
    defaultScale: 1.25,
  },
  machineTransformer: {
    assetKey: "machineTransformer",
    collision: { halfWidth: 0.7, halfDepth: 0.7, height: 2.2 },
    defaultScale: 1.4,
  },
  electricalCabinet: {
    assetKey: "electricalCabinet",
    collision: { halfWidth: 0.45, halfDepth: 0.35, height: 2.0 },
    defaultScale: 1.4,
  },
  serviceBayWorkbench: {
    assetKey: "serviceBayWorkbench",
    collision: { halfWidth: 1.1, halfDepth: 0.45, height: 1.5 },
    defaultScale: 1.3,
  },
  crateMilitary: {
    assetKey: "crateMilitary",
    collision: { halfWidth: 0.55, halfDepth: 0.55, height: 1.0 },
    defaultScale: 1.3,
  },
  crateHeavyWooden: {
    assetKey: "crateHeavyWooden",
    collision: { halfWidth: 0.6, halfDepth: 0.6, height: 1.1 },
    defaultScale: 1.3,
  },
  cableSpoolMetal: {
    assetKey: "cableSpoolMetal",
    collision: { halfWidth: 0.55, halfDepth: 0.55, height: 1.2 },
    defaultScale: 1.2,
  },
  dumpster: {
    assetKey: "dumpster",
    collision: { halfWidth: 1.0, halfDepth: 0.65, height: 1.3 },
    defaultScale: 1.25,
  },
  barrel: {
    assetKey: "barrel",
    collision: { halfWidth: 0.38, halfDepth: 0.38, height: 1.0 },
    defaultScale: 1.2,
  },
  warpBeacon: {
    assetKey: "warpBeacon",
    collision: { halfWidth: 0.45, halfDepth: 0.45, height: 2.5 },
    defaultScale: 1.8,
  },
  bulletTrapBackstop: {
    collision: { halfWidth: 1.6, halfDepth: 0.2, height: 2.6 },
    defaultScale: 1.0,
  },
  shootingRestBench: {
    collision: { halfWidth: 0.9, halfDepth: 0.35, height: 0.9 },
    defaultScale: 1.0,
  },
  palletMetal: {
    assetKey: "palletMetal",
    // Ground pallets allow stepping onto them without blocking walk navigation
    collision: undefined,
    defaultScale: 1.4,
  },
  grateDrain: {
    assetKey: "grateDrain",
    collision: undefined,
    defaultScale: 1.5,
  },
  serviceBayArch: {
    assetKey: "serviceBayArch",
    // Overhead arches are clear overhead structures
    collision: undefined,
    defaultScale: 1.9,
  },
  ventFan: {
    assetKey: "ventFan",
    collision: undefined,
    defaultScale: 1.4,
  },
  securityCameraPole: {
    assetKey: "securityCameraPole",
    collision: { halfWidth: 0.25, halfDepth: 0.25, height: 3.5 },
    defaultScale: 1.6,
  },
};

/**
 * Computes an axis-aligned 2D bounding box (ObstacleBox) for any placed prefab instance,
 * accounting for 3D position, rotation around Y, local offsets, and scale.
 */
export function computePrefabObstacleBox(inst: PrefabInstance): ObstacleBox | null {
  if (inst.solid === false) return null;
  const def = PREFAB_CATALOG[inst.prefabKey];
  if (!def || !def.collision) return null;

  const col = def.collision;
  const scale = inst.scale ?? def.defaultScale ?? 1.0;
  const sx = typeof scale === "number" ? scale : scale[0];
  const sz = typeof scale === "number" ? scale : scale[2];

  const hw = col.halfWidth * sx;
  const hd = col.halfDepth * sz;
  const ox = (col.offsetX ?? 0) * sx;
  const oz = (col.offsetZ ?? 0) * sz;

  const ry = inst.rotation ? inst.rotation[1] : 0;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);

  // Rotated center
  const cx = inst.position[0] + (ox * cos + oz * sin);
  const cz = inst.position[2] + (-ox * sin + oz * cos);

  // Rotated bounding box half-extents
  const extX = Math.abs(hw * cos) + Math.abs(hd * sin);
  const extZ = Math.abs(hw * sin) + Math.abs(hd * cos);

  return {
    minX: Number((cx - extX).toFixed(2)),
    maxX: Number((cx + extX).toFixed(2)),
    minZ: Number((cz - extZ).toFixed(2)),
    maxZ: Number((cz + extZ).toFixed(2)),
  };
}

/**
 * Authoritative Forward Operating Base (FOB Hub) placed prefab instances.
 * Both the 3D renderer in SectorMap.tsx and the physics simulation in game.ts
 * consume these instances directly so collision geometry is always 100% synchronized.
 */
export const FOB_PREFABS: PrefabInstance[] = [
  // West Armory Workshop (z in [-72, -67])
  {
    id: "fob_workbench",
    prefabKey: "serviceBayWorkbench",
    position: [-5.6, 0, -69.8],
    scale: 1.3,
  },
  {
    id: "fob_cabinet",
    prefabKey: "electricalCabinet",
    position: [-7.5, 0, -71.8],
    rotation: [0, Math.PI / 2, 0],
    scale: 1.4,
  },
  {
    id: "fob_armory_crates",
    prefabKey: "crateMilitary",
    position: [-3.8, 0, -71.2],
    scale: 1.3,
  },

  // East Tactical Operations Outpost (z in [-72, -67])
  {
    id: "fob_console_left",
    prefabKey: "terminalConsole",
    position: [4.2, 0, -69.5],
    rotation: [0, -Math.PI / 3, 0],
    scale: 1.3,
  },
  {
    id: "fob_console_right",
    prefabKey: "terminalConsole",
    position: [6.0, 0, -69.5],
    rotation: [0, (-2 * Math.PI) / 3, 0],
    scale: 1.3,
  },
  {
    id: "fob_power_core",
    prefabKey: "powerCore",
    position: [5.4, 0, -71.6],
    scale: 1.5,
  },
  {
    id: "fob_transformer",
    prefabKey: "machineTransformer",
    position: [7.2, 0, -71.2],
    scale: 1.4,
  },
  {
    id: "fob_security_camera",
    prefabKey: "securityCameraPole",
    position: [7.4, 0, -66.5],
    scale: 1.6,
  },

  // West Ballistic Range (Lane 01, z in [-66, -58])
  {
    id: "fob_bullet_trap",
    prefabKey: "bulletTrapBackstop",
    position: [-5.0, 0, -65.6],
    scale: 1.0,
  },
  {
    id: "fob_barrier_trap",
    prefabKey: "barrierConcrete",
    position: [-6.6, 0, -64.2],
    scale: 1.35,
  },
  {
    id: "fob_lane_barrier_left",
    prefabKey: "barrierConcrete",
    position: [-3.3, 0, -61.2],
    rotation: [0, Math.PI / 2, 0],
    scale: 1.35,
  },
  {
    id: "fob_shooting_bench",
    prefabKey: "shootingRestBench",
    position: [-5.0, 0, -58.2],
    scale: 1.0,
  },

  // East CQB & Supply Station (Lane 02, z in [-66, -58])
  {
    id: "fob_lane_barrier_right",
    prefabKey: "barrierConcrete",
    position: [3.3, 0, -61.2],
    rotation: [0, Math.PI / 2, 0],
    scale: 1.35,
  },
  {
    id: "fob_generator",
    prefabKey: "generatorLarge",
    position: [6.5, 0, -63.0],
    rotation: [0, -Math.PI / 2, 0],
    scale: 1.25,
  },
  {
    id: "fob_cable_spool",
    prefabKey: "cableSpoolMetal",
    position: [6.8, 0, -59.5],
    scale: 1.2,
  },

  // Airlock Threshold Approach (z in [-56, -50])
  {
    id: "fob_airlock_barrier_left",
    prefabKey: "barrierConcrete",
    position: [-4.5, 0, -54.5],
    scale: 1.4,
  },
  {
    id: "fob_airlock_barrier_right",
    prefabKey: "barrierConcrete",
    position: [4.5, 0, -54.5],
    scale: 1.4,
  },
  {
    id: "fob_bollard_left",
    prefabKey: "bollardHeavy",
    position: [-2.6, 0, -53.8],
    scale: 1.5,
  },
  {
    id: "fob_bollard_right",
    prefabKey: "bollardHeavy",
    position: [2.6, 0, -53.8],
    scale: 1.5,
  },
  {
    id: "fob_warp_beacon_left",
    prefabKey: "warpBeacon",
    position: [-4.5, 0, -52.0],
    scale: 1.8,
  },
  {
    id: "fob_warp_beacon_right",
    prefabKey: "warpBeacon",
    position: [4.5, 0, -52.0],
    scale: 1.8,
  },
];

/**
 * Automatically generated ObstacleBoxes for all FOB prefabs.
 */
export const FOB_PREFAB_OBSTACLES: ObstacleBox[] = FOB_PREFABS
  .map(computePrefabObstacleBox)
  .filter((box): box is ObstacleBox => box !== null);
