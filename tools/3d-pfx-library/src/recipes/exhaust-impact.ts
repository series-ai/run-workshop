import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-impact', "Exhaust impact", "Soft exhaust contact with soot puff and heat ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.55, scale: 0.48, phase: 'exhaust-impact-soot-puff', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#8a8a8a' } },
  { kind: 'particles', role: 'volume', opacity: 0.8, scale: 0.55, phase: 'exhaust-impact-carbon-specks', tuning: { countScale: 0.35, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0.4, sprite: 'debris', blend: 'alpha', ramp: 'held', gravity: 0.5, colorOverride: '#c8c8c8' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'exhaust-impact-heat-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#c86a3a' } },
], 2, 1.8)
