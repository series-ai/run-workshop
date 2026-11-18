import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const TOOL_ROOT = resolve(HERE, '..')
export const REPO_ROOT = resolve(TOOL_ROOT, '../..')
export const SOURCE_RIG_GLB = join(TOOL_ROOT, 'assets/source/ual1-base.glb')
export const SOURCE_UAL2_GLB = join(TOOL_ROOT, 'assets/source/ual2-standard.glb')
export const SOURCE_KAYKIT_RANGED_GLB = join(TOOL_ROOT, 'assets/source/kaykit-combat-ranged.glb')
export const STAGE_DIR = join(TOOL_ROOT, 'out/jam-stage')
export const META_DIR = join(TOOL_ROOT, 'out/meta')
export const SHOWCASE_CATALOG_DIR = join(REPO_ROOT, 'games/run-poly-showcase/public/catalog')
