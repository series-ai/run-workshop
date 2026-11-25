import type { PaletteColors } from '@chisel/contracts/palette'
import type { ContextPackKey } from '@chisel/contracts/packs'

export interface PropPlacement {
  id: string
  position: readonly [number, number, number]
  rotationY?: number
  scale?: readonly [number, 1, number]
  clip?: string
  timeOffset?: number
}

export interface AvatarPlacement {
  presetId?: string
  position: readonly [number, number, number]
  rotationY: number
  palette?: Partial<PaletteColors>
  unarmed?: true
  heldLeft?: string
  clip?: string
  timeOffset?: number
  holdPhase?: number
  insideProp?: PropPlacement
}

export interface ContextSceneLayout {
  width: number
  depth: number
  avatars: readonly AvatarPlacement[]
  props: readonly PropPlacement[]
}

export const SCENE_WIDTH = 14.0
export const SCENE_DEPTH = 14.0
export const SCENE_HALF_WIDTH = SCENE_WIDTH / 2
export const SCENE_HALF_DEPTH = SCENE_DEPTH / 2
export const DIORAMA_SPACING = 15.6

const FLOOR_TILE_ID_RE =
  /(?:floor_tile|grass_tile|path_tile|road_tile|road_straight|road_corner|road_tsplit|road_junction|road_crosswalk|water_tile|pool_tile|shore_tile|sludge_tile|sidewalk_tile|sidewalk_corner|grate_tile|ground_tile|duckboard|dais_tile|mine_track|channel_pavement)/

/** True for modular 2m ground, road, sidewalk, water, lava, or dais slabs so they render without drop shadows underneath props. */
export function isFloorTileId(id: string): boolean {
  return FLOOR_TILE_ID_RE.test(id)
}

// The road crosses the checkpoint at an angle to the cut face.
const convoyAngle = 0.85
const convoyTruck: PropPlacement = {
  id: 'prop_supply_truck',
  position: [-1.6, 0.125, -1.4],
  rotationY: convoyAngle,
}

function truckCabPosition(x: number, y: number, z: number): AvatarPlacement['position'] {
  const [truckX, truckY, truckZ] = convoyTruck.position
  const sin = Math.sin(convoyAngle)
  const cos = Math.cos(convoyAngle)
  return [truckX + x * cos + z * sin, truckY + y, truckZ - x * sin + z * cos]
}

function convoyRoad(distance: number): PropPlacement {
  return {
    id: 'prop_dirt_road_straight',
    position: [Math.sin(convoyAngle) * distance, 0, Math.cos(convoyAngle) * distance],
    rotationY: convoyAngle,
    scale: [1.6, 1, 1],
  }
}

