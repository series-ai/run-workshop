import { authoredRecipe } from '../constants/01'

// A soap bubble swells and wobbles once, its thin film showing slow
// interference bands. It ruptures near the top front: a bright ragged
// opening edge sweeps over the whole film, scraps tear off and curl away
// with a few tiny droplets, and nothing remains before the wrap. The old
// particle layer stretched the cycle by 1.21626; tempo 0.9866311479453407
// (1.2 / 1.21626) keeps the exact earlier 1.104 s cycle with cycleScale 1.
export default authoredRecipe('bubble-burst', 'Bubble burst', 'A thin-film bubble swells, then ruptures: an opening edge sweeps the film while scraps curl away with tiny droplets.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.96, scale: 1.2, phase: 'bubble-burst-thin-film', tuning: { meshShader: 'bubble-burst-thin-film', colorIndex: 0, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'impact', opacity: 0.96, scale: 1.2, phase: 'bubble-burst-pop-fragments', tuning: { meshShader: 'bubble-burst-pop-fragments', colorIndex: 0, turbulenceScale: 0 } },
], 2, 0.9866311479453407)
