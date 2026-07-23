import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-release', 'Shard release', 'Shard release with fragment glints and splinter spray.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'shard-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#ffffff' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'shard-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'twirl', size: [0.45, 0.6, 0.35], colorOverride: '#5ab8f0', ramp: 'held', speedScale: 2.2, speedJitter: 0.4, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -2, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 1.0, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'shard-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.26, window: 0.5, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#6a7a90' } },
], 2, 2.0)
