import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-charge', 'Teleport charge', 'Teleport windup with anchor lock and shimmer breath.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'teleport-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffffff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'teleport-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#4da6ff', ramp: 'held', spawnScale: 2.2, countScale: 0.3, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'teleport-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#7fc4ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'teleport-charge-anchor-ring', tuning: { meshMotion: 'charge', ringPurpose: 'boundary', colorOverride: '#3f9dff' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'teleport-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', countScale: 0.6, delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffffff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.2)
