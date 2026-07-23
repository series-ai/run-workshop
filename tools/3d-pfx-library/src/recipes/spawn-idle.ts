import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-idle', 'Spawn idle', 'Spawn point idle with ready mote field and origin glow.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'spawn-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0077ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'spawn-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0077ff' } },
], 2, 0.68)
