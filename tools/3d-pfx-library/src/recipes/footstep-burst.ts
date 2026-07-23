import { authoredRecipe } from '../constants/01'

export default authoredRecipe('footstep-burst', "Footstep burst", "Tiny repeatable footfall burst for traversal readability.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.42, phase: 'footstep-burst-heel-puff', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'volume', opacity: 0.42, scale: 0.4, phase: 'footstep-burst-grit-specks', tuning: { delay: 0, window: 0.14, lifeScale: 0.4, ease: 'snap', turbulenceScale: 0, sprite: 'debris', blend: 'alpha', gravity: -2.8, ramp: 'dark' } },
], 2, 1.2)
