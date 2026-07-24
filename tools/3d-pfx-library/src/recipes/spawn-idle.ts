import { authoredRecipe } from '../constants/01'

// Production standard §4: origin glow is the focal read, the ground mote
// field supports it — ready state stays calm, bright, and stationary.
export default authoredRecipe('spawn-idle', 'Spawn idle', 'Spawn point idle with ready mote field and origin glow.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.4, phase: 'spawn-idle-origin-glow', tuning: { meshMotion: 'breathe', blend: 'additive', colorOverride: '#4d9fff' } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.62, phase: 'spawn-idle-ready-motes', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.3, 0.4, 0.22], colorOverride: '#0077ff', ramp: 'held', countScale: 0.3, speedScale: 0.4, speedJitter: 0.2, turbulenceScale: 0.1, motion: 'ground-ring', gravity: 0, spinScale: 0 } },
], 2, 0.68)
