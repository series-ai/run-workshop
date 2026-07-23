import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dust-charge', 'Dust charge', 'Dust windup with ground lift and grain concentration.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'dust-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#fbe2b2' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'dust-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'debris', size: [0.5, 0.6, 0.25], colorOverride: '#b58743', ramp: 'held', spawnScale: 2.2, countScale: 0.38, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'dust-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#d4a961' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'dust-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#fbe2b2', turbulenceScale: 0, gravity: 0 } },
], 2, 1.1)
