import { authoredRecipe } from '../constants/01'

// A dim stepped leader branches down from a source into depth. When it
// touches the contact, one return stroke lights the whole connected network;
// the channel then cools, the branches die first, and the channel breaks up.
// A restrained corona follows the strike, and sparks leave the contact and
// the branch tips, cool and shrink. Tempo keeps the earlier 0.754 s cycle.
export default authoredRecipe('electric-burst', 'Electric burst', 'A stepped leader branches into depth, then one return stroke lights the connected discharge, which cools and breaks up while sparks cool and shrink.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.94, scale: 1.1, phase: 'electric-burst-branched-discharge', tuning: { meshShader: 'electric-burst-branch-network', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 0.94, scale: 1.1, phase: 'electric-burst-contact-corona', tuning: { meshShader: 'electric-burst-corona', colorIndex: 0, turbulenceScale: 0 } },
], 2, 1.5)
