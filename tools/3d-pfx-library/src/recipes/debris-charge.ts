import { authoredRecipe } from '../constants/01'

export default authoredRecipe('debris-charge', 'Debris charge', 'Debris windup with chips gathering and dust body.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'debris-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#e8e0d0' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'debris-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'debris', size: [0.5, 0.6, 0.25], colorOverride: '#a68e67', ramp: 'held', spawnScale: 2.2, countScale: 0.38, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, blend: 'alpha' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'debris-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#c7af7e' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'debris-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#e8e0d0', turbulenceScale: 0, gravity: 0 } },
], 2, 1.1)
