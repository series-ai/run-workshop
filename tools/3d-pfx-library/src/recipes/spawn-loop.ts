import { authoredRecipe } from '../constants/01'

// Production standard §1/§4: the arrival column is the focal read (spawn =
// something materializes HERE), anchored by the origin ring with helix
// motes winding in to materialize.
export default authoredRecipe('spawn-loop', 'Spawn loop', 'Active spawn marker with materialization motes and arrival column.', [
  { kind: 'beam-column', role: 'volume', opacity: 0.6, scale: 0.75, phase: 'spawn-loop-arrival-column', tuning: { meshShader: 'energy-column', meshMotion: 'pulse', widthScale: 0.45, blend: 'additive', colorOverride: '#0077ff', positionOffset: [0, 0.58, 0] } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'spawn-loop-materialize-motes', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.32, 0.44, 0.24], colorOverride: '#66aaff', ramp: 'held', countScale: 0.34, speedScale: 0.5, speedJitter: 0.2, turbulenceScale: 0.05, motion: 'helix-trail', gravity: 0, spinScale: 0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.75, scale: 0.72, phase: 'spawn-loop-origin-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'boundary', blend: 'additive', colorOverride: '#0077ff' } },
], 2, 0.8)
