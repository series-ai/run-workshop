import { authoredRecipe } from '../constants/01'

// Reference (docs/reference-recipes.md Teleport): ground anchor disc +
// vertical bright-center beam + helix gather motes; entry mirrors exit on
// one shared clock.
export default authoredRecipe('teleport-loop', 'Teleport loop', 'Arrival/departure loop with afterimage slice and stable anchor ring.', [
  { kind: 'magic-circle', role: 'aura', opacity: 0.85, scale: 0.8, phase: 'teleport-loop-anchor-ring', tuning: { meshMotion: 'pulse', blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, -0.7, 0] } },
  { kind: 'beam-column', role: 'volume', opacity: 0.5, scale: 0.7, phase: 'teleport-loop-arrival-beam', tuning: { meshShader: 'energy-column', meshMotion: 'pulse', widthScale: 0.3, blend: 'additive', colorOverride: '#3399ff', positionOffset: [0, 0.4, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'teleport-loop-shimmer-pips', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.32, 0.44, 0.24], colorOverride: '#66aaff', ramp: 'held', countScale: 0.34, speedScale: 0.55, speedJitter: 0.15, turbulenceScale: 0, motion: 'helix-trail', gravity: 0, spinScale: 0 } },
], 2, 0.8)
