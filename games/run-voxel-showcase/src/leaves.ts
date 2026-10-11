/**
 * jam-ready-assets leaf id for a catalog item. Shared by the app and
 * vite.config.ts (which cannot use the `@rvx` alias, hence the relative path).
 */
import { leafFor, type LeafKind, type PackKey } from '../../../tools/run-voxel-packs/contracts/packs'

const PIRATE_LEAVES: Partial<Record<LeafKind, string>> = {
  world: 'proofofplay-pirate-nation/3D/pirate',
  icons: 'proofofplay-pirate-nation/icons',
  ui: 'proofofplay-pirate-nation/ui',
}

export function leafId(pack: PackKey, leaf: LeafKind): string {
  if (pack !== 'pirate') return leafFor(pack, leaf).id
  const id = PIRATE_LEAVES[leaf]
  if (!id) throw new Error(`Pirate Nation has no ${leaf} leaf`)
  return id
}
