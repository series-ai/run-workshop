import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-burst', "Scan burst", "Tactical scan pulse with data points and a directional sweep.", [
  { kind: 'particles', role: 'trail', opacity: 0.7, scale: 0.6, phase: 'scan-burst-data-sweep', tuning: { sprite: 'streak', stretch: 1.5, colorOverride: '#7fe3d2', ramp: 'held', window: 0.25, lifeScale: 0.4, countScale: 0.18, speedScale: 1.5, drag: 2.2, gravity: 0, spinScale: 0, turbulenceScale: 0, impactVector: [1, 0.2, 0], spreadAngle: 0.35, size: [0.8, 0.6, 0.15] } },
  { kind: 'ring-field', role: 'aura', opacity: 0.38, scale: 0.62, phase: 'scan-burst-origin-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.42, scale: 0.44, phase: 'scan-burst-data-points', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0, flicker: 0.8 } },
], 2, 1.2)
