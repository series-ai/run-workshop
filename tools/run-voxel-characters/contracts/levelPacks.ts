import boardThemes from './data/board-themes.json'
import { leafFor, VOXCHAR_PACK_KEYS, type VoxCharLeafKind, type VoxCharPackKey } from './packs'

export type BoardPackKey = keyof typeof boardThemes
export const BOARD_PACK_KEYS = Object.keys(boardThemes) as BoardPackKey[]
export const LEVEL_PACK_KEYS = [...VOXCHAR_PACK_KEYS, ...BOARD_PACK_KEYS] as const
export type LevelPackKey = (typeof LEVEL_PACK_KEYS)[number]

/** Every level kit prop, voxel scene, and vehicle ships in the world leaf of its pack. */
export const LEVEL_KIT_LEAF = 'world' as const satisfies VoxCharLeafKind

export function isBoardPack(pack: LevelPackKey): pack is BoardPackKey {
  return Object.hasOwn(boardThemes, pack)
}

export function levelLeafId(pack: LevelPackKey, kind: VoxCharLeafKind): string {
  if (!isBoardPack(pack)) return leafFor(pack, kind).id
  if (kind !== 'world') throw new Error(`${pack}: expected a world leaf.`)
  return `run-cubix-${pack}/3D/${boardThemes[pack]}`
}

export function isCharacterPack(pack: LevelPackKey): pack is VoxCharPackKey {
  return !isBoardPack(pack)
}
