import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { packCatalogSchema } from './catalog'
import { SHOWCASE_CATALOG_DIR } from '../src/paths'

const catalog = JSON.parse(readFileSync(join(SHOWCASE_CATALOG_DIR, 'sim/catalog.json'), 'utf8'))
const layout = {
  id: 'shop_block',
  title: 'Shop Block',
  width: 8,
  depth: 6,
  props: [{ id: 'prop_sidewalk_tile', position: [0, 0, 0] }],
  route: [[0, 0.16, 0], [0, 0.16, 1]],
  view: [1, 1, 1],
}
const layoutB = { ...layout, id: 'market_block', title: 'Market Block' }
const parseKit = (layouts: unknown[], pack = 'sim') =>
  packCatalogSchema.parse({ ...catalog, constructionKit: { pack, layouts } })

describe('construction layouts in the pack catalog', () => {
  it('preserves both recipes in the catalog used by the showcase', () => {
    expect(parseKit([layout, layoutB]).constructionKit).toEqual({ pack: 'sim', layouts: [layout, layoutB] })
  })

  it('rejects a layout recipe that references an absent prop', () => {
    const broken = { ...layoutB, props: [{ id: 'prop_missing_shop_floor', position: [0, 0, 0] }] }
    expect(() => parseKit([layout, broken])).toThrow('prop_missing_shop_floor')
  })

  it('rejects duplicate IDs and recipes from another pack', () => {
    expect(() => parseKit([layout, layout])).toThrow('shop_block')
    expect(() => parseKit([layout, layoutB], 'medieval')).toThrow('medieval')
  })
})
