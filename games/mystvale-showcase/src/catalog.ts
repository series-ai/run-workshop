export interface CropDef {
  id: string
  name: string
  seedItemId: string
  harvestItemId: string
  harvestAmount: number
  growDays: number
  stages: number
  regrows: boolean
  sellPrice: number
  seedPrice: number
  iconId: string
  stageSprites: string[]
  harvestSprite: string
}

export interface AvatarLayerDef {
  id: string
  label: string
  slot: 'body' | 'eyes' | 'clothes' | 'hair' | 'accessories'
  path: string
  zIndex: number
  tintable: boolean
  defaultColor?: string
}

export interface AvatarAppearance {
  selections: {
    body: string
    eyes: string
    clothes: string
    hair: string
    accessories?: string
  }
  tints: {
    skin: string
    hair: string
    eyes: string
    clothes: string
  }
}

export interface AudioTrackDef {
  id: string
  name: string
  category: 'music' | 'ambient' | 'sfx'
  subCategory?: string
  path: string
}

export interface UiElementDef {
  id: string
  name: string
  type: 'panel' | 'button' | 'dialogue' | 'slot' | 'banner'
  path: string
  slice?: { top: number; right: number; bottom: number; left: number }
}

export interface IconDef {
  id: string
  name: string
  category: 'tool' | 'crop' | 'resource' | 'food' | 'fish' | 'weapon' | 'misc'
  path: string
}

export interface AutotileTerrainDef {
  id: string
  name: string
  sheetPath: string
  tileSize: number
  previewTileIndex: number
}

export const PACK_METRICS = {
  packId: 'series-ai/mystvale',
  version: '04811e1dd830',
  totalFiles: 927,
  totalBytes: 67283823,
  license: 'MIT',
  creator: 'Series AI, Inc.',
  upstreamUrl: 'https://github.com/series-ai/gtm-mystvale',
}

