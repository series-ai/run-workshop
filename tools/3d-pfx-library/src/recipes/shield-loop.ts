import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-loop', 'Shield loop', 'Defensive loop with readable shell boundary and latitude energy.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'shield-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#2f8fe8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'shield-loop-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#2f8fe8', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'shield-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#2f8fe8' } },
], 2, 0.8)
