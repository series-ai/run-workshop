import { authoredRecipe } from '../constants/01'

export default authoredRecipe('jump-loop', 'Jump loop', 'Vertical movement loop with lift column and takeoff motes.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'jump-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#5ac8ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'jump-loop-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#5ac8ff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'jump-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5ac8ff' } },
], 2, 0.95)
