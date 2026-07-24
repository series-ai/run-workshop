import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ui-loop', 'UI loop', 'Generic UI confirmation loop with restrained screen flash and interface particles.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.3, scale: 0.55, phase: 'ui-loop-restrained-flash', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.8, scale: 0.72, phase: 'ui-loop-confirm-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'screen', opacity: 0.75, scale: 0.5, phase: 'ui-loop-interface-pips', tuning: { sprite: 'sparkle', blend: 'additive', size: [0.22, 0.32, 0.18], colorOverride: '#9cc8ff', ramp: 'held', countScale: 0.28, speedScale: 0.45, speedJitter: 0.1, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.8)
