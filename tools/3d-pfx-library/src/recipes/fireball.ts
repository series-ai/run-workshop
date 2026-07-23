import { authoredRecipe } from '../constants/01'

// Recipes below follow docs/reference-recipes.md (reference-derived layer
// stacks). Array order = draw order: normal-blend smoke sits under additive
// heat, flashes and sparks render last.
// Projectile spec (Notion: Projectile VFX Spec — Traveling Bodies). A
// fireball is a HELD NOTE, not an impulse: the body churns continuously,
// the trail carries the direction/speed read, cast and impact are separate
// pooled effects. Tier 'low' caps it at 3 draw calls — exactly the
// researched mobile floor of core + trail + glow. The wake-smoke layer and
// ember flecks are the spec's "deletable first" secondaries and are cut;
// the trail's dark ramp tail-end carries the cooled-matter read instead.
export default authoredRecipe('fireball', 'Comet fireball', 'Held-note projectile: hitbox-honest hot core is the brightest pixel, world-swept flame trail sells direction, glow card pushes the value range.', [
  {
    kind: 'particles',
    role: 'trail',
    opacity: 1,
    // scale 2: user-tuned in the live emitter panel — the lick chain reads
    // at reference size relative to the head.
    scale: 2,
    phase: 'flame-trail',
    // Review-directed single trail (helix retired for this effect): a
    // beaded line of calligraphic 'lick' sprites — the hand-authored
    // S-curved fire tongue matching the hero reference — shed from the
    // rear of the body, tapering and darkening with distance. Slow +-roll
    // per lick, slight lateral scatter, intentional gaps.
    tuning: { lifecycle: 'held-projectile-ignition', motion: 'trail-stream', sprite: 'lick', colorOverride: '#f04206', spawnOffset: [-0.3, 0, 0], spawnScale: 0.45, speedJitter: 0.22, size: [1.15, 0.9, 0.2], spinScale: 0.5, countScale: 0.9, speedScale: 17, drag: 0.3, stretch: 0, streamSpread: 0.32, lifeScale: 0.4, ramp: 'held', turbulenceScale: 0.35 },
  },
  // Value-range push (Riot: "a simple glow pushes the effect's value
  // range"): persistent camera-facing soft disc at ~2.2x the head, the
  // saturated dominant hue behind the near-white core.
  { kind: 'core-sphere', role: 'body', opacity: 0.9, scale: 0.9, phase: 'heat-glow', tuning: { lifecycle: 'held-projectile-ignition', meshMotion: 'glow', colorOverride: '#e02f10' } },
  // The hot point: one coherent teardrop volume (v2 render), near-white
  // core inside a hue shell — brightest pixel of the whole effect, centered
  // on the collision point. Persistent with internal churn; the rigid lobe
  // chain (bokeh-ball read) is the trail layer's job now.
  { kind: 'projectile-comet', role: 'body', opacity: 0.95, scale: 1.05, phase: 'hot-core', tuning: { lifecycle: 'held-projectile-ignition', meshMotion: 'travel', meshShader: 'fire-body', colorIndex: 0 } },

], 2, 1.2)
