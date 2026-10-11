/**
 * Filesystem locations. The Pirate Nation reference pack is read from a
 * jam-ready-assets checkout (read-only); `JAM_ASSETS_DIR` overrides it.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const OUT_DIR = join(TOOL_ROOT, 'out')
/** Jam-layout staging dir the showcase reads before publication. */
export const STAGE_DIR = join(OUT_DIR, 'jam-stage')
/** Build-time fitting guide from `npm run body-ref`; never shipped. */
export const BODY_REF = join(OUT_DIR, 'cache', 'pn-body-ref.npz')
export const BLENDER_BIN =
  process.env.BLENDER_BIN ?? '/Applications/Blender.app/Contents/MacOS/Blender'

export function jamAssetsDir(): string {
  const dir = process.env.JAM_ASSETS_DIR ?? join(homedir(), 'dev/jam-ready-assets')
  if (!existsSync(join(dir, 'proofofplay-pirate-nation'))) {
    throw new Error(`JAM_ASSETS_DIR "${dir}" has no proofofplay-pirate-nation pack`)
  }
  return dir
}

export function pirateModelsDir(): string {
  return join(jamAssetsDir(), 'proofofplay-pirate-nation/3D/pirate')
}

export const PIRATE_AVATAR_GLB = 'characters-skins/characters-skins-avatar-animation-all-023.glb'
