import { authoredRecipe } from '../constants/01'

// Blue-plasma evolution of the certified fireball anatomy: the head ROLLS
// around its travel axis while one closed wake replaces flat lick cards.
export default authoredRecipe('projectile-trail', 'Projectile Trail', 'Blue plasma comet: rolling hot head, world-swept tail, glow card pushes the value range.', [
  { kind: 'tapered-trail', role: 'trail', opacity: 0.78, scale: 1.22, phase: 'projectile-trail-plasma-wake', tuning: { meshMotion: 'travel', meshShader: 'projectile-wake', colorOverride: '#075ed8' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.9, scale: 0.78, phase: 'projectile-trail-ion-glow', tuning: { meshMotion: 'glow', colorOverride: '#0f5fd8' } },
  { kind: 'projectile-comet', role: 'body', opacity: 0.95, scale: 0.9, phase: 'projectile-trail-hot-core', tuning: { meshMotion: 'travel', meshShader: 'fire-body', colorOverride: '#1f8ffa', spinScale: 0.8 } },
], 2, 1.2)
