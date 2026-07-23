import { authoredRecipe } from '../constants/01'

export default authoredRecipe('snow-impact', "Snow impact", "Soft snow contact with powder bloom and crystalline flecks.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.54, phase: 'snow-impact-powder-bloom', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#b8cede' } },
  { kind: 'particles', role: 'volume', opacity: 0.7, scale: 0.55, phase: 'snow-impact-ice-flecks', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', blend: 'alpha', gravity: -0.6, spinScale: 0.8, colorOverride: '#ffffff', ramp: 'held' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.55, scale: 0.55, phase: 'snow-impact-soft-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#cfe8ff' } },
], 2, 1.4)
