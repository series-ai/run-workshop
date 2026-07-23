import { authoredRecipe } from '../constants/01'

export default authoredRecipe('despawn-loop', 'Despawn loop', 'Clean disappearance loop with collapse haze and breakup points.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'despawn-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#5fb0e8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'despawn-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#5fb0e8', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.15, turbulenceScale: 0, motion: 'screen-fall', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'despawn-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5fb0e8' } },
], 2, 0.8)
