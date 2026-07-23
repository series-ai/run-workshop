import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-hit', 'Exhaust hit', 'Axial engine backfire: compressed hot jet, cool pressure wake, and smoky thermal handoff.', [
  { kind: 'muzzle-cone', role: 'impact', opacity: 1, scale: 0.82, phase: 'exhaust-hit-compressed-plasma-jet', tuning: { meshMotion: 'flash', lifecycle: 'impact-shard-burst', delay: 0, window: 0.4, startScale: 0.36, colorOverride: '#e9fbff', positionOffset: [-0.05, 0.12, 0] } },
  { kind: 'impact-core', role: 'body', opacity: 0.94, scale: 0.74, phase: 'exhaust-hit-mechanical-nozzle', tuning: { meshGeometry: 'exhaust-hit-mechanical-nozzle', meshMotion: 'flash', lifecycle: 'impact-afterglow', delay: 0, window: 0.64, startScale: 0.72, colorOverride: '#76cfff', positionOffset: [-0.2, 0.12, 0] } },
  { kind: 'particles', role: 'volume', opacity: 0.56, scale: 0.9, phase: 'exhaust-hit-smoke-handoff', tuning: { motion: 'impact-burst', sprite: 'smoke', blend: 'alpha', colorOverride: '#687580', ramp: 'dark', death: 'erode', delay: 0.045, window: 0.42, lifeScale: 0.74, countScale: 0.52, speedScale: 2.4, speedJitter: 0.32, drag: 1.5, spawnScale: 0.16, depthScale: 2.8, gravity: 0.06, stretch: 1.1, spinScale: 0.08, turbulenceScale: 0.08, impactVector: [1, 0.1, 0.08], spreadAngle: 0.36, size: [0.12, 0.25, 0.08], positionOffset: [0.04, 0.08, 0] } },
], 2, 1.45)
