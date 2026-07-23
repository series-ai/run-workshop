import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-charge', 'Portal charge', 'Build-up warning for an opening portal or warp action.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.92, scale: 0.92, phase: 'portal-charge-aperture-face', tuning: { meshShader: 'vortex-swirl', meshMotion: 'charge', lifecycle: 'portal-charge-aperture', colorOverride: '#6f22d9' } },
  { kind: 'portal-throat', role: 'volume', opacity: 0.78, scale: 0.92, phase: 'portal-charge-aperture-depth', tuning: { meshShader: 'portal-throat', meshMotion: 'charge', lifecycle: 'portal-charge-aperture', colorOverride: '#a06cff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.9, phase: 'portal-charge-gather-inflow', tuning: { motion: 'converge-center', sprite: 'magic', blend: 'additive', colorOverride: '#b985ff', ramp: 'held', spawnScale: 2.4, depthScale: 3, countScale: 0.55, speedScale: 1.25, speedJitter: 0.26, turbulenceScale: 0.08, gravity: 0, spinScale: 0, size: [0.16, 0.28, 0.12], delay: 0, window: 0.82, lifeScale: 0.52, death: 'erode' } },
], 2, 0.82)
