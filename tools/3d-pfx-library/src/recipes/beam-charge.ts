import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-charge', 'Beam charge', 'Beam windup with lance forming and base lock.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'beam-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffffff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'beam-charge-gather-inflow', tuning: { motion: 'column-rise', sprite: 'sparkle', colorOverride: '#4da6ff', ramp: 'held', spawnScale: 2.2, countScale: 0.4, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'beam-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#7fc4ff' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'beam-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffffff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.1)