export const SCENE_LAYOUTS: Readonly<Record<ContextPackKey, ContextSceneLayout>> = {
  medieval: {
    width: SCENE_WIDTH,
    depth: SCENE_DEPTH,
    avatars: [
      { presetId: 'medieval_knight', position: [-2.64, 0, -1.69], rotationY: 0.68, clip: 'Idle_Shield_Loop', palette: { primary: '#a14c3e', accent: '#cca76e', metal: '#8c999d' } },
      { presetId: 'medieval_squire', position: [0.66, 0, 2.32], rotationY: -2.45, clip: 'Idle_Torch_Loop', palette: { primary: '#54777a', secondary: '#4f443c', accent: '#d1ad73' } },
    ],
    props: [
      ...[-6, -4, -2, 0, 2, 4, 6].map((x): PropPlacement => ({ id: 'prop_moat_water_tile', position: [x, 0, 0] })),
      ...[-4, -2, 2, 4, 6].map((z): PropPlacement => ({ id: 'prop_cobble_road_tile', position: [-1, 0, z] })),
      { id: 'prop_wooden_bridge', position: [-1, 0, 0], rotationY: Math.PI / 2 },
      { id: 'prop_wooden_wagon', position: [-3.03, 0, 2.83], rotationY: Math.PI + 0.19 },
      { id: 'prop_portcullis_gate', position: [-1, 0.125, -3.45], clip: 'Open' },
      { id: 'prop_castle_keep_tower', position: [-3.35, 0, -3.34] },
      { id: 'prop_castle_keep_tower', position: [1.35, 0, -3.34] },
      { id: 'prop_dungeon_window_wall', position: [3.58, 0, -3.45] },
      { id: 'prop_dungeon_wall', position: [5.73, 0, -3.45] },
      { id: 'prop_castle_herald', position: [3.01, 0, -2.29] },
      { id: 'prop_rowboat', position: [3.75, 0.058, 0], rotationY: Math.PI / 2 },
      { id: 'prop_tree_oak', position: [-5.65, 0, 1.95] },
      { id: 'prop_boulder_cluster', position: [3.85, 0, 1.94], rotationY: -0.3 },
      { id: 'prop_tavern_inn', position: [4.1, 0, -5.62] },
      { id: 'prop_thatched_cottage', position: [-5.38, 0, -5.75] },
      { id: 'prop_market_cloth_booth', position: [5.63, 0, 3.55], rotationY: -0.4 },
      { id: 'prop_market_bread_table', position: [5.75, 0, 4.75], rotationY: -0.27 },
      { id: 'prop_pine_tree', position: [-6.15, 0, -1.78] },
      { id: 'prop_pine_tree', position: [5.92, 0, -1.78] },
      { id: 'prop_market_apple_bin', position: [3.93, 0, 4.68], rotationY: -0.22 },
      { id: 'prop_brazier_fire', position: [0.56, 0, -1.42], clip: 'Idle' },
      { id: 'prop_quay_crane', position: [-3.98, 0, -1.63] },
      { id: 'prop_cooper_casks', position: [-4.9, 0, 4.04], rotationY: 0.18 },
    ],
  },
  ww2: {
    width: SCENE_WIDTH,
    depth: SCENE_DEPTH,
    avatars: [
      { presetId: 'ww2_officer', position: truckCabPosition(-1.58, 0, 0.98), rotationY: convoyAngle + Math.PI / 2, clip: 'Interact', holdPhase: 0.45, unarmed: true, heldLeft: 'held_ww2_dispatch', palette: { primary: '#a0a698', secondary: '#60574b', accent: '#b79b69' } },
      { presetId: 'ww2_sapper', position: truckCabPosition(-0.45, 0.745, 1.06), rotationY: convoyAngle - 0.52, clip: 'Sitting_Talking_Loop', holdPhase: 0.50, unarmed: true, insideProp: convoyTruck, palette: { skin: '#b48261', primary: '#a5a780' } },
    ],
    props: [
      ...[-6, -4, -2, 0, 2, 4, 6].map(convoyRoad),
      convoyTruck,
      { id: 'prop_barrier_arm', position: [0.81, 0.125, 0.71], rotationY: convoyAngle, clip: 'Down' },
      { id: 'prop_guardhouse_booth', position: [3.4, 0, -0.15], rotationY: -0.72 },
      { id: 'prop_watchtower', position: [6.05, 0, -2.64], rotationY: -0.12 },
      { id: 'prop_sandbag_wall', position: [0.83, 0, -2.18], rotationY: -0.72 },
      { id: 'prop_sandbag_wall', position: [5.55, 0, 0.65], rotationY: -0.72 },
      { id: 'prop_field_radio', position: [-3.05, 0, 0.5], rotationY: 0.9 },
      { id: 'prop_crate_pallet', position: [-4.35, 0, 0.95], rotationY: 0.35 },
      { id: 'prop_crate_pallet', position: [-4.05, 0, 2.55], rotationY: 0.22 },
      { id: 'prop_oil_drum_stack', position: [-5.55, 0, 2.0] },
      { id: 'prop_village_station', position: [1.85, 0, -4.52], rotationY: -0.3 },
      { id: 'prop_field_tent', position: [-5.35, 0, -0.78], rotationY: convoyAngle },
      { id: 'prop_comms_tower', position: [5.98, 0, -5.68] },
      { id: 'prop_bunker_lantern_post', position: [3.38, 0.125, 1.26] },
      { id: 'prop_checkpoint_board', position: [4.55, 0, 1.38], rotationY: -0.34 },
      { id: 'prop_postal_sacks', position: [-1.93, 0, 3.36], rotationY: -0.12 },
    ],
  },
  sim: {
    width: SCENE_WIDTH,
    depth: SCENE_DEPTH,
    avatars: [
      { presetId: 'sim_student', position: [-0.32, 0.075, 2.04], rotationY: 2.66, clip: 'Walk_Loop', holdPhase: 0.22, palette: { primary: '#d06858', secondary: '#495777', accent: '#90b5a4' } },
      { presetId: 'sim_executive', position: [0.93, 0.158, -0.58], rotationY: -0.47, clip: 'Idle_Talking_Loop', holdPhase: 0.38, unarmed: true, palette: { primary: '#877062', secondary: '#bbc9cb', accent: '#be7e5f' } },
    ],
    props: [
      ...[-6, -4, -2, 0, 2, 4, 6].flatMap((x): PropPlacement[] => [
        { id: x === 0 ? 'prop_road_crosswalk' : 'prop_road_straight', position: [x, 0, 2.55], scale: [1, 1, 1.55] },
        { id: 'prop_sidewalk_tile', position: [x, 0, 0] },
        { id: 'prop_sidewalk_tile', position: [x, 0, 5.1], rotationY: Math.PI },
      ]),
      { id: 'prop_city_bus', position: [-3.75, 0.075, 2.18], rotationY: Math.PI / 2 },
      { id: 'prop_bus_stop', position: [-3.85, 0.158, -0.15] },
      { id: 'prop_market_bakery', position: [-4.85, 0, -3.69] },
      { id: 'prop_corner_bistro', position: [0.13, 0, -3.02], rotationY: -0.53 },
      { id: 'prop_traffic_light', position: [-1.30, 0.158, 0.65] },
      { id: 'prop_park_tree', position: [3.03, 0, -1.66] },
      { id: 'prop_parasol_table', position: [2.48, 0.158, -0.02] },
      { id: 'prop_cafe_table', position: [5.05, 0.158, -0.05] },
      { id: 'prop_cafe_chair', position: [4.32, 0.158, -0.05], rotationY: Math.PI / 2 },
      { id: 'prop_cafe_chair', position: [5.78, 0.158, -0.05], rotationY: -Math.PI / 2 },
      { id: 'prop_row_flat', position: [4.45, 0, -4.28], rotationY: -0.17 },
      { id: 'prop_flower_stall', position: [-5.93, 0.158, 0.38] },
      { id: 'prop_bistro_menu', position: [-0.86, 0.158, -0.67], rotationY: 0.1 },
      { id: 'prop_planter', position: [-1.75, 0.158, -0.54] },
      { id: 'prop_streetlamp', position: [6.51, 0.158, 0.7] },
      { id: 'prop_streetlamp', position: [-2.93, 0.158, 0.85], rotationY: Math.PI / 2 },
    ],
  },
  cyberpunk: {
    width: SCENE_WIDTH,
    depth: SCENE_DEPTH,
    avatars: [
      {
        presetId: 'cyber_netrunner', position: [4.83, 0, -0.30], rotationY: -1.60,
        clip: 'Spell_Simple_Enter', holdPhase: 0.58, unarmed: true,
        palette: { skin: '#d0a78b', hair: '#eebc83', primary: '#e5a24e', secondary: '#71412f', accent: '#ffe0a1' },
      },
      {
        presetId: 'cyber_edgerunner', position: [2.45, 0, 0.58], rotationY: 1.72,
        clip: 'Interact', holdPhase: 0.28, unarmed: true,
        palette: { hair: '#482f42', primary: '#6a879d', secondary: '#71838d', accent: '#a5e2de' },
      },
    ],
    props: [
      ...[-5, -3, -1, 1, 3, 5].map((z): PropPlacement => ({
        id: 'prop_channel_pavement', position: [-1, 0, z], rotationY: Math.PI,
      })),
      ...[-3, -1, 1, 3, 5].map((z): PropPlacement => ({
        id: 'prop_channel_pavement', position: [1, 0, z],
      })),
      { id: 'prop_cyber_apartment', position: [-3.62, 0, -1.63], rotationY: Math.PI / 2 },
      { id: 'prop_cyber_apartment', position: [-3.62, 0, -4.72], rotationY: Math.PI / 2 },
      { id: 'prop_cyber_apartment', position: [5.18, 0, -3.59], rotationY: -Math.PI / 2 },
      { id: 'prop_lantern_span', position: [0, 0.128, -3.5] },
      { id: 'prop_steam_basket_counter', position: [2.75, 0, -2.45], rotationY: -Math.PI / 2 },
      { id: 'prop_lantern_noodle_bar', position: [3.66, 0, 0.28], rotationY: -1.40 },
      { id: 'prop_capsule_locker', position: [-3.22, 0, 0.57], rotationY: Math.PI / 2 },
      { id: 'prop_herb_trough', position: [-2.77, 0, 2.08], rotationY: Math.PI / 2 },
      { id: 'prop_transit_reader', position: [-1.72, 0.128, 5.68], rotationY: 0.35 },
      { id: 'prop_transit_reader', position: [1.72, 0.128, 5.68], rotationY: -0.35 },
      { id: 'prop_tech_workshop', position: [2.22, 0, -5.55], rotationY: -0.08 },
      { id: 'prop_menu_easel', position: [3.87, 0, 2.73], rotationY: -0.78 },
      { id: 'prop_market_stool', position: [2.29, 0, 2.44] },
      { id: 'prop_market_stool', position: [3.02, 0, 2.55] },
      { id: 'prop_delivery_handcart', position: [-3.03, 0, 3.33], rotationY: 0.32 },
      { id: 'prop_arcade_cabinet', position: [-1.53, 0.128, -2.71], rotationY: 0.58 },
    ],
  },
  monsters: {
    width: 12,
    depth: SCENE_DEPTH,
    avatars: [
      { presetId: 'monster_giant_spider', position: [-0.25, 0, 1.92], rotationY: 1.48, clip: 'Threat', holdPhase: 0.23, palette: { skin: '#777388', primary: '#60657a', secondary: '#a39db2', accent: '#ae6871', metal: '#a7b5c3' } },
      { presetId: 'monster_orc_warlord', position: [1.7, 0, 2.01], rotationY: -1.63, clip: 'Sword_Idle', palette: { skin: '#b9c5a0', primary: '#b09f8a', secondary: '#777674', accent: '#ceb79a', metal: '#a4b3b7' } },
    ],
    props: [
      { id: 'prop_mine_tunnel_mouth', position: [-1.32, 0, -2.74] },
      { id: 'prop_basalt_cliff_block', position: [-0.05, 0, -5.65] },
      { id: 'prop_quarry_rock_shelf', position: [-4.48, 0, -5.1] },
      { id: 'prop_quarry_stone_needle', position: [-4.3, 0, -3.35] },
      { id: 'prop_basalt_cliff_block', position: [2.18, 0, -3.87] },
      { id: 'prop_quarry_rock_shelf', position: [4.57, 0, -4.7], rotationY: 0.15 },
      { id: 'prop_brood_nest', position: [-3.68, 0, -0.65] },
      { id: 'prop_egg_hatch', position: [-2.86, 0, 0.72], clip: 'Pulse' },
      { id: 'prop_mine_ore_skip', position: [-4.1, 0, 1.48], rotationY: 0.6 },
      { id: 'prop_mine_track', position: [-1.32, 0, -0.52] },
      { id: 'prop_bone_pile', position: [-3.16, 0, 2.95], rotationY: 0.6 },
      { id: 'prop_skull_brazier', position: [0.7, 0, -1.16] },
      { id: 'prop_mine_lamp_post', position: [-5.09, 0, -1.63] },
      { id: 'prop_fossil_rib_arc', position: [3.9, 0, -2.1], rotationY: -0.31 },
      { id: 'prop_mushroom_cluster', position: [-4.75, 0, 3.2], rotationY: 0.54 },
      { id: 'prop_bone_pile', position: [3.42, 0, 3.14], rotationY: 0.12 },
    ],
  },
}


