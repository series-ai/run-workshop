import { authoredRecipe } from '../constants/01'

// HERO-tier burst (Notion: Burst VFX Spec). A crit outranks a normal hit
// on >=2 axes (size, duration, layer count). Beat script at tempo 1.35
// (cycle ~0.74s): 0ms white flash pop + gold spike star snap out + ring
// launches; ~50ms victory sparks fan up, staggered; ~200ms glitter
// residue settles (alpha, desaturated) — the resolution beat the
// choreography audit flagged as missing. Brightest dies first: flash ->
// spikes -> ring -> sparks -> residue. Recommended game-side hitstop:
// 12-15 frames with micro-drift (Sakurai, hero tier).
export default authoredRecipe('critical-hit-burst', 'Critical hit burst', 'Particle-first hero combat confirm: a white contact pop, a broad uneven victory fan, and a low red pressure handoff make the critical read larger without a mesh star or ring.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 0.86, phase: 'critical-hit-burst-particle-contact-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff9e8', ramp: 'pinned-hot',
      lifecycle: 'critical-hit-burst-particle-confirm', delay: 0, window: 0.12, lifeScale: 0.38,
      countScale: 0.32, speedScale: 3.4, speedJitter: 0.44, drag: 2.6, gravity: -0.1,
      spawnScale: 0.08, depthScale: 2.8, size: [0.2, 0.5, 0.16], spinScale: 0,
      stretch: 0.35, death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, 0.42, 0],
      referenceSource: 'critical-hit-burst-contact-star-and-CC0-impact-sprite-language',
      referenceAdaptation: 'the white flash becomes a short-lived focal particle pop that yields immediately to the critical fan',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.98, scale: 1.08, phase: 'critical-hit-burst-particle-victory-fan',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'alpha', colorOverride: '#ffd45e', ramp: 'pigment',
      lifecycle: 'critical-hit-burst-particle-confirm', delay: 0.035, window: 0.28, lifeScale: 0.66,
      countScale: 0.78, speedScale: 4.6, speedJitter: 0.5, drag: 0.86, gravity: -2.3,
      spawnScale: 0.14, depthScale: 3.2, size: [0.12, 0.48, 0.08], spinScale: 0.4,
      stretch: 0.45, death: 'erode', ease: 'snap', turbulenceScale: 0.05, impactVector: [0, 0.16, 0], spreadAngle: 0.78, positionOffset: [0, 0.42, 0],
      referenceSource: 'critical-hit-burst-gold-spike-star-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the hero splinters become an uneven seeded fan with varied speed, depth, and fall rather than repeated rigid rays',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.64, scale: 1.24, phase: 'critical-hit-burst-particle-pressure-resolve',
    tuning: {
      motion: 'shockwave-ground-burst', sprite: 'puff', blend: 'alpha', colorOverride: '#8f3428', ramp: 'dark',
      lifecycle: 'critical-hit-burst-particle-confirm', delay: 0.2, window: 0.4, lifeScale: 0.84,
      countScale: 0.42, speedScale: 2.3, speedJitter: 0.42, drag: 1.25, gravity: -0.55,
      spawnScale: 0.62, spawnLift: 0.02, depthScale: 3.1, size: [0.24, 0.58, 0.44],
      spinScale: 0.24, death: 'erode', turbulenceScale: 0.14, positionOffset: [0, -0.12, 0],
      referenceSource: 'critical-hit-burst-damage-shockwave-and-CC0-puff-sprite-language',
      referenceAdaptation: 'the red damage ring becomes a low pressure resolve so the hero hit does not inherit the generic circular mesh vocabulary',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 2.4)
