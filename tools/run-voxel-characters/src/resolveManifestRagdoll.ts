import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { packCatalogSchema, type AvatarPartEntry, type CharacterPreset, type PackCatalog } from '../contracts/catalog'
import {
  interpolateBuildColliders,
  mergeColliderMaps,
  resolveCharacterRagdoll,
  type CharacterRagdollMetadata,
  type RagdollColliderMap,
} from '../contracts/ragdoll'

const BASE_MASS_BY_BODY: Readonly<Record<string, number>> = {
  body_slim: 64,
  body_athletic: 75,
  body_heavy: 88,
  body_dire_wolf: 65,
  body_giant_spider: 95,
  body_scrap_bot: 112,
  body_red_fox: 7,
  body_chestnut_horse: 450,
  body_timber_wolf: 42,
  body_pembroke_corgi: 12,
  body_chonky_pug: 9,
  body_k9_gsd: 35,
  body_ginger_cat: 4.5,
}

export function resolvePresetRagdoll(
  preset: CharacterPreset,
  partsById: ReadonlyMap<string, AvatarPartEntry>,
): CharacterRagdollMetadata {
  const rigId = preset.rigId ?? 'ual1'
  const build = preset.proportions.build ?? 0
  const bodyPart = partsById.get(preset.body)

  const morphVariants: Partial<Record<'body_slim' | 'body_athletic' | 'body_heavy', RagdollColliderMap>> = {}
  for (const key of ['body_slim', 'body_athletic', 'body_heavy'] as const) {
    const col = partsById.get(key)?.ragdollColliders
    if (col) morphVariants[key] = col
  }

  const bodyColliders = interpolateBuildColliders(
    preset.body,
    build,
    morphVariants,
    bodyPart?.ragdollColliders,
  )

  const headwear = preset.headwear ? partsById.get(preset.headwear) : undefined
  const hideHair = headwear?.rules.hidesHair ?? false
  const extraParts = [
    preset.head,
    hideHair ? null : preset.hair,
    preset.torso,
    preset.legs,
    preset.headwear,
    preset.back,
  ]
    .filter((id): id is string => Boolean(id))
    .map((id) => partsById.get(id)?.ragdollColliders)

  const bindColliders = mergeColliderMaps([bodyColliders, ...extraParts])
  return resolveCharacterRagdoll({
    rigId,
    proportions: preset.proportions,
    bindColliders,
    baseMassKg: BASE_MASS_BY_BODY[preset.body] ?? 75,
  })
}

export function populateManifestRagdoll(metaDir: string): PackCatalog[] {
  const manifestPath = join(metaDir, 'manifest.json')
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: number; packs: unknown[] }
  const packs = raw.packs.map((p) => packCatalogSchema.parse(p))
  const partsById = new Map<string, AvatarPartEntry>()
  for (const pack of packs) {
    for (const part of pack.parts) {
      partsById.set(part.id, part)
    }
  }

  const enriched = packs.map((pack) => ({
    ...pack,
    presets: pack.presets.map((preset) => ({
      ...preset,
      ragdoll: resolvePresetRagdoll(preset, partsById),
    })),
  }))

  writeFileSync(manifestPath, JSON.stringify({ version: 1, packs: enriched }, null, 2) + '\n')

  const corePath = join(metaDir, 'core.json')
  if (existsSync(corePath)) {
    const core = enriched.find((p) => p.pack === 'core')
    if (core) writeFileSync(corePath, JSON.stringify(core, null, 2) + '\n')
  }
  return enriched
}
