import { authoredRecipe } from '../constants/01'

export default authoredRecipe('debris-miss', 'Debris miss', 'Ballistic skip chunks preserve the miss vector while a grounded scuff tail settles behind them.', [
  { kind: 'impact-shards', role: 'impact', opacity: 0.94, scale: 0.9, phase: 'debris-miss-ballistic-skip-chunks', tuning: { meshGeometry: 'debris-miss-rock-fragments', meshMotion: 'flash', lifecycle: 'impact-shard-burst', blend: 'alpha', colorOverride: '#b7834d', delay: 0, window: 0.5, startScale: 0.3, positionOffset: [-0.08, -0.74, 0.05] } },
  { kind: 'particles', role: 'volume', opacity: 0.84, scale: 1.86, phase: 'debris-miss-ground-scuff-tail', tuning: { motion: 'impact-burst', sprite: 'smoke', blend: 'alpha', colorOverride: '#c3a170', ramp: 'pigment', death: 'erode', delay: 0.004, window: 0.62, lifeScale: 1.12, countScale: 1.8, speedScale: 4, speedJitter: 0.35, drag: 0.62, spawnScale: 0.4, spawnLift: 0.02, depthScale: 3.2, gravity: -0.3, stretch: 0.2, spinScale: 0.18, turbulenceScale: 0.16, impactVector: [-1, 0.12, -0.24], spreadAngle: 0.48, size: [0.42, 1.08, 0.34], positionOffset: [0, 0.02, 0] } },
], 2, 1.35)
