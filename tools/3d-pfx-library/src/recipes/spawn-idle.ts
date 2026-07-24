import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-idle', 'Spawn idle', 'Spawn point idle with ready mote field and origin glow.', [
  { kind: 'particles', role: 'aura', opacity: 0.75, scale: 0.6, phase: 'spawn-idle-ready-motes', tuning: { sprite: 'glow', blend: 'additive', size: [0.24, 0.34, 0.2], colorOverride: '#0077ff', ramp: 'held', countScale: 0.24, speedScale: 0.35, speedJitter: 0.2, turbulenceScale: 0.1, motion: 'ground-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.36, phase: 'spawn-idle-origin-glow', tuning: { meshMotion: 'breathe', blend: 'additive', colorOverride: '#4d9fff' } },
], 2, 0.68)
