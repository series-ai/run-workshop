import { authoredRecipe } from '../constants/01'

export default authoredRecipe('electric-impact', "Electric impact", "Electric contact with arc ticks and voltage ring.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.68, scale: 0.5, phase: 'electric-impact-arc-ticks', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'arc', stretch: 1.4, gravity: 0, colorOverride: '#3f9dff' } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'electric-impact-voltage-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#3f9dff' } },
  { kind: 'particles', role: 'aura', opacity: 0.42, scale: 0.5, phase: 'electric-impact-charged-points', tuning: { countScale: 0.3, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', flicker: 1.6, gravity: 0, colorOverride: '#3f9dff' } },
], 2, 2.0)
