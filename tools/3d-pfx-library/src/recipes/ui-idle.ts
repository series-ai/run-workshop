import { authoredRecipe } from '../constants/01'

// Production standard §5 (screen-space UI): depth comes from overlapping
// opacity bands, not world parallax — a soft screen shimmer band under
// crisp rising twinkle pips.
export default authoredRecipe('ui-idle', 'UI idle', 'Interface idle shimmer with small HUD points.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.35, scale: 0.55, phase: 'ui-idle-hud-shimmer', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'screen', opacity: 0.8, scale: 0.52, phase: 'ui-idle-interface-pips', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.26, 0.36, 0.2], colorOverride: '#9cc8ff', ramp: 'held', countScale: 0.26, speedScale: 0.45, speedJitter: 0.1, turbulenceScale: 0, motion: 'column-rise', gravity: 0, spinScale: 0 } },
], 2, 0.68)
