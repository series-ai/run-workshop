import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { avatarPackCatalogSchema, voxelModelEntrySchema } from '../../contracts/catalog'
import { pirateModelsDir } from '../paths'
import { pirateAvatar, pirateModels, piratePartRules } from './pirate'

describe('Pirate Nation adapter', () => {
  it('adapts all 375 PN models to the shared schema, with files present', () => {
    const models = pirateModels(pirateModelsDir())
    expect(models).toHaveLength(375)
    for (const model of models) {
      voxelModelEntrySchema.parse(model)
      expect(existsSync(join(pirateModelsDir(), model.relativePath))).toBe(true)
    }
    expect(models.find((m) => m.id === 'characters-skins-skin-knight')?.clips).toContain('04_Walk')
  })

  it('turns index-keyed PN rules into per-part data', () => {
    expect(piratePartRules('headwear', 1).hidesHair).toBe(true)
    expect(piratePartRules('headwear', 4)).toMatchObject({ hidesHair: false, hairOverride: { pack: 'pirate', slot: 'hair', index: 4 } })
    expect(piratePartRules('species', 7).fullBody).toBe(true)
    expect(piratePartRules('species', 5).builtInFace).toBe(true)
    expect(piratePartRules('face', 2).hidesEyebrows).toBe(true)
    const avatar = avatarPackCatalogSchema.parse(pirateAvatar())
    expect(avatar.parts).toHaveLength(326)
    expect(avatar.clips).toHaveLength(32)
  })
})

describe('PFX id source', () => {
  it('reads the ranked catalog and the RUN effects with their loop flag', async () => {
    const { knownPfxIds, rvxEffects } = await import('./pfxIds')
    const ids = knownPfxIds()
    expect(ids.has('fireball')).toBe(true)
    expect(ids.has('rvx-fantasy-arcane-bolt')).toBe(true)
    expect(rvxEffects().get('rvx-fantasy-torch-flame')).toBe(true)
    expect(rvxEffects().get('rvx-fantasy-arcane-bolt')).toBe(false)
  })
})