export const CROPS: CropDef[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    seedItemId: 'wheat_seed',
    harvestItemId: 'wheat',
    harvestAmount: 3,
    growDays: 4,
    stages: 4,
    regrows: false,
    sellPrice: 12,
    seedPrice: 5,
    iconId: 'crop_wheat',
    stageSprites: ['crops/wheat_s0.png', 'crops/wheat_s1.png', 'crops/wheat_s2.png', 'crops/wheat_s3.png'],
    harvestSprite: 'crops/wheat_harvest.png',
  },
  {
    id: 'carrot',
    name: 'Carrot',
    seedItemId: 'carrot_seed',
    harvestItemId: 'carrot',
    harvestAmount: 2,
    growDays: 3,
    stages: 3,
    regrows: false,
    sellPrice: 20,
    seedPrice: 8,
    iconId: 'crop_carrot',
    stageSprites: ['crops/carrot_s0.png', 'crops/carrot_s1.png', 'crops/carrot_s2.png'],
    harvestSprite: 'crops/carrot_harvest.png',
  },
  {
    id: 'potato',
    name: 'Potato',
    seedItemId: 'potato_seed',
    harvestItemId: 'potato',
    harvestAmount: 3,
    growDays: 3,
    stages: 3,
    regrows: false,
    sellPrice: 16,
    seedPrice: 6,
    iconId: 'crop_potato',
    stageSprites: ['crops/potato_s0.png', 'crops/potato_s1.png', 'crops/potato_s2.png'],
    harvestSprite: 'crops/potato_harvest.png',
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    seedItemId: 'strawberry_seed',
    harvestItemId: 'strawberry',
    harvestAmount: 4,
    growDays: 5,
    stages: 4,
    regrows: true,
    sellPrice: 30,
    seedPrice: 15,
    iconId: 'crop_strawberry',
    stageSprites: ['crops/strawberry_s0.png', 'crops/strawberry_s1.png', 'crops/strawberry_s2.png', 'crops/strawberry_s3.png'],
    harvestSprite: 'crops/strawberry_harvest.png',
  },
  {
    id: 'tomato',
    name: 'Tomato',
    seedItemId: 'tomato_seed',
    harvestItemId: 'tomato',
    harvestAmount: 3,
    growDays: 4,
    stages: 4,
    regrows: true,
    sellPrice: 24,
    seedPrice: 12,
    iconId: 'crop_tomato',
    stageSprites: ['crops/tomato_s0.png', 'crops/tomato_s1.png', 'crops/tomato_s2.png', 'crops/tomato_s3.png'],
    harvestSprite: 'crops/tomato_harvest.png',
  },
  {
    id: 'blueberry',
    name: 'Blueberry',
    seedItemId: 'blueberry_seed',
    harvestItemId: 'blueberry',
    harvestAmount: 5,
    growDays: 6,
    stages: 4,
    regrows: true,
    sellPrice: 35,
    seedPrice: 18,
    iconId: 'crop_blueberry',
    stageSprites: ['crops/blueberry_s0.png', 'crops/blueberry_s1.png', 'crops/blueberry_s2.png', 'crops/blueberry_s3.png'],
    harvestSprite: 'crops/blueberry_harvest.png',
  },
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    seedItemId: 'pumpkin_seed',
    harvestItemId: 'pumpkin',
    harvestAmount: 1,
    growDays: 7,
    stages: 4,
    regrows: false,
    sellPrice: 50,
    seedPrice: 25,
    iconId: 'crop_pumpkin',
    stageSprites: ['crops/pumpkin_s0.png', 'crops/pumpkin_s1.png', 'crops/pumpkin_s2.png', 'crops/pumpkin_s3.png'],
    harvestSprite: 'crops/pumpkin_harvest.png',
  },
  {
    id: 'cabbage',
    name: 'Cabbage',
    seedItemId: 'cabbage_seed',
    harvestItemId: 'cabbage',
    harvestAmount: 2,
    growDays: 4,
    stages: 3,
    regrows: false,
    sellPrice: 22,
    seedPrice: 9,
    iconId: 'crop_cabbage',
    stageSprites: ['crops/cabbage_s0.png', 'crops/cabbage_s1.png', 'crops/cabbage_s2.png'],
    harvestSprite: 'crops/cabbage_harvest.png',
  },
  {
    id: 'turnip',
    name: 'Turnip',
    seedItemId: 'turnip_seed',
    harvestItemId: 'turnip',
    harvestAmount: 2,
    growDays: 2,
    stages: 3,
    regrows: false,
    sellPrice: 14,
    seedPrice: 5,
    iconId: 'crop_turnip',
    stageSprites: ['crops/turnip_s0.png', 'crops/turnip_s1.png', 'crops/turnip_s2.png'],
    harvestSprite: 'crops/turnip_harvest.png',
  },
  {
    id: 'onion',
    name: 'Onion',
    seedItemId: 'onion_seed',
    harvestItemId: 'onion',
    harvestAmount: 3,
    growDays: 3,
    stages: 3,
    regrows: false,
    sellPrice: 18,
    seedPrice: 7,
    iconId: 'crop_onion',
    stageSprites: ['crops/onion_s0.png', 'crops/onion_s1.png', 'crops/onion_s2.png'],
    harvestSprite: 'crops/onion_harvest.png',
  },
  {
    id: 'radish',
    name: 'Radish',
    seedItemId: 'radish_seed',
    harvestItemId: 'radish',
    harvestAmount: 2,
    growDays: 3,
    stages: 3,
    regrows: false,
    sellPrice: 19,
    seedPrice: 8,
    iconId: 'crop_radish',
    stageSprites: ['crops/radish_s0.png', 'crops/radish_s1.png', 'crops/radish_s2.png'],
    harvestSprite: 'crops/radish_harvest.png',
  },
  {
    id: 'beet',
    name: 'Beet',
    seedItemId: 'beet_seed',
    harvestItemId: 'beet',
    harvestAmount: 2,
    growDays: 4,
    stages: 3,
    regrows: false,
    sellPrice: 25,
    seedPrice: 10,
    iconId: 'crop_beet',
    stageSprites: ['crops/beet_s0.png', 'crops/beet_s1.png', 'crops/beet_s2.png'],
    harvestSprite: 'crops/beet_harvest.png',
  },
  {
    id: 'watermelon',
    name: 'Watermelon',
    seedItemId: 'watermelon_seed',
    harvestItemId: 'watermelon',
    harvestAmount: 1,
    growDays: 8,
    stages: 4,
    regrows: false,
    sellPrice: 65,
    seedPrice: 30,
    iconId: 'crop_watermelon',
    stageSprites: ['crops/watermelon_s0.png', 'crops/watermelon_s1.png', 'crops/watermelon_s2.png', 'crops/watermelon_s3.png'],
    harvestSprite: 'crops/watermelon_harvest.png',
  },
  {
    id: 'corn',
    name: 'Corn',
    seedItemId: 'corn_seed',
    harvestItemId: 'corn',
    harvestAmount: 3,
    growDays: 5,
    stages: 4,
    regrows: true,
    sellPrice: 28,
    seedPrice: 14,
    iconId: 'crop_corn',
    stageSprites: ['crops/corn_s0.png', 'crops/corn_s1.png', 'crops/corn_s2.png', 'crops/corn_s3.png'],
    harvestSprite: 'crops/corn_harvest.png',
  },
]

