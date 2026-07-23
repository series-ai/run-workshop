import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-impact', "Beam impact", "Beam contact with focused lance and base lock.", [
  { kind: 'beam-column', role: 'body', opacity: 0.48, scale: 0.68, phase: 'beam-impact-focused-lance', tuning: { meshMotion: 'flash' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'beam-impact-base-lock', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'body', opacity: 0.4, scale: 0.5, phase: 'beam-impact-rising-pixels', tuning: { countScale: 0.34, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 1.2 } },
], 2, 2.0)
