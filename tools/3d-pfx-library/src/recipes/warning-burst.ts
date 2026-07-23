import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-burst', "Warning burst", "Urgent warning burst with a clear alert ring and tick particles.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.62, scale: 0.72, phase: 'warning-burst-alert-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.48, scale: 0.46, phase: 'warning-burst-tick-points', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: 0, flicker: 1.2 } },
  { kind: 'screen-plane', role: 'screen', opacity: 0.55, scale: 0.3, phase: 'warning-burst-soft-flash', tuning: { meshMotion: 'flash' } },
], 2, 1.1)
