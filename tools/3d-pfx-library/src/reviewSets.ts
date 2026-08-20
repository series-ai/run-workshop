export const PFX_MESH_STUNTED_MARK_ID = 'mesh-stunted'

/** Mesh-heavy effects that look stunted. Review them as one set. */
export const PFX_MESH_STUNTED_EFFECT_IDS = [
  'rain-burst',
  'wind-burst',
  'exhaust-hit',
  'teleport-hit',
  'holy-release',
  'beam-telegraph',
  'barrier-column',
  'jump-beam',
  'curse-column',
  'laser-spray',
  'water-column',
  'target-spawn',
  'shard-break',
  'dash-idle',
  'healing-loop',
  'spark-loop',
  'warning-loop',
  'spawn-screen',
] as const

export interface PfxReviewSet {
  id: string
  label: string
  badge: string
  ids: readonly string[]
}

export const PFX_REVIEW_SETS: readonly PfxReviewSet[] = [
  {
    id: PFX_MESH_STUNTED_MARK_ID,
    label: 'Mesh stunted',
    badge: 'MESH',
    ids: PFX_MESH_STUNTED_EFFECT_IDS,
  },
]

export const PFX_REVIEW_SET_BY_ID: Readonly<Record<string, PfxReviewSet>> = Object.fromEntries(
  PFX_REVIEW_SETS.map((set) => [set.id, set]),
)

const REVIEW_SETS_BY_EFFECT_ID = new Map<string, PfxReviewSet[]>()
for (const set of PFX_REVIEW_SETS) {
  for (const effectId of set.ids) {
    const current = REVIEW_SETS_BY_EFFECT_ID.get(effectId)
    if (current) current.push(set)
    else REVIEW_SETS_BY_EFFECT_ID.set(effectId, [set])
  }
}

export function reviewSetTagsForEffect(effectId: string): string[] {
  return (REVIEW_SETS_BY_EFFECT_ID.get(effectId) ?? []).map((set) => set.id)
}

export function reviewSetBadgeForEffect(effectId: string): string | null {
  return REVIEW_SETS_BY_EFFECT_ID.get(effectId)?.[0]?.badge ?? null
}

export function effectIdsForReviewSets(reviewSetIds: readonly string[]): Set<string> {
  const allowed = new Set<string>()
  for (const id of reviewSetIds) {
    const set = PFX_REVIEW_SET_BY_ID[id]
    if (!set) continue
    for (const effectId of set.ids) allowed.add(effectId)
  }
  return allowed
}

export function effectMatchesReviewSets(
  effectId: string,
  reviewSetIds: readonly string[] | undefined,
): boolean {
  if (!reviewSetIds?.length) return true
  return effectIdsForReviewSets(reviewSetIds).has(effectId)
}

export function defaultPfxMarkLabel(rawMarkIds: readonly string[]): string {
  if (rawMarkIds.length !== 1) return 'MARKED'
  return PFX_REVIEW_SET_BY_ID[rawMarkIds[0]!]?.badge ?? 'MARKED'
}

export function expandPfxMarkIds(ids: readonly string[]): string[] {
  const expanded: string[] = []
  for (const id of ids) {
    const reviewSet = PFX_REVIEW_SET_BY_ID[id]
    if (reviewSet) {
      expanded.push(...reviewSet.ids)
      continue
    }
    expanded.push(id)
  }
  return expanded
}
