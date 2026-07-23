import { authoredRecipe } from '../constants/01'

export default authoredRecipe('embers-impact', "Embers impact", "Compact ember impact with cinder pop and heat wake.", [
  { kind: 'particles', role: 'impact', opacity: 0.66, scale: 0.54, phase: 'embers-impact-cinder-pop', tuning: { window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'glow', flicker: 1.8, gravity: -0.8, spawnLift: 0.15, delay: 0.12 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'embers-impact-heat-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: 0.34, phase: 'embers-impact-heat-haze', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
], 2, 2.0)
