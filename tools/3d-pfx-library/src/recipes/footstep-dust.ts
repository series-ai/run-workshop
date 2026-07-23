import { authoredRecipe } from '../constants/01'

export default authoredRecipe('footstep-dust', 'Grounded footfall dust', 'Small directional ground puff for repeated movement feedback.', [
  { kind: 'footprint-decal', role: 'impact', opacity: 0.7, scale: 0.35, phase: 'ground-footprints', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#b58a5a' } },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.82,
    scale: 0.7,
    phase: 'ground-scuff',
    // A footfall is a compact ground wake, not a miniature impact burst.
    // Many small alpha puffs stay rounded and dissipate; erosion belongs
    // to the separate hard grit layer, not this soft suspended dust (R18).
    tuning: { turbulenceScale: 0, motion: 'ground-scuff', sprite: 'puff', blend: 'alpha', window: 0.46, countScale: 1.15, speedScale: 1.2, drag: 2.1, gravity: -0.55, spawnScale: 0.55, size: [0.48, 0.7, 0.3], ramp: 'held' },
  },
  // Physics lint: grit is ballistic — no wobble, tumble capped.
  { kind: 'particles', role: 'impact', opacity: 0.55, scale: 0.6, phase: 'ground-grit', tuning: { motion: 'ground-scuff', sprite: 'debris', blend: 'alpha', window: 0.32, countScale: 0.35, speedScale: 2.0, drag: 1.4, gravity: -2.5, spawnScale: 0.55, size: [0.14, 0.2, 0.08], ramp: 'dark', spinScale: 1.1, turbulenceScale: 0 } },
], 2, 1.0)
