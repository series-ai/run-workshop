import { describe, expect, it } from 'vitest'
import { PFX_TAXONOMY, createPfxPreset, filterPfxCatalog } from './tooling/01'
import {
  PFX_MESH_STUNTED_EFFECT_IDS,
  PFX_MESH_STUNTED_MARK_ID,
  expandPfxMarkIds,
  reviewSetBadgeForEffect,
  reviewSetTagsForEffect,
} from './reviewSets'

describe('mesh-stunted review set', () => {
  it('names eighteen catalog effects that exist in the locked taxonomy', () => {
    expect(PFX_MESH_STUNTED_EFFECT_IDS).toHaveLength(18)
    expect(new Set(PFX_MESH_STUNTED_EFFECT_IDS).size).toBe(18)
    const catalogIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
    for (const id of PFX_MESH_STUNTED_EFFECT_IDS) {
      expect(catalogIds.has(id), id).toBe(true)
    }
  })

  it('tags those presets so search and the review-set filter return the same set', () => {
    for (const id of PFX_MESH_STUNTED_EFFECT_IDS) {
      expect(reviewSetTagsForEffect(id)).toEqual([PFX_MESH_STUNTED_MARK_ID])
      expect(reviewSetBadgeForEffect(id)).toBe('MESH')
      expect(createPfxPreset(id).tags).toContain(PFX_MESH_STUNTED_MARK_ID)
    }

    expect(reviewSetTagsForEffect('fireball')).toEqual([])
    expect(createPfxPreset('fireball').tags).not.toContain(PFX_MESH_STUNTED_MARK_ID)

    const byFilter = filterPfxCatalog({ reviewSet: [PFX_MESH_STUNTED_MARK_ID] }).map((item) => item.effect.id)
    const bySearch = filterPfxCatalog({ query: PFX_MESH_STUNTED_MARK_ID }).map((item) => item.effect.id)
    expect(byFilter.sort()).toEqual([...PFX_MESH_STUNTED_EFFECT_IDS].sort())
    expect(bySearch.sort()).toEqual([...PFX_MESH_STUNTED_EFFECT_IDS].sort())
  })

  it('expands the mark alias to the tagged effect ids', () => {
    expect(expandPfxMarkIds([PFX_MESH_STUNTED_MARK_ID])).toEqual([...PFX_MESH_STUNTED_EFFECT_IDS])
    expect(expandPfxMarkIds(['fireball', PFX_MESH_STUNTED_MARK_ID])).toEqual([
      'fireball',
      ...PFX_MESH_STUNTED_EFFECT_IDS,
    ])
    expect(expandPfxMarkIds(['inspect-sheets'])).toEqual(['inspect-sheets'])
    expect(expandPfxMarkIds([PFX_MESH_STUNTED_MARK_ID])).not.toContain(PFX_MESH_STUNTED_MARK_ID)
  })
})
