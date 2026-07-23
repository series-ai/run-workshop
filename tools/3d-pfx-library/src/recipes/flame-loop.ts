import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-loop', 'Flame loop', 'Sustained torch flame with layered body, tail shimmer, and ember breakup.', [
  { kind: 'particles', role: 'body', opacity: 1, scale: 0.62, phase: 'flame-loop-core-licks', tuning: { motion: 'column-rise', sprite: 'lick', size: [1.35, 1.0, 0.3], colorOverride: '#ff9d00', ramp: 'held', countScale: 0.85, speedScale: 0, speedJitter: 0.35, spinScale: 0, spawnScale: 0.35, turbulenceScale: 0.15, gravity: 0.2, flicker: 1.8 } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.7, phase: 'flame-loop-rising-licks', tuning: { motion: 'column-rise', sprite: 'lick', size: [1.15, 0.9, 0.25], colorOverride: '#ff3d00', ramp: 'held', countScale: 0.6, speedScale: 0, speedJitter: 0.45, spinScale: 0, spawnScale: 0.45, turbulenceScale: 0.2, gravity: 0.18, flicker: 1.6 } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.45, phase: 'flame-loop-rising-embers', tuning: { motion: 'column-rise', sprite: 'glow', size: [0.3, 0.4, 0.25], colorOverride: '#ff8a2f', ramp: 'held', countScale: 0.2, speedScale: 1.2, speedJitter: 0.5, spinScale: 0, turbulenceScale: 0.4, gravity: 0.6, flicker: 1.8 } },
], 2, 0.95)
