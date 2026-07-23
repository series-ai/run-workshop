import { authoredRecipe } from '../constants/01'

export default authoredRecipe('footstep-impact', "Footstep impact", "Tiny footfall contact with ground puff and lightweight grit.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.55, scale: 0.34, phase: 'footstep-impact-ground-puff', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#a8977a' } },
  { kind: 'particles', role: 'volume', opacity: 0.85, scale: 0.55, phase: 'footstep-impact-grit-ticks', tuning: { countScale: 0.4, delay: 0, window: 0.14, lifeScale: 0.4, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', gravity: -2.6, motion: 'ground-scuff', colorOverride: '#d8c8a8', ramp: 'held' } },
], 2, 3.0)
