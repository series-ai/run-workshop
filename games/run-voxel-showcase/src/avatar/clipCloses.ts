import { Quaternion, type AnimationClip } from 'three'

const ROTATION_DEGREES = 1
const OFFSET = 1e-3

/**
 * Whether a clip ends in the pose it starts in, so it can loop without a
 * snap. A clip that ends elsewhere (rising from a coffin, ending on aim)
 * plays once and holds instead.
 */
export function clipCloses(clip: AnimationClip): boolean {
  const a = new Quaternion()
  const b = new Quaternion()
  for (const track of clip.tracks) {
    const size = track.getValueSize()
    const n = track.times.length
    if (n < 2) continue
    const first = Array.from(track.values.slice(0, size))
    const last = Array.from(track.values.slice((n - 1) * size, n * size))
    if (track.ValueTypeName === 'quaternion') {
      a.fromArray(first)
      b.fromArray(last)
      if ((a.angleTo(b) * 180) / Math.PI > ROTATION_DEGREES) return false
    } else if (first.some((v, i) => Math.abs(v - last[i]!) > OFFSET)) {
      return false
    }
  }
  return true
}
