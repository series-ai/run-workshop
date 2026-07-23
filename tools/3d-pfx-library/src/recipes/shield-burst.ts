import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shield-burst', "Shield burst", "Defensive pulse with a visible shell flash and surface sparks.", [
  { kind: 'shield-shell', role: 'aura', opacity: 0.65, scale: 0.66, phase: 'shield-burst-shell-flash', tuning: { meshMotion: 'flash' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.5, scale: 0.76, phase: 'shield-burst-energy-latitude', tuning: { meshMotion: 'shockwave', sprite: 'streak', stretch: 1.4, gravity: 0, lifeScale: 0.4, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.48, scale: 0.5, phase: 'shield-burst-surface-sparks', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: -1.5 } },
], 2, 1.3)
