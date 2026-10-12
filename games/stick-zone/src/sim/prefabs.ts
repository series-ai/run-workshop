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
  cableSpool: {
    assetKey: "cableSpool",
    collision: { halfWidth: 0.55, halfDepth: 0.55, height: 1.2 },
    defaultScale: 1.7,
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
  barrelToxic: {
    assetKey: "barrel",
    collision: { halfWidth: 0.4, halfDepth: 0.4, height: 1.0 },
    defaultScale: 1.4,
  },
  barrelStack: {
    assetKey: "barrelStack",
    collision: { halfWidth: 0.9, halfDepth: 0.9, height: 1.6 },
    defaultScale: 1.6,
  },
  crateStack: {
    assetKey: "crateStack",
    collision: { halfWidth: 1.0, halfDepth: 1.0, height: 1.5 },
    defaultScale: 1.5,
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
    collision: undefined,
    defaultScale: 1.9,
  },
  serviceBayCanopy: {
    assetKey: "serviceBayCanopy",
    collision: undefined,
    defaultScale: 2.0,
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
  streetLamp: {
    assetKey: "streetLamp",
    collision: { halfWidth: 0.25, halfDepth: 0.25, height: 4.5 },
    defaultScale: 1.8,
  },
  treeOak: {
    collision: { halfWidth: 0.35, halfDepth: 0.35, height: 3.5 },
    defaultScale: 1.0,
  },
  treePine: {
    collision: { halfWidth: 0.3, halfDepth: 0.3, height: 4.5 },
    defaultScale: 1.0,
  },
  foliageBush: {
    collision: undefined,
    defaultScale: 1.0,
  },
  warehouseWall4m: {
    collision: { halfWidth: 2.0, halfDepth: 0.25, height: 3.2 },
    defaultScale: 1.0,
  },
  warehouseWall2m: {
    collision: { halfWidth: 1.0, halfDepth: 0.25, height: 3.2 },
    defaultScale: 1.0,
  },
  bridgeRail: {
    collision: { halfWidth: 3.5, halfDepth: 0.2, height: 1.2 },
    defaultScale: 1.0,
  },
  bridgeDeck: {
    collision: undefined,
    defaultScale: 1.0,
  },
  cargoContainer: {
    assetKey: "cargoContainer",
    collision: { halfWidth: 3.0, halfDepth: 1.25, height: 2.6 },
    defaultScale: 1.0,
  },
  // Heavy Industrial Architecture
  warehouse: {
    assetKey: "warehouse",
    collision: { halfWidth: 3.4, halfDepth: 3.4, height: 5.0 },
    defaultScale: 1.75,
  },
  warehouseBay: {
    assetKey: "warehouseBay",
    collision: { halfWidth: 3.4, halfDepth: 3.4, height: 4.5 },
    defaultScale: 1.75,
  },
  tankVertical: {
    assetKey: "tankVertical",
    collision: { halfWidth: 1.8, halfDepth: 1.8, height: 4.5 },
    defaultScale: 2.2,
  },
  tankHorizontal: {
    assetKey: "tankHorizontal",
    collision: { halfWidth: 2.5, halfDepth: 1.5, height: 3.0 },
    defaultScale: 2.0,
  },
  tankSpherical: {
    assetKey: "tankSpherical",
    collision: { halfWidth: 1.8, halfDepth: 1.8, height: 4.0 },
    defaultScale: 2.2,
  },
  watertankIndustrial: {
    assetKey: "watertankIndustrial",
    collision: { halfWidth: 1.6, halfDepth: 1.6, height: 4.5 },
    defaultScale: 1.8,
  },
  pipeManifold: {
    assetKey: "pipeManifold",
    collision: { halfWidth: 1.4, halfDepth: 0.9, height: 1.8 },
    defaultScale: 2.0,
  },
  pipeStraight: {
    assetKey: "pipeStraight",
    collision: { halfWidth: 1.2, halfDepth: 0.4, height: 0.8 },
    defaultScale: 1.5,
  },
  valveWheel: {
    assetKey: "valveWheel",
    collision: { halfWidth: 0.3, halfDepth: 0.3, height: 1.2 },
    defaultScale: 1.6,
  },
  catwalkBridge: {
    assetKey: "catwalkBridge",
    collision: { halfWidth: 1.4, halfDepth: 1.4, height: 4.0 },
    defaultScale: 2.0,
  },
  stairFlight: {
    assetKey: "stairFlight",
    collision: { halfWidth: 1.2, halfDepth: 1.8, height: 2.5 },
    defaultScale: 1.6,
  },
  loadingPlatform: {
    assetKey: "loadingPlatform",
    collision: { halfWidth: 3.2, halfDepth: 2.6, height: 1.2 },
    defaultScale: 2.0,
  },
  loadingPlatformRamp: {
    assetKey: "loadingPlatformRamp",
    collision: { halfWidth: 2.0, halfDepth: 2.0, height: 0.8 },
    defaultScale: 2.0,
  },
  loadingDockLadder: {
    assetKey: "loadingDockLadder",
    collision: { halfWidth: 0.35, halfDepth: 0.25, height: 2.5 },
    defaultScale: 1.8,
  },
  machineHydraulicPress: {
    assetKey: "serviceBayWorkbench",
    collision: { halfWidth: 1.2, halfDepth: 1.0, height: 2.2 },
    defaultScale: 1.8,
  },
  debrisScrapPile: {
    assetKey: "crateStack",
    collision: { halfWidth: 1.4, halfDepth: 1.2, height: 1.0 },
    defaultScale: 1.8,
  },
  scrapIBeam: {
    assetKey: "barrierConcrete",
    collision: { halfWidth: 1.4, halfDepth: 0.6, height: 0.8 },
    defaultScale: 1.7,
  },
  planterConcrete: {
    assetKey: "barrierConcrete",
    collision: { halfWidth: 0.8, halfDepth: 0.8, height: 0.8 },
    defaultScale: 1.5,
  },
  smokestackTall: {
    assetKey: "smokestackTall",
    collision: { halfWidth: 1.8, halfDepth: 1.8, height: 12.0 },
    defaultScale: 2.2,
  },
  smokestackTwin: {
    assetKey: "smokestack",
    collision: { halfWidth: 1.8, halfDepth: 1.2, height: 10.0 },
    defaultScale: 2.0,
  },
  conveyor: {
    assetKey: "conveyor",
    collision: { halfWidth: 1.8, halfDepth: 0.7, height: 1.2 },
    defaultScale: 2.2,
  },
  conveyorIncline: {
    assetKey: "conveyorIncline",
    collision: { halfWidth: 1.8, halfDepth: 0.7, height: 1.6 },
    defaultScale: 2.2,
  },
  fenceWireMesh: {
    assetKey: "fenceWireMesh",
    collision: { halfWidth: 2.2, halfDepth: 0.15, height: 2.2 },
    defaultScale: 2.2,
  },
  fenceBarbed: {
    assetKey: "fencePanel",
    collision: { halfWidth: 2.2, halfDepth: 0.2, height: 2.2 },
    defaultScale: 1.8,
  },
  fenceGate: {
    assetKey: "fenceGate",
    collision: { halfWidth: 1.8, halfDepth: 0.15, height: 2.2 },
    defaultScale: 2.2,
  },
  busStopShelter: {
    assetKey: "warehouseBay",
    collision: { halfWidth: 1.8, halfDepth: 0.9, height: 2.2 },
    defaultScale: 1.5,
  },
  canalPipeCulvert: {
    collision: { halfWidth: 0.5, halfDepth: 0.8, height: 1.2 },
    defaultScale: 1.0,
  },
};

/**
 * Computes an axis-aligned bounding box (ObstacleBox) for a given PrefabInstance,
 * respecting position, rotation around Y, and local collision box dimensions.
 */
export function computePrefabObstacleBox(inst: PrefabInstance): ObstacleBox | null {
  if (inst.solid === false) return null;
  const def = PREFAB_CATALOG[inst.prefabKey];
  if (!def || !def.collision) return null;

  const col = def.collision;
  let sx = 1;
  let sz = 1;
  if (Array.isArray(inst.scale)) {
    sx = inst.scale[0];
    sz = inst.scale[2];
  } else if (typeof inst.scale === "number") {
    sx = inst.scale;
    sz = inst.scale;
  } else if (def.defaultScale) {
    sx = def.defaultScale;
    sz = def.defaultScale;
  }

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

/**
 * Authoritative Sector 7 Spoke tactical level design prefabs:
 * - Industrial Runoff Sluice Canal Crossings & Culverts
 * - Logistics Command Warehouse (exterior walls, interior room partitions, armory vault)
 * - Pumping Station Bunker (blast walls, baffle entrance, turbine bay)
 * - Container Yard Maze (tight alleys, dead ends, blind corners)
 * - Procedural Industrial Park Trees & Foliage Beds
 * - Spoke Industrial Architecture (Refinery tanks, docks, transformers, smokestacks)
 */
export const SPOKE_PREFABS: PrefabInstance[] = [
  // =========================================================================
  // 1. INDUSTRIAL CANAL BRIDGES & SLUICE DISCHARGE CULVERTS (z in [16.5, 21.5])
  // =========================================================================
  // Central Freight Highway Bridge (x in [-4.5, 4.5], z = 19)
  { id: "bridge_center_deck", prefabKey: "bridgeDeck", position: [0, 0.05, 19], scale: [9.0, 1, 6.0] },
  { id: "bridge_center_rail_w", prefabKey: "bridgeRail", position: [-4.6, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_center_rail_e", prefabKey: "bridgeRail", position: [4.6, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_center_bollard_nw", prefabKey: "bollardHeavy", position: [-4.2, 0, 16.0], scale: 1.4 },
  { id: "bridge_center_bollard_ne", prefabKey: "bollardHeavy", position: [4.2, 0, 16.0], scale: 1.4 },
  { id: "bridge_center_bollard_sw", prefabKey: "bollardHeavy", position: [-4.2, 0, 22.0], scale: 1.4 },
  { id: "bridge_center_bollard_se", prefabKey: "bollardHeavy", position: [4.2, 0, 22.0], scale: 1.4 },

  // West Heavy Catwalk & Truss Span (x in [-44, -38], z = 19)
  { id: "bridge_west_deck", prefabKey: "bridgeDeck", position: [-41, 0.05, 19], scale: [6.0, 1, 6.0] },
  { id: "bridge_west_rail_w", prefabKey: "bridgeRail", position: [-44.2, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_west_rail_e", prefabKey: "bridgeRail", position: [-37.8, 0, 19], rotation: [0, Math.PI / 2, 0] },

  // East Rail & Utility Pipe Span (x in [36, 42], z = 19)
  { id: "bridge_east_deck", prefabKey: "bridgeDeck", position: [39, 0.05, 19], scale: [6.0, 1, 6.0] },
  { id: "bridge_east_rail_w", prefabKey: "bridgeRail", position: [35.8, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_east_rail_e", prefabKey: "bridgeRail", position: [42.2, 0, 19], rotation: [0, Math.PI / 2, 0] },

  // Industrial Stormwater / Effluent Discharge Pipes
  { id: "pipe_culvert_n1", prefabKey: "canalPipeCulvert", position: [-30, 0.25, 16.5] },
  { id: "pipe_culvert_n2", prefabKey: "canalPipeCulvert", position: [15, 0.25, 16.5] },
  { id: "pipe_culvert_n3", prefabKey: "canalPipeCulvert", position: [50, 0.25, 16.5] },
  { id: "pipe_culvert_s1", prefabKey: "canalPipeCulvert", position: [-20, 0.25, 21.5] },
  { id: "pipe_culvert_s2", prefabKey: "canalPipeCulvert", position: [25, 0.25, 21.5] },

  // =========================================================================
  // 2. LOGISTICS COMMAND WAREHOUSE (x in [16, 25], z in [-13, 0])
  // =========================================================================
  // Exterior North Wall (z = -13, width 9m)
  { id: "wh_wall_n1", prefabKey: "warehouseWall4m", position: [18, 0, -13] },
  { id: "wh_wall_n2", prefabKey: "warehouseWall4m", position: [22.5, 0, -13] },

  // Exterior South Wall (z = 0, width 9m, front entrance at x in [20, 21])
  { id: "wh_wall_s1", prefabKey: "warehouseWall4m", position: [18, 0, 0] },
  { id: "wh_wall_s2", prefabKey: "warehouseWall4m", position: [23, 0, 0] },

  // Exterior West Wall (x = 16, z in [-13, 0], side doorway at z in [-7.5, -5.5])
  { id: "wh_wall_w1", prefabKey: "warehouseWall4m", position: [16, 0, -10.5], rotation: [0, Math.PI / 2, 0] },
  { id: "wh_wall_w2", prefabKey: "warehouseWall4m", position: [16, 0, -2.5], rotation: [0, Math.PI / 2, 0] },

  // Exterior East Wall (x = 25, z in [-13, 0])
  { id: "wh_wall_e1", prefabKey: "warehouseWall4m", position: [25, 0, -10.5], rotation: [0, Math.PI / 2, 0] },
  { id: "wh_wall_e2", prefabKey: "warehouseWall4m", position: [25, 0, -6.5], rotation: [0, Math.PI / 2, 0] },
  { id: "wh_wall_e3", prefabKey: "warehouseWall4m", position: [25, 0, -2.5], rotation: [0, Math.PI / 2, 0] },

  // Interior Room Partition 1 (z = -6.5, doorway at x in [20, 21])
  { id: "wh_part_s1", prefabKey: "warehouseWall4m", position: [18, 0, -6.5] },
  { id: "wh_part_s2", prefabKey: "warehouseWall4m", position: [23, 0, -6.5] },

  // Interior Room Partition 2 (x = 20.5, z in [-13, -6.5], vault door at z in [-7.5, -6.5])
  { id: "wh_part_v1", prefabKey: "warehouseWall4m", position: [20.5, 0, -10.5], rotation: [0, Math.PI / 2, 0] },

  // Armory Vault Props (Room 3)
  { id: "wh_prop_vault_crate1", prefabKey: "crateMilitary", position: [24.0, 0, -11.5] },
  { id: "wh_prop_vault_crate2", prefabKey: "crateHeavyWooden", position: [21.5, 0, -12.0] },

  // Server Core Props (Room 2)
  { id: "wh_prop_server_cab", prefabKey: "electricalCabinet", position: [16.8, 0, -10.5], rotation: [0, Math.PI / 2, 0] },
  { id: "wh_prop_server_xfmr", prefabKey: "machineTransformer", position: [18.5, 0, -11.5] },
  { id: "wh_prop_server_core", prefabKey: "powerCore", position: [17.5, 0, -8.5] },

  // Front Logistics Office Props (Room 1)
  { id: "wh_prop_bench", prefabKey: "serviceBayWorkbench", position: [17.5, 0, -4.5] },
  { id: "wh_prop_barrier", prefabKey: "barrierConcrete", position: [21.0, 0, -2.5] },

  // =========================================================================
  // 3. PUMPING STATION BUNKER (x in [-30, -18], z in [40, 52])
  // =========================================================================
  // Exterior North Wall (z = 40, blast door opening at x in [-25, -23])
  { id: "ps_wall_n1", prefabKey: "warehouseWall4m", position: [-27.5, 0, 40] },
  { id: "ps_wall_n2", prefabKey: "warehouseWall4m", position: [-20.5, 0, 40] },

  // Exterior South Wall (z = 52)
  { id: "ps_wall_s1", prefabKey: "warehouseWall4m", position: [-27.5, 0, 52] },
  { id: "ps_wall_s2", prefabKey: "warehouseWall4m", position: [-20.5, 0, 52] },

  // Exterior West Wall (x = -30)
  { id: "ps_wall_w1", prefabKey: "warehouseWall4m", position: [-30, 0, 43], rotation: [0, Math.PI / 2, 0] },
  { id: "ps_wall_w2", prefabKey: "warehouseWall4m", position: [-30, 0, 49], rotation: [0, Math.PI / 2, 0] },

  // Exterior East Wall (x = -18)
  { id: "ps_wall_e1", prefabKey: "warehouseWall4m", position: [-18, 0, 43], rotation: [0, Math.PI / 2, 0] },
  { id: "ps_wall_e2", prefabKey: "warehouseWall4m", position: [-18, 0, 49], rotation: [0, Math.PI / 2, 0] },

  // Interior Baffle Blast Wall & Heavy Machinery
  { id: "ps_baffle_wall", prefabKey: "warehouseWall4m", position: [-24, 0, 43.5] },
  { id: "ps_generator", prefabKey: "generatorLarge", position: [-27.5, 0, 47.5] },
  { id: "ps_spool", prefabKey: "cableSpoolMetal", position: [-20.5, 0, 47.5] },

  // =========================================================================
  // 4. CONTAINER YARD MAZE (x in [-24, -6], z in [-38, -16])
  // =========================================================================
  { id: "maze_container_1", prefabKey: "cargoContainer", position: [-15, 0, -35], rotation: [0, 0, 0] },
  { id: "maze_container_2", prefabKey: "cargoContainer", position: [-15, 0, -21], rotation: [0, 0, 0] },
  { id: "maze_container_3", prefabKey: "cargoContainer", position: [-8.5, 0, -35], rotation: [0, Math.PI / 2, 0] },
  { id: "maze_barrier_1", prefabKey: "barrierConcrete", position: [-11.5, 0, -31], rotation: [0, 0, 0] },
  { id: "maze_barrier_2", prefabKey: "barrierConcrete", position: [-18.5, 0, -25.5], rotation: [0, Math.PI / 2, 0] },
  { id: "maze_crate_1", prefabKey: "crateHeavyWooden", position: [-14, 0, -28] },
  { id: "maze_dumpster_1", prefabKey: "dumpster", position: [-8.5, 0, -18] },

  // =========================================================================
  // 5. INDUSTRIAL PARK TREES & FOLIAGE BEDS
  // =========================================================================
  // North Embankment Buffer Trees (z in [13, 14.5])
  { id: "tree_nb_1", prefabKey: "treeOak", position: [-28, 0, 13] },
  { id: "tree_nb_2", prefabKey: "treePine", position: [-20, 0, 14] },
  { id: "tree_nb_3", prefabKey: "treeOak", position: [-11, 0, 13.5] },
  { id: "tree_nb_4", prefabKey: "treeOak", position: [11, 0, 13.5] },
  { id: "tree_nb_5", prefabKey: "treePine", position: [22, 0, 14] },
  { id: "tree_nb_6", prefabKey: "treeOak", position: [30, 0, 13] },

  // South Embankment Buffer Trees (z in [23.5, 25])
  { id: "tree_sb_1", prefabKey: "treePine", position: [-25, 0, 24] },
  { id: "tree_sb_2", prefabKey: "treeOak", position: [-14, 0, 24.5] },
  { id: "tree_sb_3", prefabKey: "treeOak", position: [14, 0, 24.5] },
  { id: "tree_sb_4", prefabKey: "treePine", position: [25, 0, 24] },

  // Embankment Tactical Scrub Bushes (Soft Cover)
  { id: "bush_rb_1", prefabKey: "foliageBush", position: [-22, 0, 17.5] },
  { id: "bush_rb_2", prefabKey: "foliageBush", position: [-16, 0, 20.5] },
  { id: "bush_rb_3", prefabKey: "foliageBush", position: [18, 0, 18.0] },
  { id: "bush_rb_4", prefabKey: "foliageBush", position: [28, 0, 20.5] },
  { id: "bush_rb_5", prefabKey: "foliageBush", position: [-8, 0, 14.5] },
  { id: "bush_rb_6", prefabKey: "foliageBush", position: [8, 0, 14.5] },

  // Northeast Park Copse (x in [20, 28], z in [-32, -24])
  { id: "tree_ne_1", prefabKey: "treeOak", position: [20, 0, -24] },
  { id: "tree_ne_2", prefabKey: "treePine", position: [26, 0, -26] },
  { id: "tree_ne_3", prefabKey: "treeOak", position: [22, 0, -30] },
  { id: "tree_ne_4", prefabKey: "treePine", position: [28, 0, -32] },
  { id: "bush_ne_1", prefabKey: "foliageBush", position: [24, 0, -25] },
  { id: "bush_ne_2", prefabKey: "foliageBush", position: [21, 0, -28] },

  // Southwest Boundary Trees (x in [-52, -46], z in [12, 22])
  { id: "tree_sw_1", prefabKey: "treePine", position: [-50, 0, 12] },
  { id: "tree_sw_2", prefabKey: "treeOak", position: [-46, 0, 16] },
  { id: "tree_sw_3", prefabKey: "treePine", position: [-52, 0, 22] },
  { id: "bush_sw_1", prefabKey: "foliageBush", position: [-48, 0, 14] },
  { id: "bush_sw_2", prefabKey: "foliageBush", position: [-47, 0, 20] },

  // =========================================================================
  // 6. ZONE 2: NORTHWEST CHEMICAL & FUEL REFINERY (x in [-60, -20], z in [-45, -5])
  // =========================================================================
  { id: "refinery_warehouse", prefabKey: "warehouse", position: [-28, 0, -26], scale: [1.75, 1.8, 1.75] },
  { id: "refinery_tank_vert", prefabKey: "tankVertical", position: [-46, 0, -20], scale: 2.2 },
  { id: "refinery_tank_horiz", prefabKey: "tankHorizontal", position: [-46, 0, -35], scale: 2.0 },
  { id: "refinery_tank_sphere", prefabKey: "tankSpherical", position: [-35, 0, -38], scale: 2.2 },
  { id: "refinery_watertank", prefabKey: "watertankIndustrial", position: [-22, 0, -40], scale: 1.8 },
  { id: "refinery_pipe_manifold", prefabKey: "pipeManifold", position: [-40, 0, -28], scale: 2.0 },
  { id: "refinery_catwalk", prefabKey: "catwalkBridge", position: [-28, 4.0, -14], scale: [2.0, 1.8, 2.5] },
  { id: "refinery_stairs", prefabKey: "stairFlight", position: [-22, 0, -14], rotation: [0, Math.PI / 2, 0], scale: 1.6 },
  { id: "refinery_barrel_toxic1", prefabKey: "barrelToxic", position: [-42, 0, -16], scale: 1.4 },
  { id: "refinery_barrel_toxic2", prefabKey: "barrelToxic", position: [-40.5, 0, -17], scale: 1.4 },
  { id: "refinery_barrel_stack", prefabKey: "barrelStack", position: [-33, 0, -10.5], scale: 1.6 },
  { id: "refinery_crate_wood", prefabKey: "crateHeavyWooden", position: [-36, 0, -18], scale: 1.4 },

  // =========================================================================
  // 7. ZONE 3: SOUTHWEST FREIGHT DOCKS & MAINTENANCE (x in [-55, -15], z in [5, 45])
  // =========================================================================
  { id: "dock_warehouse_bay", prefabKey: "warehouseBay", position: [-28, 0, 24], scale: [1.75, 1.8, 1.75] },
  { id: "dock_loading_plat", prefabKey: "loadingPlatform", position: [-38, 0, 28], scale: [2.0, 1.8, 2.0] },
  { id: "dock_loading_ramp", prefabKey: "loadingPlatformRamp", position: [-38, 0, 32.5], rotation: [0, Math.PI, 0], scale: [2.0, 1.8, 2.0] },
  { id: "dock_ladder", prefabKey: "loadingDockLadder", position: [-33.8, 0, 28], rotation: [0, -Math.PI / 2, 0], scale: 1.8 },
  { id: "dock_press", prefabKey: "machineHydraulicPress", position: [-33, 0, -2], scale: 1.8 },
  { id: "dock_spool", prefabKey: "cableSpoolMetal", position: [-34, 0, 4], scale: 1.7 },
  { id: "dock_dumpster1", prefabKey: "dumpster", position: [-42, 0, 10], rotation: [0, Math.PI / 2, 0], scale: 1.3 },
  { id: "dock_dumpster2", prefabKey: "dumpster", position: [-48, 0, 30], rotation: [0, Math.PI / 2, 0], scale: 1.3 },
  { id: "dock_scrap", prefabKey: "debrisScrapPile", position: [-20, 0, 34], scale: 1.8 },
  { id: "dock_ibeam", prefabKey: "scrapIBeam", position: [-22, 0, 36], scale: 1.7 },
  { id: "dock_planter1", prefabKey: "planterConcrete", position: [-18, 0, 16], scale: 1.5 },
  { id: "dock_planter2", prefabKey: "planterConcrete", position: [-18, 0, 24], scale: 1.5 },
  { id: "dock_bollard1", prefabKey: "bollardHeavy", position: [-16, 0, 18], scale: 1.6 },
  { id: "dock_bollard2", prefabKey: "bollardHeavy", position: [-16, 0, 22], scale: 1.6 },

  // =========================================================================
  // 8. ZONE 4: NORTHEAST POWER SUBSTATION & HEAVY INDUSTRY (x in [20, 65], z in [-45, 10])
  // =========================================================================
  { id: "substation_xfmr", prefabKey: "machineTransformer", position: [38, 0, -18], scale: 2.0 },
  { id: "substation_gen", prefabKey: "generatorLarge", position: [46, 0, -18], scale: 2.0 },
  { id: "substation_cab", prefabKey: "electricalCabinet", position: [42, 0, -10], scale: 1.8 },
  { id: "substation_spool_m", prefabKey: "cableSpoolMetal", position: [34, 0, -10], scale: 1.7 },
  { id: "substation_spool_w", prefabKey: "cableSpool", position: [30, 0, -14], scale: 1.7 },
  { id: "substation_stack_tall", prefabKey: "smokestackTall", position: [56, 0, -32], scale: [2.2, 2.5, 2.2] },
  { id: "substation_stack_twin", prefabKey: "smokestackTwin", position: [56, 0, -16], scale: [2.0, 2.2, 2.0] },
  { id: "substation_conveyor", prefabKey: "conveyor", position: [32, 0, -5], rotation: [0, Math.PI / 2, 0], scale: [2.2, 1.8, 2.0] },
  { id: "substation_conveyor_inc", prefabKey: "conveyorIncline", position: [32, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [2.2, 1.8, 2.0] },
  { id: "substation_fence_n", prefabKey: "fenceWireMesh", position: [48, 0, -10], rotation: [0, Math.PI / 2, 0], scale: [2.2, 1.8, 2.0] },
  { id: "substation_fence_s", prefabKey: "fenceWireMesh", position: [48, 0, 10], rotation: [0, Math.PI / 2, 0], scale: [2.2, 1.8, 2.0] },
  { id: "substation_gate", prefabKey: "fenceGate", position: [28, 0, -6], scale: 2.2 },

  // =========================================================================
  // 9. ZONE 5: SOUTHEAST EXTRACTION REDOUBT & MILITARY LZ-01 (x in [20, 60], z in [20, 60])
  // =========================================================================
  { id: "lz_bus_shelter", prefabKey: "busStopShelter", position: [30, 0, 26], rotation: [0, Math.PI / 2, 0], scale: 1.5 },
  { id: "lz_cam_pole", prefabKey: "securityCameraPole", position: [28, 0, 32], scale: 1.8 },
  { id: "lz_barrier_1", prefabKey: "barrierConcrete", position: [34, 0, 36], scale: 1.35 },
  { id: "lz_barrier_2", prefabKey: "barrierConcrete", position: [34, 0, 48], scale: 1.35 },
  { id: "lz_barrier_3", prefabKey: "barrierConcrete", position: [50, 0, 36], scale: 1.35 },
  { id: "lz_barrier_4", prefabKey: "barrierConcrete", position: [50, 0, 48], scale: 1.35 },
  { id: "lz_fence_w", prefabKey: "fenceBarbed", position: [28, 0, 42], rotation: [0, Math.PI / 2, 0], scale: 1.8 },
  { id: "lz_fence_e", prefabKey: "fenceBarbed", position: [54, 0, 42], rotation: [0, Math.PI / 2, 0], scale: 1.8 },
  { id: "lz_water_barrier", prefabKey: "barrierWater", position: [38, 0, 28], scale: 1.4 },
];

/**
 * Automatically generated ObstacleBoxes for all Sector 7 Spoke tactical prefabs.
 */
export const SPOKE_PREFAB_OBSTACLES: ObstacleBox[] = SPOKE_PREFABS
  .map(computePrefabObstacleBox)
  .filter((box): box is ObstacleBox => box !== null);
