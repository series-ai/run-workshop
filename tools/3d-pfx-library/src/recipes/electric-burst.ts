import { authoredRecipe } from '../constants/01'

// MIRROR of spark-burst (working hit system) — electric blue theme +
// ground arcs. Reuse+recolor+theme over new behavior (review rule).
export default authoredRecipe('electric-burst', 'Electric burst', 'Voltage hit mirroring the spark system in electric blue, arcs crawling the ground.', [
  {
    kind: 'impact-sparks',
    role: 'impact',
    opacity: 0.9,
    scale: 0.66,
    phase: 'electric-burst-forked-arcs',
    tuning: { sprite: 'arc', stretch: 1.4, speedScale: 1.6, drag: 7, window: 0.04, size: [1.5, 0.9, 0.15], lifeScale: 0.24, spinScale: 0, ramp: 'held', ease: 'snap', turbulenceScale: 0, gravity: 0, colorOverride: '#3f9dff' },
  },
  { kind: 'ring-field', role: 'aura', opacity: 0.5, scale: 0.62, phase: 'electric-burst-voltage-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#59b7ff' } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.85,
    scale: 0.6,
    phase: 'electric-burst-ground-arcs',
    tuning: { motion: 'ground-scuff', sprite: 'arc', stretch: 1.2, delay: 0.14, window: 0.16, lifeScale: 0.6, speedScale: 3.2, gravity: 0, drag: 1.4, size: [1.2, 0.9, 0.2], spinScale: 0, ramp: 'held', ease: 'snap', turbulenceScale: 0, colorOverride: '#3f9dff' },
  },
], 2, 1.5)
