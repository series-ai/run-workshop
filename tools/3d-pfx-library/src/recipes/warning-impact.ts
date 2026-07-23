import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-impact', "Warning impact", "Alert contact flash with warning ring and urgency ticks.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'warning-impact-alert-flash', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.45, scale: 0.55, phase: 'warning-impact-danger-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.42, scale: 0.5, phase: 'warning-impact-urgency-ticks', tuning: { countScale: 0.23, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', flicker: 1.2, gravity: 0 } },
], 2, 2.2)
