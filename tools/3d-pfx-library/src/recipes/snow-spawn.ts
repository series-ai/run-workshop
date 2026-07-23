import { authoredRecipe } from '../constants/01'

// Mirror of spawn-marker (frost element): pad ring at the GROUND, conceal
// flash at build peak, snow settles instead of dust.
export default authoredRecipe('snow-spawn', 'Snow spawn', 'A sixfold frost cradle anticipates a compact whiteout before lofted ice crystals settle through the reveal.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.82, scale: 1.05, phase: 'snow-spawn-sixfold-frost-cradle', tuning: { meshGeometry: 'snow-spawn-frost-cradle', meshMotion: 'pulse', lifecycle: 'snow-spawn-transition', ringPurpose: 'glyph', blend: 'additive', colorOverride: '#8de8ff', delay: 0, window: 0.46 } },
  { kind: 'particles', role: 'volume', opacity: 0.68, scale: 1.42, phase: 'snow-spawn-compact-whiteout', tuning: { motion: 'drift-cloud', sprite: 'smoke', blend: 'alpha', colorOverride: '#c8efff', ramp: 'pigment', death: 'erode', delay: 0.08, window: 0.46, lifeScale: 0.78, countScale: 0.92, speedScale: 0.72, speedJitter: 0.38, drag: 1.35, gravity: -0.08, spawnScale: 0.68, depthScale: 3.2, spinScale: 0.12, turbulenceScale: 0.18, size: [0.38, 0.92, 0.24], positionOffset: [0, 0.3, 0] } },
  { kind: 'particles', role: 'impact', opacity: 0.9, scale: 1.08, phase: 'snow-spawn-settling-crystals', tuning: { motion: 'cone-fountain', sprite: 'sparkle', blend: 'alpha', colorOverride: '#f4fdff', ramp: 'held', delay: 0.16, window: 0.5, lifeScale: 1.08, countScale: 0.92, speedScale: 1.55, speedJitter: 0.48, drag: 0.72, gravity: -1.45, spawnScale: 0.46, spawnLift: 0.04, depthScale: 2.8, spinScale: 0, turbulenceScale: 0.08, impactVector: [0, 1, 0], spreadAngle: 0.82, size: [0.08, 0.4, 0.14], positionOffset: [0, -0.32, 0] } },
], 2, 1.08)
