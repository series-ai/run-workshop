import { authoredRecipe } from '../constants/01'

export default authoredRecipe('holy-loop', 'Holy loop', 'Sustained restoration field with clean orbiting motes and a gentle column.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'holy-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ffc300' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'holy-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#ffc300', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'holy-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ffc300' } },
], 2, 0.6)
