import { authoredRecipe } from '../constants/01'

export default authoredRecipe('mud-impact', "Mud impact", "Heavy ground contact with wet splat and chunk droplets.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.5, phase: 'mud-impact-heavy-splat', tuning: { meshMotion: 'bloom', blend: 'alpha', sprite: 'splat', ramp: 'pigment', colorOverride: '#6e451f', spinScale: 0.5, countScale: 0.3, gravity: -3, death: 'erode' } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'mud-impact-chunk-drops', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', ramp: 'held', gravity: -4, spinScale: 1.0, colorOverride: '#a05a24' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.55, scale: 0.55, phase: 'mud-impact-wet-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#8a4c1f' } },
], 2, 1.5)
