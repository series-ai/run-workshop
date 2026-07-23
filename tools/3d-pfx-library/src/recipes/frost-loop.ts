import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-loop', 'Frost loop', 'Soft frost aura for chill zones and environmental hazards.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'frost-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#00aaff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'frost-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00aaff', ramp: 'held', countScale: 0.45, speedScale: 0.15, speedJitter: 0.15, turbulenceScale: 0, motion: 'drift-cloud', gravity: 0.1, spinScale: 0, flicker: 0.3 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'frost-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00aaff' } },
], 2, 0.45)
