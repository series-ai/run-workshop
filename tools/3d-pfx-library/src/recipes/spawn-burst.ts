import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spawn-burst', "Spawn burst", "Entity arrival burst with a stable spawn pad and light motes.", [
  { kind: 'ring-field', role: 'aura', opacity: 0.54, scale: 0.7, phase: 'spawn-burst-ground-pad', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'beam-column', role: 'body', opacity: 0.45, scale: 0.54, phase: 'spawn-burst-anchor-line' },
  { kind: 'particles', role: 'aura', opacity: 0.5, scale: 0.5, phase: 'spawn-burst-materialize-motes', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.7, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: 1.2 } },
], 2, 1.15)
