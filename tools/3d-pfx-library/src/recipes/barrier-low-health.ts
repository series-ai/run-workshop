import { authoredRecipe } from '../constants/01'

// Persistent shield distress: actual missing shell panels create an
// angle-dependent breach. Both secondary layers originate at that breach,
// so the failure reads as one causal event instead of a sphere, floor ring,
// and unrelated dots occupying the same scene.
export default authoredRecipe('barrier-low-health', 'Barrier low-health warning', 'A fractured crimson shield strains around its wearer while breach arcs and failing panel matter vent from one hot wound.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.8, scale: 1.02, phase: 'barrier-low-health-fractured-shell', tuning: { meshGeometry: 'barrier-low-health-fractured-shell', meshShader: 'barrier-failure-shell', meshMotion: 'pulse', lifecycle: 'barrier-low-health-failure-loop', blend: 'alpha', colorOverride: '#d52b3c', positionOffset: [0, -0.08, 0] } },
  { kind: 'impact-shards', role: 'impact', opacity: 0.94, scale: 0.9, phase: 'barrier-low-health-breach-energy-ribs', tuning: { meshGeometry: 'barrier-low-health-breach-ribs', meshMotion: 'pulse', lifecycle: 'barrier-low-health-failure-loop', blend: 'additive', colorOverride: '#fff1cf', positionOffset: [0.56, 0.13, 0.43] } },
  { kind: 'particles', role: 'volume', opacity: 0.84, scale: 0.76, phase: 'barrier-low-health-failing-panels', tuning: { motion: 'impact-burst', sprite: 'debris', blend: 'alpha', colorOverride: '#d3443f', ramp: 'pigment', death: 'erode', delay: 0.08, window: 0.38, countScale: 0.66, speedScale: 0.6, speedJitter: 0.3, drag: 1.6, gravity: -0.62, spawnScale: 0.2, depthScale: 3, stretch: 0.18, spinScale: 0.8, turbulenceScale: 0, lifeScale: 0.72, impactVector: [0.78, 0.18, 0.6], spreadAngle: 0.45, size: [0.12, 0.38, 0.14], positionOffset: [0.47, 0.08, 0.36] } },
], 2, 1.45)
