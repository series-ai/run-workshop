import { authoredRecipe } from '../constants/01'

// Ice/crystal despawn: kill flash, tumbling crystal shards FALL (matter),
// ground crack wave. Twirl tumble kept — shards are physical.
export default authoredRecipe('shard-break', 'Shard break', 'Crystal despawn: faceted ignition seed, cut fragments, and cooling chips.', [
  { kind: 'impact-shards', role: 'impact', opacity: 0.98, scale: 1.28, phase: 'shard-break-crystal-fracture', tuning: { meshGeometry: 'shard-break-crystal-fragments', meshMotion: 'flash', lifecycle: 'shard-break-fracture', blend: 'alpha', colorOverride: '#bfe8ff', positionOffset: [0, -0.64, 0] } },
  { kind: 'impact-shards', role: 'impact', opacity: 0.96, scale: 0.78, phase: 'shard-break-ignition-core', tuning: { meshGeometry: 'shard-break-ignition-core', meshMotion: 'flash', lifecycle: 'shard-break-fracture', blend: 'alpha', colorOverride: '#ecfdff', positionOffset: [0, -0.54, 0] } },
  { kind: 'particles', role: 'trail', opacity: 0.94, scale: 0.78, phase: 'shard-break-cooling-chips', tuning: { motion: 'radial-burst', sprite: 'debris', blend: 'additive', colorOverride: '#e3fbff', ramp: 'pinned-hot', death: 'erode', ease: 'snap', delay: 0, window: 0.12, lifeScale: 0.88, countScale: 0.55, speedScale: 4.8, speedJitter: 0.4, drag: 0.72, gravity: -3.8, spawnScale: 0.05, depthScale: 3.8, turbulenceScale: 0.02, spinScale: 1.2, stretch: 0.12, impactVector: [0.22, 0.88, 0.18], spreadAngle: 1.05, size: [0.14, 0.24, 0.09], positionOffset: [0, -0.54, 0] } },
], 2, 1.4)
