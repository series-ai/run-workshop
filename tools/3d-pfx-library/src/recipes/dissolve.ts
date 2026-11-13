import { authoredRecipe } from '../constants/01'

// RIME erosion doctrine: the body ERODES (never fades). A solid urn burns
// away from the top along a hot amber front with a charred margin; flakes
// leave the surface where the front passes and retire by scale.
export default authoredRecipe('dissolve', 'Object dissolve', 'A solid teal urn erodes from the top along a hot amber front. Small flakes leave the edge as it passes.', [
  { kind: 'shield-shell', role: 'body', opacity: 1, scale: 1, phase: 'dissolve-eroding-subject', tuning: { meshShader: 'dissolve-eroding-prop', colorOverride: '#3a8288', turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 1, scale: 1, phase: 'dissolve-front-flakes', tuning: { meshShader: 'dissolve-front-fragments', colorOverride: '#ff9a2e', turbulenceScale: 0 } },
], 2, 0.9714)
