import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-impact', "Plasma impact", "Ion contact with magnetic core and orbit flecks.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.5, phase: 'plasma-impact-ion-core', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'aura', opacity: 0.5, scale: 0.5, phase: 'plasma-impact-orbit-flecks', tuning: { countScale: 0.34, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', flicker: 1.2, gravity: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'plasma-impact-contact-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.0)
