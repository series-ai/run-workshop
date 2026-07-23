import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-ambient', 'Plasma ambient', 'A faceted plasma nucleus breathes inside three broken containment axes while sparse ion motes circulate through depth.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.94, scale: 0.58, phase: 'plasma-ambient-faceted-nucleus', tuning: { meshGeometry: 'plasma-ambient-contained-core', meshMotion: 'glow', lifecycle: 'plasma-ambient-breathing-loop', blend: 'alpha', colorOverride: '#86ecff', flicker: 0.28 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.78, scale: 0.92, phase: 'plasma-ambient-broken-containment-orbits', tuning: { meshGeometry: 'plasma-ambient-broken-orbits', meshMotion: 'pulse', lifecycle: 'plasma-ambient-breathing-loop', ringPurpose: 'glyph', blend: 'additive', colorOverride: '#18a8ff', flicker: 0.18 } },
  { kind: 'particles', role: 'aura', opacity: 0.72, scale: 0.88, phase: 'plasma-ambient-depth-motes', tuning: { motion: 'orbit-ring', sprite: 'spark', blend: 'additive', colorOverride: '#bff8ff', ramp: 'held', countScale: 0.62, speedScale: 0.42, speedJitter: 0.34, spinScale: 0, turbulenceScale: 0.08, gravity: 0, depthScale: 3.4, lifeScale: 1.18, size: [0.1, 0.42, 0.16], flicker: 0.32 } },
], 2, 0.72)
