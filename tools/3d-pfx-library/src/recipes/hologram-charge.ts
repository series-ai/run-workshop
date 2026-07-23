import { authoredRecipe } from '../constants/01'

export default authoredRecipe('hologram-charge', 'Hologram charge', 'Hologram windup with projection load and voxel shimmer.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.38, phase: 'hologram-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#b8f1ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'hologram-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'sparkle', colorOverride: '#3fd8f0', ramp: 'held', spawnScale: 2.2, countScale: 0.5, speedScale: 0.9, speedJitter: 0.5, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 1.2 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'hologram-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#b8f1ff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.5)
