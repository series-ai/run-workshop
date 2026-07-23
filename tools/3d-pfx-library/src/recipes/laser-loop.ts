import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-loop', 'Laser loop', 'Clean sci-fi sustained laser line with small contact flicker.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'laser-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ff2600' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'laser-loop-element-traffic', tuning: { sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#ff2600', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'laser-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff2600', flicker: 1.4 } },
], 2, 0.95)
