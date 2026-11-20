import type { ContextPackKey } from '@chisel/contracts/packs'

export interface PropPlacement {
  id: string
  position: readonly [number, number, number]
  rotationY?: number
  clip?: string
  timeOffset?: number
}

export interface AvatarPlacement {
  position: readonly [number, number, number]
  rotationY: number
}

export interface ContextSceneLayout {
  padRadius: number
  avatars: readonly AvatarPlacement[]
  props: readonly PropPlacement[]
}

export const SCENE_PAD_RADIUS = 4.2
export const DIORAMA_SPACING = 9.0

export const SCENE_LAYOUTS: Readonly<Record<ContextPackKey, ContextSceneLayout>> = {
  medieval: {
    padRadius: SCENE_PAD_RADIUS,
    avatars: [
      { position: [-0.45, 0.135, 0.62], rotationY: 0.18 },
      { position: [0.62, 0.135, 0.65], rotationY: -0.24 },
      { position: [-1.18, 0, 1.72], rotationY: 0.32 },
    ],
    props: [
      // 4.0m x 2.0m modular stone plaza (y=0..0.135, x in [-2.0..2.0], z in [-0.75..1.25])
      { id: 'prop_stone_floor_tile', position: [-1.0, 0, 0.25] },
      { id: 'prop_stone_floor_tile', position: [1.0, 0, 0.25] },
      // North castle keep wall & portcullis gate
      { id: 'prop_portcullis_gate', position: [0.0, 0, -1.65], clip: 'Open' },
      { id: 'prop_dungeon_pillar', position: [-1.48, 0, -1.65] },
      { id: 'prop_dungeon_pillar', position: [1.48, 0, -1.65] },
      { id: 'prop_dungeon_wall', position: [-2.82, 0, -1.18], rotationY: 0.45 },
      { id: 'prop_dungeon_wall', position: [2.82, 0, -1.18], rotationY: -0.45 },
      { id: 'prop_war_banner', position: [0.0, 0, -2.75] },
      // Courtyard loot & lighting on stone plaza (y=0.135)
      { id: 'prop_brazier_fire', position: [-1.45, 0.135, -0.32], clip: 'Idle', timeOffset: 0.0 },
      { id: 'prop_brazier_fire', position: [1.45, 0.135, -0.32], clip: 'Idle', timeOffset: 0.8 },
      { id: 'prop_treasure_chest', position: [0.0, 0.135, -0.38], clip: 'Open' },
      { id: 'prop_barrel', position: [-1.55, 0.135, 0.72] },
      { id: 'prop_crate', position: [1.50, 0.135, 0.72], rotationY: 0.2 },
      // West blacksmith & training yard (staggered for clear sightlines)
      { id: 'prop_anvil_forge', position: [-2.95, 0, -0.15], rotationY: 0.65 },
      { id: 'prop_weapon_rack', position: [-2.95, 0, 0.85], rotationY: 0.75 },
      { id: 'prop_target_dummy', position: [-2.62, 0, 1.85], rotationY: 0.42, clip: 'Idle' },
      // East oak grove, tavern table, boulder outcrop & south bridge / spike trap
      { id: 'prop_tree_oak', position: [3.02, 0, 0.30] },
      { id: 'prop_tavern_table', position: [2.75, 0, 1.50] },
      { id: 'prop_boulder_cluster', position: [2.12, 0, 2.52] },
      { id: 'prop_wooden_bridge', position: [0.16, 0, 2.95], rotationY: 0.04 },
      { id: 'prop_floor_spike_trap', position: [-1.70, 0, 2.82], clip: 'Armed' },
    ],
  },

  ww2: {
    padRadius: SCENE_PAD_RADIUS,
    avatars: [
      { position: [-1.25, 0.123, 0.55], rotationY: 0.28 },
      { position: [0.05, 0.123, 0.42], rotationY: -0.05 },
      { position: [1.25, 0.123, 0.48], rotationY: -0.34 },
    ],
    props: [
      // Central 4.0m duckboard trench floor (y=0..0.123, x in [-2.0..2.0], z in [-0.36..0.76])
      { id: 'prop_trench_duckboard', position: [-1.0, 0, 0.20] },
      { id: 'prop_trench_duckboard', position: [1.0, 0, 0.20] },
      // North bunker, watchtower & radar post
      { id: 'prop_bunker_wall', position: [-0.15, 0, -1.75] },
      { id: 'prop_watchtower', position: [2.15, 0, -1.65], rotationY: -0.4 },
      { id: 'prop_radar_dish', position: [-2.20, 0, -1.55], rotationY: 0.45, clip: 'Idle' },
      // Trench equipment on duckboard (y=0.123)
      { id: 'prop_ammo_crate', position: [-0.62, 0.123, -0.08], rotationY: 0.1 },
      { id: 'prop_jerrycan', position: [-1.45, 0.123, -0.10], rotationY: -0.3 },
      { id: 'prop_field_radio', position: [0.65, 0.123, -0.10], rotationY: -0.25 },
      // Front sandbagged defense line & MG nest
      { id: 'prop_sandbag_wall', position: [-1.05, 0, 1.45], rotationY: 0.08 },
      { id: 'prop_mg_turret', position: [1.25, 0, 1.55], rotationY: -0.15, clip: 'Sweep' },
      // Checkpoint arm, airdrop crate & outer obstacles
      { id: 'prop_parachute_crate', position: [-2.90, 0, -0.10], rotationY: 0.45, clip: 'Open' },
      { id: 'prop_barrier_arm', position: [2.95, 0, 0.45], rotationY: -1.15, clip: 'Down' },
      { id: 'prop_barbed_wire_fence', position: [-2.05, 0, 2.35], rotationY: 0.35 },
      { id: 'prop_czech_hedgehog', position: [0.0, 0, 2.62], rotationY: 0.45 },
      { id: 'prop_landmine', position: [1.45, 0, 2.65], clip: 'Idle' },
    ],
  },

  sim: {
    padRadius: SCENE_PAD_RADIUS,
    avatars: [
      { position: [-0.95, 0.09, 2.45], rotationY: 0.25 },
      { position: [0.95, 0.09, 2.45], rotationY: -0.25 },
      { position: [0.32, 0.158, 1.08], rotationY: -0.12 },
    ],
    props: [
      // Front 4.0m crosswalk strip (y=0..0.09) + central sidewalk plaza (y=0..0.158, x in [-2..2], z in [-0.85..1.15])
      { id: 'prop_road_crosswalk', position: [-1.0, 0, 2.45] },
      { id: 'prop_road_crosswalk', position: [1.0, 0, 2.45] },
      { id: 'prop_sidewalk_tile', position: [-1.0, 0, 0.15] },
      { id: 'prop_sidewalk_tile', position: [1.0, 0, 0.15] },
      // North storefront, bus stop & playground swing
      { id: 'prop_shop_awning', position: [-2.05, 0, -1.85], rotationY: 0.25, clip: 'Idle' },
      { id: 'prop_bus_stop', position: [0.10, 0, -2.25] },
      { id: 'prop_park_swing', position: [2.20, 0, -1.65], rotationY: -0.45, clip: 'Swing' },
      // Plaza fountain & street furnishings on sidewalk (y=0.158)
      { id: 'prop_fountain_basin', position: [-0.15, 0.158, -0.05] },
      { id: 'prop_vending_machine', position: [-1.52, 0.158, -0.42], rotationY: 0.2, clip: 'Idle' },
      { id: 'prop_trash_bin', position: [0.95, 0.158, -0.62] },
      { id: 'prop_streetlamp', position: [1.76, 0.158, -0.35] },
      { id: 'prop_cafe_table', position: [-1.42, 0.158, 0.42] },
      { id: 'prop_park_bench', position: [1.24, 0.158, 0.48], rotationY: -1.52 },
      { id: 'prop_planter', position: [-0.68, 0.158, 1.02] },
      { id: 'prop_street_bollard', position: [-1.85, 0.158, 0.98] },
      { id: 'prop_traffic_light', position: [1.80, 0.158, 0.92], rotationY: -0.25, clip: 'Loop' },
      // Outer park tree, hedge, picket fence & mailbox
      { id: 'prop_park_tree', position: [-2.95, 0, -0.35] },
      { id: 'prop_hedge_row', position: [-2.68, 0, 1.62], rotationY: 1.25 },
      { id: 'prop_picket_fence', position: [2.85, 0, 0.55], rotationY: -1.35 },
      { id: 'prop_mailbox', position: [2.55, 0, 2.15], rotationY: -0.45, clip: 'Open' },
    ],
  },

  cyberpunk: {
    padRadius: SCENE_PAD_RADIUS,
    avatars: [
      { position: [-1.44, 0.113, 0.08], rotationY: 0.36 },
      { position: [-0.80, 0.113, -0.12], rotationY: 0.14 },
      { position: [0.88, 0.113, -0.05], rotationY: -0.28 },
      { position: [0.92, 0, 2.65], rotationY: -0.22 },
    ],
    props: [
      // 4.0m x 2.0m illuminated metal grate plaza (y=0..0.113, x in [-2..2], z in [-1.1..0.9])
      { id: 'prop_metal_grate_tile', position: [-1.0, 0, -0.10] },
      { id: 'prop_metal_grate_tile', position: [1.0, 0, -0.10] },
      // North vault blast door, laser gate & ramen stall
      { id: 'prop_blast_door', position: [0.0, 0, -2.15], clip: 'Closed' },
      { id: 'prop_laser_gate', position: [-2.10, 0, -1.70], rotationY: 0.48, clip: 'Active' },
      { id: 'prop_ramen_stand', position: [2.35, 0, -1.65], rotationY: -0.5 },
      // Center data core vault & terminals on grate deck (y=0.113) — framed cleanly through front archway
      { id: 'prop_data_core', position: [0.05, 0.113, -0.58], clip: 'Spin' },
      { id: 'prop_server_terminal', position: [-1.52, 0.113, -0.68], rotationY: 0.45 },
      { id: 'prop_holo_kiosk', position: [1.48, 0.113, -0.62], rotationY: -0.5 },
      { id: 'prop_security_camera', position: [-1.80, 0.113, 0.65], rotationY: 0.55, clip: 'Sweep' },
      { id: 'prop_hover_drone', position: [0.25, 0.113, 0.60], rotationY: -0.45, clip: 'Hover' },
      { id: 'prop_cyber_crate', position: [-0.85, 0.113, 0.62], rotationY: 0.2 },
      { id: 'prop_neon_bollard', position: [1.75, 0.113, 0.68] },
      // South neon archway entry, barriers & alley service
      { id: 'prop_neon_archway', position: [-0.05, 0, 1.85] },
      { id: 'prop_concrete_barrier', position: [-2.45, 0, 1.65], rotationY: 0.35 },
      { id: 'prop_alley_dumpster', position: [2.75, 0, 0.40], rotationY: -1.1 },
      { id: 'prop_vent_duct', position: [2.45, 0, 1.95], rotationY: -0.4 },
    ],
  },

  monsters: {
    padRadius: SCENE_PAD_RADIUS,
    avatars: [
      { position: [-1.02, 0, 0.42], rotationY: 0.26 },
      { position: [1.02, 0, 0.42], rotationY: -0.26 },
      { position: [1.55, 0, 1.15], rotationY: -0.40 },
      { position: [-1.88, 0, 0.90], rotationY: 0.45 },
    ],
    props: [
      // North ritual portal, broken ruins & orc totem
      { id: 'prop_ritual_portal', position: [0.0, 0, -2.25], clip: 'Idle' },
      { id: 'prop_broken_arch', position: [-2.45, 0, -1.50], rotationY: 0.62 },
      { id: 'prop_orc_totem', position: [2.10, 0, -1.85], rotationY: -0.38 },
      { id: 'prop_obsidian_pillar', position: [-1.52, 0, -2.85] },
      // Central boss crystal altar flanked by skull braziers (clear center aisle)
      { id: 'prop_boss_altar', position: [0.0, 0, -0.70], clip: 'Idle' },
      { id: 'prop_skull_brazier', position: [-1.35, 0, -0.95] },
      { id: 'prop_skull_brazier', position: [1.35, 0, -0.95] },
      // Volcanic crag, lava vent & dead tree flanks
      { id: 'prop_lava_vent', position: [-3.05, 0, -0.10], clip: 'Idle' },
      { id: 'prop_crag_boulder', position: [2.65, 0, -0.40], rotationY: -0.55 },
      { id: 'prop_dead_tree', position: [2.95, 0, 0.90], rotationY: -0.35 },
      // South hatchery, cage cart (side-left), low bone pile & bear trap (front-center) & barricade
      { id: 'prop_spider_egg_sac', position: [-3.05, 0, 1.35], rotationY: 0.45 },
      { id: 'prop_egg_hatch', position: [-2.45, 0, 2.25], clip: 'Pulse' },
      { id: 'prop_cage_cart', position: [-0.78, 0, 2.55], rotationY: 0.35 },
      { id: 'prop_bone_pile', position: [0.32, 0, 2.58], rotationY: 0.15 },
      { id: 'prop_bear_trap', position: [1.42, 0, 2.45], rotationY: -0.25, clip: 'Armed' },
      { id: 'prop_spiked_barricade', position: [2.65, 0, 2.00], rotationY: -0.55 },
    ],
  },
}
