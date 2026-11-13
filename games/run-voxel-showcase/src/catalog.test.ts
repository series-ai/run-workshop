import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogError, parseCatalog, previewRef } from './catalog'
import { pinFor, resolveAssetUrl } from './assetSource'

const fantasy = () => JSON.parse(readFileSync(join(import.meta.dirname, '../public/catalog/fantasy/catalog.json'), 'utf8')) as Record<string, unknown>

describe('catalog boundary', () => {
  it('parses a generated catalog and derives preview paths in the entry leaf', () => {
    const catalog = parseCatalog('fantasy', fantasy())
    const barrel = catalog.models.find((m) => m.id === 'fantasy-props-barrel')!
    expect(previewRef(barrel)).toEqual({ leafId: 'run-voxel-fantasy/3D/fantasy', path: 'props/Previews/fantasy-props-barrel.jpg' })
  })
  it('rejects a schema-invalid catalog and a pack mismatch', () => {
    const broken = fantasy()
    ;(broken.models as { bounds: unknown }[])[0]!.bounds = 'huge'
    expect(() => parseCatalog('fantasy', broken)).toThrow(CatalogError)
    expect(() => parseCatalog('space', fantasy())).toThrow(/declares pack "fantasy"/)
  })
})

describe('asset source', () => {
  it('resolves local refs under /jam and refuses pin-less leaves in pinned mode', async () => {
    await expect(resolveAssetUrl({ leafId: 'run-voxel-fantasy/3D/fantasy', path: 'props/a b.glb' }, { kind: 'local', base: 'jam' })).resolves.toBe('jam/run-voxel-fantasy/3D/fantasy/props/a%20b.glb')
    expect(() => pinFor({ kind: 'pinned', pins: {} }, 'run-voxel-fantasy/3D/fantasy')).toThrow(/no published pin for pack leaf "run-voxel-fantasy\/3D\/fantasy"/)
  })
})
