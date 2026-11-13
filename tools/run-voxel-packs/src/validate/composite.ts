/**
 * Avatar composite z-fighting. Parts are worn together: a RUN top over a
 * Pirate Nation body and RUN bottoms, a RUN face on a PN head, a hat from
 * one pack over hair from another. Two parts z-fight when faces of different
 * slots lie in one plane and overlap. A single file cannot show this (each
 * part file holds one pack), so this scan places every RUN part file and the
 * PN avatar (bodies and parts) in the shared rig space (bind pose) and checks
 * every pair of parts that can be worn together.
 *
 * Pairs counted: two parts that can be worn together (wornTogether: two
 * different slots, and no hide rule removes one when the other is on), at
 * least one of them a RUN part (PN against PN is PN's own art).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePartNodeName, type AvatarPartRef, type AvatarPartRules } from '../../contracts/catalog'
import { UNITS_PER_VOXEL } from '../../contracts/categories'
import { readGlb } from './inspect'
import { coplanarOverlapsAcross } from './zfight'

/** Planes closer than this (voxels) fight: PN's own face plates sit 0.01 voxel off the head. */
export const COMPOSITE_TOLERANCE = 0.01
/** Visible fight area (voxel²) above which a pair of parts fails. */
export const COMPOSITE_MAX_AREA = 0.5

export interface CompositeFight {
  /** The RUN part, and the part it fights with (a node name of either file). */
  part: string
  other: string
  /** Visible overlap, voxel² (overlap area × share of points where the colours differ). */
  area: number
  /** A point in the worst overlap, in rig voxels. */
  at: [number, number, number]
}

function ref(name: string): AvatarPartRef | null {
  try {
    return parsePartNodeName(name)
  } catch {
    return null
  }
}

const same = (a: AvatarPartRef, b: AvatarPartRef | undefined) => !!b && a.pack === b.pack && a.slot === b.slot && a.index === b.index

/**
 * Whether two parts can be on one avatar at once: different slots, and no
 * composition rule of either one hides the other (a hat that hides hair, a
 * face with its own eyebrows, a full-body species that takes only a back
 * part, a hat that forces its own tucked hair).
 */
export function wornTogether(a: AvatarPartRef, ra: AvatarPartRules, b: AvatarPartRef, rb: AvatarPartRules): boolean {
  if (a.slot === b.slot) return false
  const hides = (x: AvatarPartRef, rx: AvatarPartRules, y: AvatarPartRef): boolean => {
    if (y.slot === 'hair' && (rx.hidesHair || (rx.hairOverride && !same(y, rx.hairOverride)))) return true
    if (y.slot === 'eyebrow' && rx.hidesEyebrows) return true
    if (y.slot === 'facialhair' && rx.hidesFacialHair) return true
    if (x.slot === 'species' && rx.fullBody && y.slot !== 'back') return true
    if (x.slot === 'species' && rx.builtInFace && y.slot === 'face') return true
    return false
  }
  return !hides(a, ra, b) && !hides(b, rb, a)
}

/**
 * Pairs of parts that can be worn together and fight, worst first. `rulesOf`
 * gives each part's composition rules (PN parts: piratePartRules; RUN parts:
 * the build metadata).
 */
export async function avatarCompositeFights(
  partFiles: string[],
  pirateAvatarGlb: string,
  rulesOf: (part: AvatarPartRef) => AvatarPartRules,
  /** Check only this pack's parts (against everything else); default: every RUN part. */
  pack?: string,
): Promise<CompositeFight[]> {
  const docs = await Promise.all([pirateAvatarGlb, ...partFiles].map(async (path) => readGlb(new Uint8Array(readFileSync(path)))))
  const unit = UNITS_PER_VOXEL.avatar
  const overlaps = coplanarOverlapsAcross(docs, unit, {
    tolerance: COMPOSITE_TOLERANCE,
    subject: (node) => {
      const r = ref(node)
      return !!r && r.pack !== 'pirate' && (!pack || r.pack === pack)
    },
    pair: (a, b) => {
      const ra = ref(a)
      const rb = ref(b)
      return !!ra && !!rb && wornTogether(ra, rulesOf(ra), rb, rulesOf(rb))
    },
  })
  const byPair = new Map<string, CompositeFight>()
  for (const o of overlaps) {
    if (o.facing !== 'same' || o.mismatch === 0) continue
    const [a, b] = ref(o.nodes[0])!.pack === 'pirate' ? [o.nodes[1], o.nodes[0]] : o.nodes
    const key = `${a}|${b}`
    const area = (o.area * o.mismatch) / unit / unit
    const entry = byPair.get(key) ?? { part: a, other: b, area: 0, at: o.at.map((x) => x / unit) as [number, number, number] }
    entry.area += area
    byPair.set(key, entry)
  }
  return [...byPair.values()].sort((x, y) => y.area - x.area)
}

/** Composition rules of every RUN part, from the build metadata (out/meta/<pack>/<pack>-avatar-parts.json). */
export function rvxPartRules(metaDir: string, packs: readonly string[]): Map<string, AvatarPartRules> {
  const out = new Map<string, AvatarPartRules>()
  for (const pack of packs) {
    const path = join(metaDir, pack, `${pack}-avatar-parts.json`)
    if (!existsSync(path)) throw new Error(`${path} is missing: build the ${pack} avatar parts (npm run build:pack) so their composition rules are known`)
    const meta = JSON.parse(readFileSync(path, 'utf8')) as { parts: { nodeName: string; rules: AvatarPartRules }[] }
    for (const part of meta.parts) out.set(part.nodeName, part.rules)
  }
  return out
}
