import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-burst', "Portal burst", "Short portal opening burst with an obvious vortex rim.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.68, scale: 0.78, phase: 'portal-burst-vortex-rim', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'core-sphere', role: 'screen', opacity: 0.55, scale: 0.4, phase: 'portal-burst-inner-window', tuning: { meshMotion: 'glow', colorOverride: '#9d6bff' } },
  { kind: 'particles', role: 'aura', opacity: 0.52, scale: 0.56, phase: 'portal-burst-inward-motes', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'magic', gravity: 0, countScale: 0.88 } },
], 2, 1.1)
