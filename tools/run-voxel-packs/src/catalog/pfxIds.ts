/**
 * Known PFX effect ids, from the library's generated `effect-ids.json`
 * (`npm run effect-ids` there; a library test keeps it in step): the ranked
 * catalog, the inspect packs, and the RUN voxel effects with their loop flag.
 * The library is not importable from plain Node (TSX with image imports).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOOL_ROOT } from '../paths'

const EFFECT_IDS = join(TOOL_ROOT, '../3d-pfx-library/effect-ids.json')

interface ExportedIds {
  catalog: string[]
  inspect: string[]
  rvx: { id: string; looping: boolean }[]
}

function exported(): ExportedIds {
  const ids = JSON.parse(readFileSync(EFFECT_IDS, 'utf8')) as Partial<ExportedIds>
  if (!ids.catalog || !ids.inspect || !ids.rvx) throw new Error(`${EFFECT_IDS} is out of date: run npm run effect-ids in tools/3d-pfx-library`)
  return ids as ExportedIds
}

export function knownPfxIds(): Set<string> {
  const ids = exported()
  const all = new Set([...ids.catalog, ...ids.inspect, ...ids.rvx.map((e) => e.id)])
  if (all.size < 500) throw new Error(`read only ${all.size} PFX ids from ${EFFECT_IDS}`)
  return all
}

/** RUN voxel effects: id → true for loops, false for one-shots. */
export function rvxEffects(): Map<string, boolean> {
  return new Map(exported().rvx.map((e) => [e.id, e.looping]))
}
