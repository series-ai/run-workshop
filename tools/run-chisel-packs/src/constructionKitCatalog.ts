import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { packCatalogSchema, type PackCatalog } from '../contracts/catalog'
import { TOOL_ROOT } from './paths'

export function withConstructionKit(catalog: PackCatalog): PackCatalog {
  const path = join(TOOL_ROOT, 'contracts/data/kits', `${catalog.pack}.json`)
  if (!existsSync(path)) return catalog
  return packCatalogSchema.parse({
    ...catalog,
    constructionKit: JSON.parse(readFileSync(path, 'utf8')),
  })
}
