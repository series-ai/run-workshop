import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dust-impact', "Dust impact", "Grounded dust impact with cloud body and grain breakup.", [
  { kind: 'particles', role: 'volume', opacity: 0.6, scale: 0.62, phase: 'dust-impact-ground-cloud', tuning: { sprite: 'puff', blend: 'alpha', colorOverride: '#c4a878', window: 0.18, countScale: 0.31, speedScale: 0.9, gravity: 0.25, drag: 1.8, size: [0.7, 1.15, 1.4], spinScale: 0.6, lifeScale: 0.8, ramp: 'held', death: 'erode', turbulenceScale: 0.5 } },
  { kind: 'particles', role: 'volume', opacity: 0.4, scale: 0.5, phase: 'dust-impact-grain-breakup', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.6, blend: 'alpha', ramp: 'held', death: 'erode', countScale: 0.3, speedScale: 1.6, turbulenceScale: 0, sprite: 'debris', colorOverride: '#a8895c', gravity: -2.6, spinScale: 1.0, motion: 'ground-scuff', drag: 0.9, size: [0.4, 0.5, 0.18], ease: 'snap' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'dust-impact-origin-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.6)
