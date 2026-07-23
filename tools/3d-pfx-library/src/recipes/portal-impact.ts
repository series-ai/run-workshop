import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-impact', "Portal impact", "Portal contact flash with vortex ring and arrival sparks.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.8, scale: 0.58, phase: 'portal-impact-vortex-flash', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#8a5cf0' } },
  { kind: 'particles', role: 'aura', opacity: 0.95, scale: 0.6, phase: 'portal-impact-arrival-sparks', tuning: { countScale: 0.5, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'magic', gravity: 0, colorOverride: '#c9a8ff', ramp: 'held', speedScale: 0.3, size: [0.45, 0.6, 0.35] } },
  { kind: 'particles', role: 'trail', opacity: 0.7, scale: 0.55, phase: 'portal-impact-spiral-wake', tuning: { sprite: 'magic', delay: 0.26, window: 0.28, lifeScale: 0.85, countScale: 0.3, speedScale: 0.5, gravity: 0, spinScale: 1.0, turbulenceScale: 0.4, colorOverride: '#9d6bff', ramp: 'held' } },
], 2, 1.9)
