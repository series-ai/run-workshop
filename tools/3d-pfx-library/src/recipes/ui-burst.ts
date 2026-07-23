import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ui-burst', "UI burst", "Generic UI confirmation burst with low-overdraw screen particles.", [
  { kind: 'screen-plane', role: 'screen', opacity: 0.6, scale: 0.34, phase: 'ui-burst-confirm-plane', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'screen', opacity: 0.56, scale: 0.48, phase: 'ui-burst-interface-particles', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0, spinScale: 1.2 } },
], 2, 1.35)
