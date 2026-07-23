import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-charge', 'Plasma charge', 'Plasma windup with ion gather and magnetic orbit.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'plasma-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#b2dfff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'plasma-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'glow', colorOverride: '#2f8fe8', ramp: 'held', spawnScale: 2.2, countScale: 0.4, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.4 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.42, phase: 'plasma-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#3f9dff', flicker: 1.4 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'plasma-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#b2dfff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.1)
