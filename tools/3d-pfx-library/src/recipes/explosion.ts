import { authoredRecipe } from '../constants/01'

// Choreographed per the explosion spec (Notion: Explosion Choreography
// Spec). One ~1.18s event; cycle fraction 0.01 ≈ 12ms. Timing script:
//   0ms    flash pops (hero beat, hard exit by ~140ms — mesh envelope)
//   0ms    shockwave ring launches, outpaces everything (gone by ~350ms)
//   0ms    spark streaks lead out, die just after the ring
//   ~60ms  fireball is revealed INSIDE the dying flash, 80/20 inflate,
//          hangs, then erodes (never implodes)
//   ~50ms  debris chunks arc out under gravity, spinning
//   ~95ms  ground dust wall kicks up low (matter contrast)
//   ~310ms smoke inherits at the fireball's EDGES (not the origin),
//          the only layer that ends bigger than it started
//   ~380ms embers fall out of the smoke as the afterglow beat
// Every layer has one job (R18); staggered starts are the feel (R17).
// NOTE: array order is DRAW order (matter under, additive on top) — the
// beat numbers in the comments are the TIMING order.
export default authoredRecipe('explosion', 'Gameplay blast', 'Short read on damage radius, sparks, and expanding shock front.', [
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.46,
    scale: 1,
    phase: 'linger-smoke',
    // Beat 7 — the resolution: smoke inherits at the fireball's edges
    // (~310ms, spawnScale pushes spawn off the origin), rolls slowly
    // upward, ends LARGER than it started, erodes away last.
    tuning: {
      sprite: 'smoke',
      blend: 'alpha',
      window: 0.24,
      delay: 0.26,
      countScale: 0.18,
      speedScale: 0.3,
      gravity: 0.5,
      drag: 2.2,
      spawnScale: 1.15,
      size: [1.15, 1.7, 2.1],
      ramp: 'held',
      spinScale: 0.35,
      // Tempo pass: smoke gone ~1.3s (mobile spec 0.8-1.5s) — was ~3s.
      lifeScale: 1.1,
      turbulenceScale: 0.5,
      // No bands here: cel banding crushes the soft alpha falloff into hard
      // rims — right for hot drawn shapes (fire/flash), wrong for soft
      // matter. Smoke keeps soft edges; erosion still owns the death.
      death: 'erode',
    },
  },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.7,
    scale: 0.9,
    phase: 'dust-wall',
    // Beat 6 — ground contact: a low warm-grey dust wall kicked outward
    // (~95ms), the matter the additive fire reads against.
    tuning: { sprite: 'puff', blend: 'alpha', window: 0.14, delay: 0.08, countScale: 0.16, speedScale: 0.9, drag: 2, size: [0.7, 1.7, 2.1], ramp: 'dark', lifeScale: 1.2, death: 'erode', turbulenceScale: 0.5 },
  },
  {
    kind: 'impact-sparks',
    role: 'impact',
    opacity: 0.6,
    scale: 0.8,
    phase: 'debris-chunks',
    // Beat 5 — physical violence (~50ms): chunks arc under gravity,
    // spinning, eroding as they cool. Dark matter under the additive stack.
    // spinScale 1.1: chunk tumble is physical, but 3.2 at this sprite size
    // read as pinwheeling dots.
    tuning: { sprite: 'debris', blend: 'alpha', stretch: 0, gravity: -3.5, drag: 0.4, speedScale: 1.9, delay: 0.04, window: 0.06, size: [0.38, 0.32, 0.22], lifeScale: 0.8, countScale: 0.2, ramp: 'dark', spinScale: 1.1, death: 'erode', turbulenceScale: 0 },
  },
  // Beat 2 — radius telegraph (0-350ms). Must visibly outrun every layer.
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.92, scale: 2.6, phase: 'radius-read', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  // Beat 1 — the hero pop (0-140ms). Near-white, biggest, gone fast.
  { kind: 'core-sphere', role: 'impact', opacity: 1, scale: 1.55, phase: 'detonation-flash', tuning: { meshMotion: 'flash', colorOverride: '#fff1c2', startScale: 0.42, window: 0.14 } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.95,
    scale: 1.65,
    phase: 'fire-roil',
    // Beat 4 — the fireball body co-fires inside the flash, then outlives it.
    // A procedural single flame lick replaces the atlas fire cell: repeated
    // atlas glyphs read as identical magic twinkles instead of hot mass.
    tuning: { sprite: 'lick', window: 0.12, delay: 0, countScale: 0.38, speedScale: 0.65, drag: 4.5, spawnScale: 0.52, size: [0.9, 2.2, 0.75], spinScale: 0.8, lifeScale: 0.52, ramp: 'pinned-hot', ease: 'snap', turbulenceScale: 0.45 },
  },
  {
    kind: 'impact-sparks',
    role: 'impact',
    opacity: 0.95,
    scale: 0.9,
    phase: 'spark-jets',
    // Beat 3 — sparks lead the energy outward (0-47ms spawn) and die just
    // after the ring (counter-scaling: streaks shrink while all expands).
    // gravity 0: with drag killing speed, gravity re-bent the velocity
    // vector and the velocity-aligned streak visibly ROTATED in place —
    // cartoon sparks are straight radial single-glyph lines that shrink out.
    tuning: { sprite: 'streak', stretch: 1.4, gravity: 0, drag: 1.1, speedScale: 1.7, speedJitter: 0.45, window: 0.05, countScale: 0.28, size: [1, 0.58, 0.12], lifeScale: 0.32, spinScale: 0.2, ramp: 'pinned-hot', ease: 'snap', turbulenceScale: 0 },
  },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.9,
    // Manual review pass (2026-07-11): finer, near-weightless embers with
    // a hard gutter blink — scale 0.9->0.4, gravity -1.4->-0.5, flicker 2
    // (over-driven = blinks fully off), size-from 0.34->0.24.
    scale: 0.4,
    phase: 'ember-afterglow',
    // Beat 8 — afterglow (~380ms): embers were CARRIED here by the
    // fireball/smoke — they spawn up in the cloud volume (spawnLift +
    // spawnScale), drift weakly (the blast impulse is long spent; a fresh
    // outward burst this late reads as a second explosion), then gravity
    // wins: a gentle drag-dominated flutter down, guttering (flicker) as
    // they cool. Dots, not lines — spark-jets owns the line language.
    tuning: {
      // 'glow' = round radial dot. 'spark' was Kenney's elongated line
      // asset — with roll locked, every ember rendered as the same
      // parallel downward line.
      sprite: 'glow',
      blend: 'additive',
      window: 0.26,
      delay: 0.32,
      countScale: 0.22,
      speedScale: 0.35,
      gravity: -0.5,
      drag: 1.7,
      // Distributed around the explosion's mass (the cloud body), not in a
      // band above it.
      spawnScale: 1.3,
      spawnLift: 0.3,
      flicker: 2,
      size: [0.24, 0.26, 0.1],
      // Tempo pass: embers out ~1.05s (spec 0.5-0.8s + our gutter read).
      lifeScale: 0.7,
      spinScale: 0,
      stretch: 0,
      ramp: 'hot',
      turbulenceScale: 0,
    },
  },
// feelVersion 2: this recipe has been remediated — it opts into the v2
// renderer looks (soft shockwave disc, billboard flash, freshness).
// tempo 1.5: impulse profile — flash ~110ms, ring gone ~275ms, additive
// dead ~590ms, smoke gone ~1.3s. Duration signals significance; the
// structure was right but the urgency of a campfire (review verdict).
], 2, 1.5)
