/**
 * Clip vocabulary. Prop clips are node-hierarchy TRS clips with PN-style
 * names. Avatar clip ids are `NN_Name`; PN owns 00–31 and each RUN pack owns
 * the range in `data/packs.json`, so ids never collide across packs.
 */
import clipsJson from './data/clips.json'
import { RVX_PACKS, type RvxPackKey } from './packs'

export const PROP_CLIPS: readonly string[] = clipsJson.propClips
/** Prop clips that play once (open, close, hit, attack, death); the others loop and must end where they start. */
export const ONE_SHOT_CLIPS: readonly string[] = clipsJson.oneShotClips
export const CLIP_FPS: number = clipsJson.fps
export const PIRATE_AVATAR_CLIPS: readonly string[] = clipsJson.pirateAvatarClips
export const HELD_ITEM_TEST_CLIPS: readonly string[] = clipsJson.heldItemTestClips
/** Avatar clips where a held item acts, and when (fractions of the clip; see data/clips.json). */
export const AVATAR_ACTION_STRIKES: Readonly<Record<string, readonly number[]>> = (() => {
  const strikes = clipsJson.avatarActionStrikes as Record<string, number[]>
  for (const [clip, list] of Object.entries(strikes)) {
    if (list.length === 0 || list.some((f) => !(f >= 0 && f < 1))) throw new Error(`clips.json avatarActionStrikes.${clip}: each moment must be a fraction in [0, 1)`)
  }
  return strikes
})()

const AVATAR_CLIP_ID = /^(\d{2})_[A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*$/

export function avatarClipNumber(clipId: string): number {
  const match = AVATAR_CLIP_ID.exec(clipId)
  if (!match?.[1]) throw new Error(`avatar clip id "${clipId}" is not NN_Name`)
  return Number(match[1])
}

/** Which pack owns an avatar clip id, by its number. */
export function avatarClipOwner(clipId: string): RvxPackKey | 'pirate' {
  const n = avatarClipNumber(clipId)
  if (n <= 31) return 'pirate'
  for (const [key, pack] of Object.entries(RVX_PACKS) as [RvxPackKey, (typeof RVX_PACKS)[RvxPackKey]][]) {
    if (n >= pack.clipRange[0] && n <= pack.clipRange[1]) return key
  }
  throw new Error(`avatar clip "${clipId}" is outside every pack clip range`)
}

export function isPropClip(name: string): boolean {
  return PROP_CLIPS.includes(name)
}