export const AVATAR_LAYERS: AvatarLayerDef[] = [
  { id: 'body-greyscale', label: 'Default Body', slot: 'body', path: 'avatar/character/sheet_large.png', zIndex: 10, tintable: true, defaultColor: '#fbd4b4' },
  { id: 'fem-face', label: 'Fem Face', slot: 'eyes', path: 'avatar/eyes/sheet_female_default_face.png', zIndex: 12, tintable: false },
  { id: 'male-face', label: 'Male Face', slot: 'eyes', path: 'avatar/eyes/sheet_male_default_face.png', zIndex: 12, tintable: false },
  { id: 'clothes-default', label: 'Default Tunic', slot: 'clothes', path: 'avatar/clothes/sheet_default_tunic.png', zIndex: 20, tintable: false },
  { id: 'clothes-overalls', label: 'Farming Overalls', slot: 'clothes', path: 'avatar/clothes/sheet_farming_overalls.png', zIndex: 20, tintable: false },
  { id: 'clothes-dress', label: 'Cottage Dress', slot: 'clothes', path: 'avatar/clothes/sheet_cottage_dress.png', zIndex: 20, tintable: true, defaultColor: '#c8d6e5' },
  { id: 'bob-cut', label: 'Bob Cut', slot: 'hair', path: 'avatar/hair/sheet_bobcut_hair.png', zIndex: 40, tintable: true, defaultColor: '#5c3a21' },
  { id: 'slick-back', label: 'Slick Back', slot: 'hair', path: 'avatar/hair/sheet_slickback_hair.png', zIndex: 40, tintable: true, defaultColor: '#2b2d42' },
  { id: 'braids', label: 'Braids', slot: 'hair', path: 'avatar/hair/sheet_braids_hair.png', zIndex: 40, tintable: true, defaultColor: '#8d5b4c' },
  { id: 'ponytail', label: 'Ponytail', slot: 'hair', path: 'avatar/hair/sheet_ponytail_hair.png', zIndex: 40, tintable: true, defaultColor: '#e0a96d' },
  { id: 'acc-hat-lucky', label: 'Lucky Straw Hat', slot: 'accessories', path: 'avatar/acc/hat_lucky.png', zIndex: 60, tintable: false },
  { id: 'acc-hat-cowboy', label: 'Cowboy Hat', slot: 'accessories', path: 'avatar/acc/hat_cowboy.png', zIndex: 60, tintable: false },
  { id: 'acc-hat-witch', label: 'Witch Hat', slot: 'accessories', path: 'avatar/acc/hat_witch.png', zIndex: 60, tintable: false },
  { id: 'acc-hat-pumpkin', label: 'Pumpkin Hat', slot: 'accessories', path: 'avatar/acc/hat_pumpkin.png', zIndex: 60, tintable: false },
  { id: 'acc-glasses', label: 'Reading Glasses', slot: 'accessories', path: 'avatar/acc/glasses.png', zIndex: 50, tintable: false },
  { id: 'acc-glasses-sun', label: 'Sunglasses', slot: 'accessories', path: 'avatar/acc/glasses_sun.png', zIndex: 50, tintable: false },
  { id: 'acc-beard', label: 'Full Beard', slot: 'accessories', path: 'avatar/acc/beard.png', zIndex: 45, tintable: false },
  { id: 'acc-earring-emerald', label: 'Emerald Earring', slot: 'accessories', path: 'avatar/acc/earring_emerald.png', zIndex: 50, tintable: false },
]

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = {
  selections: {
    body: 'body-greyscale',
    eyes: 'fem-face',
    clothes: 'clothes-overalls',
    hair: 'bob-cut',
    accessories: 'acc-hat-lucky',
  },
  tints: {
    skin: '#fbd4b4',
    hair: '#5c3a21',
    eyes: '#264653',
    clothes: '#4a7c59',
  },
}

