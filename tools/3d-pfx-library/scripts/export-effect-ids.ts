/**
 * Writes effect-ids.json: every ranked catalog effect id (PFX_TAXONOMY),
 * every inspect-pack id, and the RUN voxel effects with their loop flag (the
 * voxel pack pipeline checks PFX bindings against it). Consumers that cannot import the library (Node tools
 * without an asset pipeline) read this file. Regenerate after catalog changes:
 *   npx vite-node scripts/export-effect-ids.ts
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INSPECT_PACK_IDS } from '../src/inspect-packs/ids'
import { RVX_RECIPES } from '../src/inspect-packs/rvxRecipes'
import { PFX_TAXONOMY } from '../src/tooling/01'

const out = fileURLToPath(new URL('../effect-ids.json', import.meta.url))
const catalog = PFX_TAXONOMY.map((effect) => effect.id)
const rvx = RVX_RECIPES.map((recipe) => ({ id: recipe.id, looping: recipe.looping }))
writeFileSync(out, JSON.stringify({ catalog, inspect: INSPECT_PACK_IDS, rvx }, null, 1) + '\n')
console.log(`wrote ${catalog.length} catalog + ${INSPECT_PACK_IDS.length} inspect ids to ${out}`)
