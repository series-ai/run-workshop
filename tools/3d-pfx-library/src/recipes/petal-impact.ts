import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-impact', "Petal impact", "Delicate petal contact with blossom scatter and soft puff.", [
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'petal-impact-blossom-scatter', tuning: { countScale: 0.3, window: 0.5, lifeScale: 1.0, turbulenceScale: 0.6, sprite: 'debris', blend: 'alpha', gravity: -0.6, spinScale: 1.2, colorOverride: '#ff9ec7', ramp: 'held' } },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.34, phase: 'petal-impact-soft-puff', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#c98ba8' } },
], 2, 1.4)
