import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-charge', 'Laser charge', 'Laser windup with hard-light line and ricochet shimmer.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'laser-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffc8b2' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'laser-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#ff4d2f', ramp: 'held', spawnScale: 2.2, countScale: 0.4, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.2 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'laser-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#ff3d1f', flicker: 1.2 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'laser-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffc8b2', turbulenceScale: 0, gravity: 0 } },
], 2, 1.3)
