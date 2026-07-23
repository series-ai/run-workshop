import { authoredRecipe } from '../constants/01'

export default authoredRecipe('flame-idle', 'Flame idle', 'Breathing flame core with ember points and soft heat wake.', [
  { kind: 'particles', role: 'body', opacity: 1, scale: 0.5, phase: 'flame-idle-core-licks', tuning: { motion: 'column-rise', sprite: 'lick', size: [1.15, 0.9, 0.25], colorOverride: '#ff9d00', ramp: 'held', countScale: 0.6, speedScale: 0, speedJitter: 0.35, spinScale: 0, spawnScale: 0.32, turbulenceScale: 0.15, gravity: 0.18, flicker: 1.7 } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.55, phase: 'flame-idle-rising-licks', tuning: { motion: 'column-rise', sprite: 'lick', size: [0.95, 0.75, 0.2], colorOverride: '#ff3d00', ramp: 'held', countScale: 0.35, speedScale: 0, speedJitter: 0.45, spinScale: 0, spawnScale: 0.42, turbulenceScale: 0.2, gravity: 0.15, flicker: 1.5 } },
], 2, 0.85)
