import { authoredRecipe } from '../constants/01'

export default authoredRecipe('marker-charge', 'Marker charge', 'Marker windup with anchor load and placement pips.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'marker-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#dff2ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'marker-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#2f9df5', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'marker-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#dff2ff', turbulenceScale: 0, gravity: 0 } },
], 2, 2.0)
