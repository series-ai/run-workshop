import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-charge', 'Reflect charge', 'Reflect windup with mirror load and return glints.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'reflect-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#ffffff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'reflect-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#dff2ff', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 1.1, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'reflect-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#ffffff', turbulenceScale: 0, gravity: 0 } },
], 2, 2.2)
