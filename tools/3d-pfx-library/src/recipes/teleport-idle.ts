import { authoredRecipe } from '../constants/01'

// Reference (docs/reference-recipes.md Teleport): gather motes ride a helix
// inward+up over a ground anchor; the anchor breathes while the hum holds.
export default authoredRecipe('teleport-idle', 'Teleport idle', 'Teleport arrival hum with anchor ring and shimmer pips.', [
  { kind: 'magic-circle', role: 'aura', opacity: 0.8, scale: 0.75, phase: 'teleport-idle-anchor-ring', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.6, phase: 'teleport-idle-shimmer-pips', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.3, 0.42, 0.22], colorOverride: '#66aaff', ramp: 'held', countScale: 0.28, speedScale: 0.5, speedJitter: 0.15, turbulenceScale: 0, motion: 'helix-trail', gravity: 0, spinScale: 0 } },
], 2, 0.68)
