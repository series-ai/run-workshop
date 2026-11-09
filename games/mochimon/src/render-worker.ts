// The slow part, off the page's thread: ray-march one frame of a character and code its colours. The page sends what
// to draw (the look as list indices, which motion and frame, or a still pose) and gets back the frame's pixels (the
// one-bit bitmap) and its colour codes at every shade count the palettes use, so painting it is instant.

import { CLEAR } from './model/bitmap.ts'
import { ACCESSORIES, ANIMS, BODIES, CLOTHES, COATS, colorize, compose, CUBE, draw, EARS, EYEWEAR, FEET, MOODS, ROUND_CUBE, setRenderSize, TAILS, walkPose, type ColorInfo, type Fx, type Mood, type Pose, type TailStyle } from './model/cat-model.ts'

/** A look, as indices into the editor's lists. */
export interface Sel { coat: number; gear: number; clothes: number; ears: number; feet: number; body: number; eyes: number; tail: number }
export type Job =
  | { kind: 'motion'; sel: Sel; mode: string; i: number; v: number; k: number }
  | { kind: 'still'; sel: Sel; angle: number; k: number; wide: boolean }
export interface Done { w: number; h: number; px: Uint8Array; bottom: number; codes: Record<number, Uint8Array> }

const PW = 88, SPIN = 32, WALK = 8
const even = (n: number) => Math.round(n / 2) * 2
const SHADES = [1, 2, 3, 5] // 4, 8, 16/32 colours, and the role maps

function render(job: Job): Done {
  const s = job.sel
  const look = compose(COATS[s.coat][1], ACCESSORIES[s.gear][1], TAILS[s.tail] as TailStyle, CLOTHES[s.clothes][1], EARS[s.ears], FEET[s.feet], BODIES[s.body], EYEWEAR[s.eyes][1])
  let angle: number, mood: Mood = 'idle', pose: Pose | undefined, fx: Fx[] | undefined
  const wide = job.kind === 'motion' ? true : job.wide
  if (job.kind === 'still') angle = job.angle
  else if (job.mode === 'spin') angle = (job.i / SPIN) * Math.PI * 2 + job.v
  else if (job.mode === 'faces') { angle = -0.15 + job.v; mood = MOODS[job.i] }
  else if (job.mode in ANIMS) { const an = ANIMS[job.mode], f = an.at(job.i / an.frames); angle = an.angle + job.v; mood = f.mood; pose = f.pose; fx = f.fx }
  else { angle = (job.mode === 'walk side' ? -1.2 : -0.5) + job.v; pose = walkPose(job.i / WALK) }
  const k = job.k
  if (wide) setRenderSize(even(PW * 2 * k), even(78 * k), 0.62 / 1.5 / k, even(44 * k), even(20 * k))
  else setRenderSize(even(100 * k), even(78 * k), 0.62 / 1.5 / k, even(24 * k), even(12 * k))
  const info: ColorInfo = {}
  const b = draw(k > 1 ? ROUND_CUBE : CUBE, angle, mood, look, pose, info, fx)
  const px = new Uint8Array(b.w * b.h)
  let bottom = 0
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const v = b.get(x, y); px[y * b.w + x] = v; if (v !== CLEAR) bottom = y }
  const codes: Record<number, Uint8Array> = {}
  for (const n of SHADES) codes[n] = colorize(b, info, n)
  return { w: b.w, h: b.h, px, bottom, codes }
}

self.onmessage = (e: MessageEvent<{ id: number; job: Job }>) => {
  const done = render(e.data.job)
  ;(self as unknown as Worker).postMessage({ id: e.data.id, done }, [done.px.buffer, ...Object.values(done.codes).map((c) => c.buffer)])
}
