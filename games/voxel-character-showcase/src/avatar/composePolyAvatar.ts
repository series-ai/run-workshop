import {
  AVATAR_SLOTS,
  HUMANOID_PROPORTION_DEFAULTS,
  PROPORTION_DEFAULTS,
  type AvatarPartEntry,
  type AvatarProportions,
  type AvatarSlot,
  type CharacterPreset,
  type HeldItemEntry,
  type PackCatalog,
} from '@voxchar/contracts/catalog'
import { type VoxCharPackKey } from '@voxchar/contracts/packs'
import { levelLeafId, type LevelPackKey } from '@voxchar/contracts/levelPacks'
import { CONTEXT_DEFAULT_PALETTES, type PaletteColors } from '@voxchar/contracts/palette'
import type { RigId } from '@voxchar/contracts/rig'
import type { AssetRef } from '../assetSource'

export interface PolyAvatarSelection {
  rigId: RigId
  body: string
  head: string | null
  hair: string | null
  torso: string | null
  legs: string | null
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
    rigId: preset.rigId ?? 'ual1',
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
    proportions: { ...PROPORTION_DEFAULTS, ...preset.proportions },
  }
}

export class PolyPartIndex {
  readonly partsById = new Map<string, AvatarPartEntry>()
  readonly partsBySlot = new Map<AvatarSlot, AvatarPartEntry[]>()
  readonly heldById = new Map<string, HeldItemEntry>()
  readonly coreRigRef: AssetRef
  readonly rigRefs = new Map<RigId, AssetRef>()

  constructor(catalogs: readonly PackCatalog[]) {
    for (const slot of AVATAR_SLOTS) this.partsBySlot.set(slot, [])
    const core = catalogs.find((c) => c.pack === 'core')
    if (!core || !core.rigModelPath) {
      throw new Error('Core pack catalog is missing or lacks rigModelPath')
    }
    this.coreRigRef = assetRefFor('core', 'characters', core.rigModelPath)
    this.rigRefs.set('ual1', this.coreRigRef)
    for (const cat of catalogs) {
      for (const cr of cat.creatureRigs ?? []) {
        this.rigRefs.set(cr.rigId, assetRefFor(cat.pack, 'characters', cr.rigModelPath))
      }
      for (const p of cat.parts) {
        this.partsById.set(p.id, p)
        this.partsBySlot.get(p.slot)!.push(p)
      }
      for (const h of cat.heldItems) {
        this.heldById.set(h.id, h)
      }
    }
  }

  rigRefFor(rigId: RigId): AssetRef {
    const found = this.rigRefs.get(rigId)
    if (!found) throw new Error(`No rig asset registered for rigId "${rigId}"`)
    return found
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
): { parts: AvatarPartEntry[]; totalTriangles: number; extraCovered: string[] } {
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
  const extraCovered: string[] = []
  if (hideHair) {
    extraCovered.push('hair')
  }
  if (parts.some((p) => p.rules.hidesLegsUpper)) {
    extraCovered.push('legs_waist')
  }
  return { parts, totalTriangles, extraCovered }
}

export function assetRefFor(pack: LevelPackKey, leaf: 'characters' | 'world', relativePath: string): AssetRef {
  return { leafId: levelLeafId(pack, leaf), path: relativePath }
}

export function createDefaultSelection(
  index: PolyPartIndex,
  context: 'heist' | 'industrial' | 'security' | 'creatures' | 'fantasy' = 'heist',
): PolyAvatarSelection {
  const firstOf = (slot: AvatarSlot, prefix?: string, rigId: RigId = 'ual1') => {
    const list = (index.partsBySlot.get(slot) ?? []).filter((p) => p.rigId === rigId)
    const match = prefix ? list.find((p) => p.pack === prefix) : list[0]
    return (match ?? list[0])?.id ?? null
  }
  return {
    rigId: 'ual1',
    body: firstOf('body', context === 'creatures' ? 'creatures' : undefined) ?? 'body_athletic',
    head: firstOf('head') ?? 'head_rugged_hero',
    hair: firstOf('hair'),
    torso: firstOf('torso', context) ?? 'torso_heist_tee',
    legs: firstOf('legs', context) ?? 'legs_heist_holster_jeans',
    headwear: firstOf('headwear', context),
    back: firstOf('back', context),
    heldRight: [...index.heldById.values()].find((h) => h.pack === context && h.hand === 'hand_r')?.id ?? null,
    heldLeft: [...index.heldById.values()].find((h) => h.pack === context && h.hand === 'hand_l')?.id ?? null,
    clip:
      context === 'heist'
        ? 'Idle_Loop'
        : context === 'security'
          ? 'Pistol_Idle_Loop'
          : context === 'industrial'
            ? 'Idle_Torch_Loop'
            : context === 'fantasy'
              ? 'Sword_Idle'
              : 'Walk_Loop',
    palette: { ...CONTEXT_DEFAULT_PALETTES[context] },
    // The creatures context starts on the sculpted Scrap Bot. The other contexts start on a voxel human.
    proportions: { ...(context === 'creatures' ? PROPORTION_DEFAULTS : HUMANOID_PROPORTION_DEFAULTS) },
  }
}
