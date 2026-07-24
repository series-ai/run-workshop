import { authoredRecipe } from '../constants/01'

// Production standard §5: HUD confirmation is screen-space — restrained
// flash band, crisp confirm ring, and rising interface pips in value order.
export default authoredRecipe('ui-loop', 'UI loop', 'Generic UI confirmation loop with restrained screen flash and interface particles.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.35, scale: 0.6, phase: 'ui-loop-restrained-flash', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'ui-loop-confirm-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'screen', opacity: 0.8, scale: 0.52, phase: 'ui-loop-interface-pips', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.26, 0.36, 0.2], colorOverride: '#9cc8ff', ramp: 'held', countScale: 0.32, speedScale: 0.45, speedJitter: 0.1, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.8)
