import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-charge', 'Warp charge', 'Warp windup with tightening lens and displaced motes.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'warp-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#dff2ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'warp-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#2f8fe8', ramp: 'held', spawnScale: 2.2, countScale: 0.3, speedScale: 1.1, speedJitter: 0.3, turbulenceScale: 0, gravity: 0, spinScale: 1.2 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'warp-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#4da6ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'warp-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#2f8fe8' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'warp-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', countScale: 0.6, delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#dff2ff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.2)
