import { authoredRecipe } from '../constants/01'

export default authoredRecipe('acid-release', 'Acid release', 'Acid release with corrosive spit and vapor wisp.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.42, phase: 'acid-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#d8ffc8' } },
  { kind: 'particles', role: 'impact', opacity: 0.95, scale: 0.65, phase: 'acid-release-launch-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'splat', size: [0.55, 0.75, 0.4], colorOverride: '#00e800', ramp: 'pigment', speedScale: 2.2, speedJitter: 0.65, window: 0.05, lifeScale: 0.4, ease: 'snap', countScale: 0.85, turbulenceScale: 0, gravity: -2, impactVector: [1, 0.3, 0.55], spreadAngle: 0.35, spinScale: 0.85 } },
  { kind: 'particles', role: 'aura', opacity: 0.7, scale: 0.5, phase: 'acid-release-anchor-residue', tuning: { sprite: 'glow', blend: 'alpha', ramp: 'dark', delay: 0.32, window: 0.55, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, countScale: 0.35, turbulenceScale: 0.3, colorOverride: '#00e800' } },
], 2, 1.9)
