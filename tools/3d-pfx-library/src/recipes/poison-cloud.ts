import { authoredRecipe } from '../constants/01'

// Persistent hazard loop: a low bank of layered gas rolls outward over a
// dark ground stain. The body stays dark; the crests catch a sickly
// yellow-green light. A few spores rise and small bubbles pop at the base.
// All motion repeats once per 4.65 s loop; nothing fades to empty.
export default authoredRecipe('poison-cloud', 'Poison area cloud', 'A low, rolling bank of dark toxic gas with sickly yellow-green crests, rising spores and popping bubbles.', [
  { kind: 'toxic-pool', role: 'volume', opacity: 1, scale: 1, phase: 'poison-cloud-ground-gas-bank', tuning: { meshShader: 'poison-cloud-gas-bank', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'volume', opacity: 0.85, scale: 1, phase: 'poison-cloud-ground-spores', tuning: { meshShader: 'poison-cloud-spores', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.3)
