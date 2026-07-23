import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ghost-burst', "Ghost burst", "Spectral burst with wisps and a soft haunted contact ring.", [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.58, phase: 'ghost-burst-wisp-body', tuning: { meshMotion: 'bloom', blend: 'alpha' } },
  { kind: 'particles', role: 'volume', opacity: 0.5, scale: 0.54, phase: 'ghost-burst-echo-motes', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.9, ease: 'snap', turbulenceScale: 0.4, sprite: 'glow', gravity: 0.9, flicker: 1.0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.5, scale: 0.6, phase: 'ghost-burst-haunt-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 0.9)