export const AUDIO_TRACKS: AudioTrackDef[] = [
  // Music
  { id: 'misty-clearing', name: 'Misty Clearing (Theme)', category: 'music', path: 'audio/music/misty-clearing.ogg' },
  { id: 'glowing-bark', name: 'Glowing Bark', category: 'music', path: 'audio/music/glowing-bark.ogg' },
  { id: 'autumn-valley', name: 'Autumn Valley', category: 'music', path: 'audio/music/autumn-valley.ogg' },
  { id: 'tick-tock-trees', name: 'Tick Tock Trees', category: 'music', path: 'audio/music/tick-tock-trees.ogg' },
  { id: 'glass-forest', name: 'Glass Forest', category: 'music', path: 'audio/music/glass-forest.ogg' },
  { id: 'medieval-1', name: 'Town Gathering', category: 'music', path: 'audio/music/medieval-1.ogg' },
  { id: 'medieval-2', name: 'Village Tavern', category: 'music', path: 'audio/music/medieval-2.ogg' },
  { id: 'medieval-4', name: 'Sunset Meadow', category: 'music', path: 'audio/music/medieval-4.ogg' },
  // Ambient
  { id: 'forest-day', name: 'Forest (Day)', category: 'ambient', path: 'audio/ambient/forest-day.ogg' },
  { id: 'forest-night', name: 'Forest (Night)', category: 'ambient', path: 'audio/ambient/forest-night.ogg' },
  { id: 'interior-day', name: 'Cottage Interior (Day)', category: 'ambient', path: 'audio/ambient/interior-day.ogg' },
  { id: 'interior-night', name: 'Cottage Interior (Night)', category: 'ambient', path: 'audio/ambient/interior-night.ogg' },
  // SFX
  { id: 'sfx-harvest', name: 'Harvest Crop', category: 'sfx', subCategory: 'farm', path: 'audio/sfx/farm/harvest.ogg' },
  { id: 'sfx-hoe', name: 'Till Soil (Hoe)', category: 'sfx', subCategory: 'farm', path: 'audio/sfx/farm/hoe.ogg' },
  { id: 'sfx-water', name: 'Water Plot', category: 'sfx', subCategory: 'farm', path: 'audio/sfx/farm/watering.ogg' },
  { id: 'sfx-seed', name: 'Plant Seed', category: 'sfx', subCategory: 'farm', path: 'audio/sfx/farm/seed.ogg' },
  { id: 'sfx-chop', name: 'Chop Wood', category: 'sfx', subCategory: 'tools', path: 'audio/sfx/chop/chop-1.ogg' },
  { id: 'sfx-mine', name: 'Mine Ore', category: 'sfx', subCategory: 'tools', path: 'audio/sfx/mining/mine-1.ogg' },
  { id: 'sfx-cast', name: 'Fish Cast', category: 'sfx', subCategory: 'fishing', path: 'audio/sfx/fishing/cast.ogg' },
  { id: 'sfx-catch', name: 'Fish Catch', category: 'sfx', subCategory: 'fishing', path: 'audio/sfx/fishing/catch.ogg' },
  { id: 'sfx-sword-hit', name: 'Sword Hit', category: 'sfx', subCategory: 'combat', path: 'audio/sfx/sword/hit-1.ogg' },
  { id: 'sfx-chest-open', name: 'Open Chest', category: 'sfx', subCategory: 'objects', path: 'audio/sfx/chest/open-1.ogg' },
  { id: 'sfx-door-open', name: 'Open Door', category: 'sfx', subCategory: 'objects', path: 'audio/sfx/door/open-1.ogg' },
  { id: 'sfx-level-up', name: 'Level Up', category: 'sfx', subCategory: 'ui', path: 'audio/sfx/ui/level-up.ogg' },
  { id: 'sfx-quest-complete', name: 'Quest Complete', category: 'sfx', subCategory: 'ui', path: 'audio/sfx/ui/quest-complete.ogg' },
  { id: 'sfx-buy-sell', name: 'Buy / Sell Coin', category: 'sfx', subCategory: 'ui', path: 'audio/sfx/ui/buy-sell.ogg' },
  { id: 'sfx-dialogue', name: 'Dialogue Bleep', category: 'sfx', subCategory: 'ui', path: 'audio/sfx/ui/dialogue-bleep.ogg' },
]

