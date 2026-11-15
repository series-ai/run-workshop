import {
  AVATAR_SLOTS,
  PROPORTION_DEFAULTS,
  type AvatarPartEntry,
  type AvatarProportions,
  type AvatarSlot,
  type CharacterPreset,
  type HeldItemEntry,
  type PackCatalog,
} from '@poly/contracts/catalog'
import type { PolyPackKey } from '@poly/contracts/packs'
import { CONTEXT_DEFAULT_PALETTES, type PaletteColors } from '@poly/contracts/palette'
import type { AssetRef } from '../assetSource'

export interface PolyAvatarSelection {
  body: string
  head: string
  hair: string | null
  torso: string
  legs: string
  headwear: string | null
  back: string | null
  heldRight: string | null
  heldLeft: string | null
  clip: string
  palette: PaletteColors
  proportions: AvatarProportions
}

export function selectionFromPreset(preset: CharacterPreset): PolyAvatarSelection {
  return {
    body: preset.body,
    head: preset.head,
    hair: preset.hair,
    torso: preset.torso,
    legs: preset.legs,
    headwear: preset.headwear,
    back: preset.back,
    heldRight: preset.heldRight,
    heldLeft: preset.heldLeft,
    clip: preset.clip,
    palette: { ...preset.palette },
    proportions: { ...preset.proportions },
  }
}

export class PolyPartIndex {
  readonly partsById = new Map<string, AvatarPartEntry>()
  readonly partsBySlot = new Map<AvatarSlot, AvatarPartEntry[]>()
  readonly heldById = new Map<string, HeldItemEntry>()
  readonly coreRigRef: AssetRef

  constructor(catalogs: readonly PackCatalog[]) {
    for (const slot of AVATAR_SLOTS) this.partsBySlot.set(slot, [])
    const core = catalogs.find((c) => c.pack === 'core')
    if (!core || !core.rigModelPath) {
      throw new Error('Core pack catalog is missing or lacks rigModelPath')
    }
    this.coreRigRef = { leafId: 'run-poly-core/3D/characters', path: core.rigModelPath }
    for (const cat of catalogs) {
      for (const p of cat.parts) {
        this.partsById.set(p.id, p)
        this.partsBySlot.get(p.slot)!.push(p)
      }
      for (const h of cat.heldItems) {
        this.heldById.set(h.id, h)
      }
    }
  }

  getPart(id: string): AvatarPartEntry {
    const found = this.partsById.get(id)
    if (!found) throw new Error(`Unknown avatar part "${id}"`)
    return found
  }

  getHeld(id: string): HeldItemEntry {
    const found = this.heldById.get(id)
    if (!found) throw new Error(`Unknown held item "${id}"`)
    return found
  }
}

export function resolveVisibleParts(
  selection: PolyAvatarSelection,
  index: PolyPartIndex,
): { parts: AvatarPartEntry[]; totalTriangles: number } {
  const headwear = selection.headwear ? index.getPart(selection.headwear) : null
  const hideHair = headwear?.rules.hidesHair ?? false

  const chosenIds: (string | null)[] = [
    selection.body,
    selection.head,
    hideHair ? null : selection.hair,
    selection.torso,
    selection.legs,
    selection.headwear,
    selection.back,
  ]

  const parts: AvatarPartEntry[] = []
  let totalTriangles = 0
  for (const id of chosenIds) {
    if (!id) continue
    const part = index.getPart(id)
    parts.push(part)
    totalTriangles += part.triangles
  }
  return { parts, totalTriangles }
}

export function assetRefFor(pack: PolyPackKey, leaf: 'characters' | 'world', relativePath: string): AssetRef {
  const dir = pack === 'core' ? 'run-poly-core' : `run-poly-${pack}`
  const leafPath = leaf === 'characters' ? '3D/characters' : `3D/${pack}`
  return { leafId: `${dir}/${leafPath}`, path: relativePath }
}

export function createDefaultSelection(index: PolyPartIndex, context: 'medieval' | 'ww2' | 'sim' = 'medieval'): PolyAvatarSelection {
  const firstOf = (slot: AvatarSlot, prefix?: string) => {
    const list = index.partsBySlot.get(slot) ?? []
    const match = prefix ? list.find((p) => p.pack === prefix) : list[0]
    return (match ?? list[0])?.id ?? null
  }
  return {
    body: firstOf('body') ?? 'body_athletic',
    head: firstOf('head') ?? 'head_hero',
    hair: firstOf('hair'),
    torso: firstOf('torso', context) ?? 'torso_medieval_knight',
    legs: firstOf('legs', context) ?? 'legs_medieval_greaves',
    headwear: firstOf('headwear', context),
    back: firstOf('back', context),
    heldRight: [...index.heldById.values()].find((h) => h.pack === context && h.hand === 'hand_r')?.id ?? null,
    heldLeft: [...index.heldById.values()].find((h) => h.pack === context && h.hand === 'hand_l')?.id ?? null,
    clip: context === 'medieval' ? 'Sword_Idle' : context === 'ww2' ? 'Pistol_Idle_Loop' : 'Idle_Talking_Loop',
    palette: { ...CONTEXT_DEFAULT_PALETTES[context] },
    proportions: { ...PROPORTION_DEFAULTS },
  }
}
