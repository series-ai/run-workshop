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

/**
 * Authoritative Sector 7 Spoke tactical level design prefabs:
 * - River Bridges with heavy guardrails & tactical choke points
 * - Logistics Command Warehouse (exterior walls, interior room partitions, armory vault)
 * - Pumping Station Bunker (blast walls, baffle entrance, turbine bay)
 * - Container Yard Maze (tight alleys, dead ends, blind corners)
 * - Procedural Trees (oak, pine) with bullet-stopping solid trunks and foliage bushes
 */
export const SPOKE_PREFABS: PrefabInstance[] = [
  // =========================================================================
  // 1. RIVER BRIDGES & TACTICAL CHOKE POINTS (z in [16.5, 21.5])
  // =========================================================================
  // Central Highway Bridge (x in [-4.5, 4.5], z = 19)
  { id: "bridge_center_deck", prefabKey: "bridgeDeck", position: [0, 0.05, 19], scale: [9.0, 1, 6.0] },
  { id: "bridge_center_rail_w", prefabKey: "bridgeRail", position: [-4.6, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_center_rail_e", prefabKey: "bridgeRail", position: [4.6, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_center_bollard_nw", prefabKey: "bollardHeavy", position: [-4.2, 0, 16.0], scale: 1.4 },
  { id: "bridge_center_bollard_ne", prefabKey: "bollardHeavy", position: [4.2, 0, 16.0], scale: 1.4 },
  { id: "bridge_center_bollard_sw", prefabKey: "bollardHeavy", position: [-4.2, 0, 22.0], scale: 1.4 },
  { id: "bridge_center_bollard_se", prefabKey: "bollardHeavy", position: [4.2, 0, 22.0], scale: 1.4 },

  // West Industrial Catwalk Bridge (x in [-44, -38], z = 19)
  { id: "bridge_west_deck", prefabKey: "bridgeDeck", position: [-41, 0.05, 19], scale: [6.0, 1, 6.0] },
  { id: "bridge_west_rail_w", prefabKey: "bridgeRail", position: [-44.2, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_west_rail_e", prefabKey: "bridgeRail", position: [-37.8, 0, 19], rotation: [0, Math.PI / 2, 0] },

  // East Tactical Rail Bridge (x in [36, 42], z = 19)
  { id: "bridge_east_deck", prefabKey: "bridgeDeck", position: [39, 0.05, 19], scale: [6.0, 1, 6.0] },
  { id: "bridge_east_rail_w", prefabKey: "bridgeRail", position: [35.8, 0, 19], rotation: [0, Math.PI / 2, 0] },
  { id: "bridge_east_rail_e", prefabKey: "bridgeRail", position: [42.2, 0, 19], rotation: [0, Math.PI / 2, 0] },

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
  // 5. PROCEDURAL TREES & FOLIAGE BUSHES (Surviv.io Foliage)
  // =========================================================================
  // Riverbank Trees (North Bank, z in [13, 14.5])
  { id: "tree_nb_1", prefabKey: "treeOak", position: [-28, 0, 13] },
  { id: "tree_nb_2", prefabKey: "treePine", position: [-20, 0, 14] },
  { id: "tree_nb_3", prefabKey: "treeOak", position: [-11, 0, 13.5] },
  { id: "tree_nb_4", prefabKey: "treeOak", position: [11, 0, 13.5] },
  { id: "tree_nb_5", prefabKey: "treePine", position: [22, 0, 14] },
  { id: "tree_nb_6", prefabKey: "treeOak", position: [30, 0, 13] },

  // Riverbank Trees (South Bank, z in [23.5, 25])
  { id: "tree_sb_1", prefabKey: "treePine", position: [-25, 0, 24] },
  { id: "tree_sb_2", prefabKey: "treeOak", position: [-14, 0, 24.5] },
  { id: "tree_sb_3", prefabKey: "treeOak", position: [14, 0, 24.5] },
  { id: "tree_sb_4", prefabKey: "treePine", position: [25, 0, 24] },

  // Riverbank Bushes (Tactical Concealment)
  { id: "bush_rb_1", prefabKey: "foliageBush", position: [-22, 0, 17.5] },
  { id: "bush_rb_2", prefabKey: "foliageBush", position: [-16, 0, 20.5] },
  { id: "bush_rb_3", prefabKey: "foliageBush", position: [18, 0, 18.0] },
  { id: "bush_rb_4", prefabKey: "foliageBush", position: [28, 0, 20.5] },
  { id: "bush_rb_5", prefabKey: "foliageBush", position: [-8, 0, 14.5] },
  { id: "bush_rb_6", prefabKey: "foliageBush", position: [8, 0, 14.5] },

  // North-East Woods Cluster (x in [20, 28], z in [-32, -24])
  { id: "tree_ne_1", prefabKey: "treeOak", position: [20, 0, -24] },
  { id: "tree_ne_2", prefabKey: "treePine", position: [26, 0, -26] },
  { id: "tree_ne_3", prefabKey: "treeOak", position: [22, 0, -30] },
  { id: "tree_ne_4", prefabKey: "treePine", position: [28, 0, -32] },
  { id: "bush_ne_1", prefabKey: "foliageBush", position: [24, 0, -25] },
  { id: "bush_ne_2", prefabKey: "foliageBush", position: [21, 0, -28] },

  // South-West Nature Pocket (x in [-52, -46], z in [12, 22])
  { id: "tree_sw_1", prefabKey: "treePine", position: [-50, 0, 12] },
  { id: "tree_sw_2", prefabKey: "treeOak", position: [-46, 0, 16] },
  { id: "tree_sw_3", prefabKey: "treePine", position: [-52, 0, 22] },
  { id: "bush_sw_1", prefabKey: "foliageBush", position: [-48, 0, 14] },
  { id: "bush_sw_2", prefabKey: "foliageBush", position: [-47, 0, 20] },
];

/**
 * Automatically generated ObstacleBoxes for all Sector 7 Spoke tactical prefabs.
 */
export const SPOKE_PREFAB_OBSTACLES: ObstacleBox[] = SPOKE_PREFABS
  .map(computePrefabObstacleBox)
  .filter((box): box is ObstacleBox => box !== null);