export const SCENE_BACKDROPS: Readonly<Record<ContextPackKey, readonly PropPlacement[]>> = {
  medieval: [
    ...[-6, -8, -10, -12, -14].map((z): PropPlacement => ({ id: 'prop_cobble_road_tile', position: [-1, 0, z] })),
    { id: 'prop_thatched_cottage', position: [-3.0, 0, -9.1], rotationY: 0.92 },
    { id: 'prop_blacksmith_hut', position: [0.14, 0, -8.76], rotationY: -0.38 },
    { id: 'prop_pine_tree', position: [-1.62, 0, -17.2], rotationY: 0.2 },
    { id: 'prop_pine_tree', position: [0.23, 0, -19.62], rotationY: -0.4 },
    { id: 'prop_thatched_cottage', position: [-6.9, 0, -8.8], rotationY: 0.31 },
    { id: 'prop_windmill', position: [7.1, 0, -10.2], rotationY: -0.25, clip: 'Idle' },
    { id: 'prop_pine_tree', position: [-8.6, 0, -9.8], rotationY: 0.8 },
    { id: 'prop_pine_tree', position: [-7.4, 0, -10.7], rotationY: -0.6 },
    { id: 'prop_pine_tree', position: [-5.3, 0, -9.4], rotationY: -0.28 },
    { id: 'prop_pine_tree', position: [5.3, 0, -9.0], rotationY: 0.79 },
    { id: 'prop_pine_tree', position: [8.4, 0, -9.9], rotationY: 0.38 },
  ],
  ww2: [
    ...[-8, -10, -12, -14].map(convoyRoad),
    { id: 'prop_orchard_farmhouse', position: [-8.45, 0, -3.22], rotationY: 0.24 },
    ...[-5.85, -8.85, -11.85].map((d): PropPlacement => ({
      id: 'prop_rural_wall',
      position: [Math.sin(convoyAngle) * d + 1.28, 0, Math.cos(convoyAngle) * d - 1.46],
      rotationY: convoyAngle - Math.PI / 2,
    })),
    { id: 'prop_cart_barn', position: [-3.0, 0, -12], rotationY: 0.42 },
    { id: 'prop_telegraph_pole', position: [-2.6, 0, -7.9] },
    { id: 'prop_telegraph_pole', position: [-4.4, 0, -11.3] },
    { id: 'prop_telegraph_pole', position: [-6.25, 0, -14.5] },
    { id: 'prop_rural_wall', position: [6.35, 0, -8.2] },
    { id: 'prop_signal_cabin', position: [8.6, 0, -11.6], rotationY: -0.28 },
  ],
  sim: [
    ...[-2, -4, -6, -8].map((z): PropPlacement => ({ id: 'prop_sidewalk_tile', position: [-2.22, 0, z] })),
    { id: 'prop_arcade_cinema', position: [-8.65, 0, -8.45], rotationY: 0.46 },
    { id: 'prop_row_flat', position: [4.65, 0, -9.6] },
    { id: 'prop_row_flat', position: [-0.54, 0, -10.15], rotationY: 0.23 },
    { id: 'prop_apartment_block', position: [-3.69, 0, -12.8], rotationY: -0.25 },
    { id: 'prop_apartment_block', position: [8.15, 0, -9.8], rotationY: -0.25 },
    { id: 'prop_park_tree', position: [-6.25, 0, -7.4] },
    { id: 'prop_park_tree', position: [7, 0, -7.8], rotationY: 0.64 },
  ],
  cyberpunk: [
    { id: 'prop_channel_pavement', position: [-1, 0, -7], rotationY: Math.PI },
    { id: 'prop_channel_pavement', position: [-1, 0, -9], rotationY: Math.PI },
    { id: 'prop_channel_pavement', position: [1, 0, -9] },
    { id: 'prop_channel_pavement', position: [-1, 0, -11], rotationY: Math.PI },
    { id: 'prop_channel_pavement', position: [-1, 0, -13], rotationY: Math.PI },
    { id: 'prop_channel_pavement', position: [-1, 0, -15], rotationY: Math.PI },
    { id: 'prop_channel_pavement', position: [-1, 0, -17], rotationY: Math.PI },
    { id: 'prop_cyber_apartment', position: [-6.7, 0, -9.5], rotationY: 0.18 },
    { id: 'prop_cyber_apartment', position: [5.9, 0, -9.1], rotationY: -0.36 },
    { id: 'prop_cyber_apartment', position: [2.4, 0, -10.5], rotationY: 0.37 },
    { id: 'prop_overhead_pipe_bridge', position: [-0.30, 0.128, -9.10] },
    { id: 'prop_vault_bunker_hub', position: [8.75, 0, -12], rotationY: 0.15 },
    { id: 'prop_cyber_apartment', position: [6.66, 0, -0.42], rotationY: -2.30 },
    { id: 'prop_tech_workshop', position: [8.03, 0, -4.30], rotationY: -Math.PI / 2 },
    { id: 'prop_arc_lamp', position: [3.9, 0, -7.9], rotationY: 0.18 },
  ],
  monsters: [
    { id: 'prop_basalt_cliff_block', position: [-5.45, 0, -5.9], rotationY: 0.19 },
    { id: 'prop_basalt_cliff_block', position: [-3.65, 0, -4.83], rotationY: 0.1 },
    { id: 'prop_basalt_cliff_block', position: [0.94, 0, -4.27], rotationY: -0.29 },
    { id: 'prop_basalt_cliff_block', position: [3.76, 0, -5.07], rotationY: 0.33 },
    { id: 'prop_basalt_cliff_block', position: [5.46, 0, -5.68], rotationY: 0.19 },
    { id: 'prop_basalt_cliff_block', position: [-5.02, 1.06, -6.55], rotationY: -0.09 },
    { id: 'prop_basalt_cliff_block', position: [-3.2, 1.02, -5.37], rotationY: -0.12 },
    { id: 'prop_basalt_cliff_block', position: [-1.56, 1.9, -4.37], rotationY: 0.1 },
    { id: 'prop_basalt_cliff_block', position: [0.12, 1.44, -5.10], rotationY: 0.16 },
    { id: 'prop_basalt_cliff_block', position: [1.88, 1.03, -5.30], rotationY: 0.36 },
    { id: 'prop_quarry_rock_shelf', position: [3.92, 1.08, -5.76], rotationY: -0.21 },
  ],
}