export const UI_ELEMENTS: UiElementDef[] = [
  { id: 'panel-wood', name: 'Wood Frame Panel', type: 'panel', path: 'ui/panel_wood.png', slice: { top: 12, right: 12, bottom: 12, left: 12 } },
  { id: 'panel-parchment', name: 'Parchment Scroll', type: 'panel', path: 'ui/panel_parchment.png', slice: { top: 16, right: 16, bottom: 16, left: 16 } },
  { id: 'panel-dialogue', name: 'Dialogue Box', type: 'dialogue', path: 'ui/dialogue_box.png', slice: { top: 14, right: 14, bottom: 14, left: 14 } },
  { id: 'btn-green', name: 'Confirm Button (Green)', type: 'button', path: 'ui/button_green.png' },
  { id: 'btn-wood', name: 'Rustic Button (Wood)', type: 'button', path: 'ui/button_wood.png' },
  { id: 'slot-inventory', name: 'Item Slot Container', type: 'slot', path: 'ui/slot_inventory.png' },
]

export const ICON_REGISTRY: IconDef[] = [
  // Tools
  { id: 'tool_hoe', name: 'Hoe', category: 'tool', path: 'icons/tool_hoe.png' },
  { id: 'tool_watercan', name: 'Watering Can', category: 'tool', path: 'icons/tool_watercan.png' },
  { id: 'tool_axe', name: 'Axe', category: 'tool', path: 'icons/tool_axe.png' },
  { id: 'tool_pickaxe', name: 'Pickaxe', category: 'tool', path: 'icons/tool_pickaxe.png' },
  { id: 'tool_rod', name: 'Fishing Rod', category: 'tool', path: 'icons/tool_fishing_rod.png' },
  { id: 'tool_scythe', name: 'Scythe', category: 'tool', path: 'icons/tool_scythe.png' },
  // Crops & Seeds
  { id: 'crop_wheat', name: 'Wheat Harvest', category: 'crop', path: 'icons/crop_wheat.png' },
  { id: 'crop_carrot', name: 'Carrot Harvest', category: 'crop', path: 'icons/crop_carrot.png' },
  { id: 'crop_potato', name: 'Potato Harvest', category: 'crop', path: 'icons/crop_potato.png' },
  { id: 'crop_strawberry', name: 'Strawberry Harvest', category: 'crop', path: 'icons/crop_strawberry.png' },
  { id: 'crop_pumpkin', name: 'Pumpkin Harvest', category: 'crop', path: 'icons/crop_pumpkin.png' },
  { id: 'crop_tomato', name: 'Tomato Harvest', category: 'crop', path: 'icons/crop_tomato.png' },
  // Resources
  { id: 'res_wood', name: 'Wood Log', category: 'resource', path: 'icons/res_wood.png' },
  { id: 'res_stone', name: 'Stone Rock', category: 'resource', path: 'icons/res_stone.png' },
  { id: 'res_coal', name: 'Coal Ore', category: 'resource', path: 'icons/res_coal.png' },
  { id: 'res_copper', name: 'Copper Bar', category: 'resource', path: 'icons/res_copper.png' },
  { id: 'res_iron', name: 'Iron Bar', category: 'resource', path: 'icons/res_iron.png' },
  { id: 'res_gold', name: 'Gold Bar', category: 'resource', path: 'icons/res_gold.png' },
  // Weapons
  { id: 'wpn_sword', name: 'Iron Sword', category: 'weapon', path: 'icons/wpn_sword.png' },
  { id: 'wpn_shield', name: 'Wooden Shield', category: 'weapon', path: 'icons/wpn_shield.png' },
  // Fish
  { id: 'fish_carp', name: 'Pond Carp', category: 'fish', path: 'icons/fish_carp.png' },
  { id: 'fish_salmon', name: 'River Salmon', category: 'fish', path: 'icons/fish_salmon.png' },
]

export const AUTOTILE_TERRAINS: AutotileTerrainDef[] = [
  { id: 'grass', name: 'Lush Grass', sheetPath: 'tiles/terrain_grass.png', tileSize: 32, previewTileIndex: 0 },
  { id: 'dirt', name: 'Tilled Soil / Dirt', sheetPath: 'tiles/terrain_dirt.png', tileSize: 32, previewTileIndex: 0 },
  { id: 'water', name: 'Pond Water', sheetPath: 'tiles/terrain_water.png', tileSize: 32, previewTileIndex: 0 },
  { id: 'stone_path', name: 'Cobblestone Path', sheetPath: 'tiles/terrain_stone_path.png', tileSize: 32, previewTileIndex: 0 },
  { id: 'sand', name: 'Coast Sand', sheetPath: 'tiles/terrain_sand.png', tileSize: 32, previewTileIndex: 0 },
]
