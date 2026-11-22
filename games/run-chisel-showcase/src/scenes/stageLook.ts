import type { ContextPackKey } from '@chisel/contracts/packs'
import type { PaletteColors } from '@chisel/contracts/palette'
import { COLOR_DIRECTION } from '@chisel/contracts/colorDirection'

export type StageContext = 'all' | ContextPackKey

type StageLook = {
  title: string
  glow: string
  backdrop: string
  accent: string
  ground: readonly [string, string, string]
  view: readonly [number, number, number]
  key: string
  fill: string
  rim: string
}

export const STAGE_LOOK: Record<StageContext, StageLook> = {
  all: { title: 'All contexts', view: [0, 1.12, 1], ...COLOR_DIRECTION.overview },
  medieval: { title: 'The Gate Crossing', view: [0.48, 0.82, 1], ...COLOR_DIRECTION.packs.medieval.stage.look },
  ww2: { title: 'The Convoy Checkpoint', view: [0.15, 0.77, 1], ...COLOR_DIRECTION.packs.ww2.stage.look },
  sim: { title: 'The Corner Café', view: [0.45, 0.75, 1], ...COLOR_DIRECTION.packs.sim.stage.look },
  cyberpunk: { title: 'Lantern Exchange', view: [-0.4, 0.75, 1], ...COLOR_DIRECTION.packs.cyberpunk.stage.look },
  monsters: { title: 'The Brood Mine', view: [0.4, 0.85, 1], ...COLOR_DIRECTION.packs.monsters.stage.look },
}

type PropPalette = 'base' | 'floor' | 'structure' | 'life'

export function stagePropPalette(context: ContextPackKey, kind: PropPalette): PaletteColors {
  const { props, stage } = COLOR_DIRECTION.packs[context]
  return kind === 'base' ? props.default : { ...props.default, ...stage.groups[kind] }
}

export function stagePropKind(id: string, floor: boolean): PropPalette {
  if (floor && !/(?:water|lava|sludge)/.test(id)) return 'floor'
  if (/(?:tree|hedge|hay|bush|flower|mushroom|totem|vending|kiosk|billboard)/.test(id)) return 'life'
  if (/(?:apartment|bunker|booth|bistro|cottage|house|tower|wall|keep|shrine|arch|doorway|shed|hut|inn|shop|substation|mine|basalt|stalagmite)/.test(id)) return 'structure'
  return 'base'
}

type SceneCamera = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  portrait?: Pick<SceneCamera, 'position' | 'target'> & { halfAngle: number }
}

export const SCENE_CAMERAS: Record<ContextPackKey, SceneCamera> = {
  medieval: {
    position: [0.55, 2.65, 8.12], target: [-1.08, 0.98, -1.49],
    portrait: { position: [-1.76, 2.68, 8.9], target: [-1.84, 1.12, -1.52], halfAngle: 24 },
  },
  ww2: {
    position: [-2.10, 2.34, 5.40], target: [-1.17, 1.29, -1.63],
    portrait: { position: [-2.31, 2.28, 5.50], target: [-1.18, 1.25, -0.72], halfAngle: 25 },
  },
  sim: {
    position: [3.70, 2.85, 7.85], target: [-1.68, 1.30, -0.57],
    portrait: { position: [1.70, 2.57, 8.55], target: [-1.57, 1.37, -1.15], halfAngle: 25 },
  },
  cyberpunk: {
    position: [-0.37, 1.69, 4.43], target: [2.22, 1.42, -1.58],
    portrait: { position: [1.5, 1.78, 5.05], target: [2.95, 1.32, -0.98], halfAngle: 25 },
  },
  monsters: {
    position: [1.54, 2.96, 7.35], target: [-0.75, 1.2, -0.78],
    portrait: { position: [0.64, 2.74, 7.55], target: [0.42, 1.17, -0.83], halfAngle: 25 },
  },
}
