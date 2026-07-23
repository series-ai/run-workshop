import { authoredRecipe } from '../constants/01'

export default authoredRecipe('plasma-hit', "Plasma hit", "A textured cyan-violet contact volume snaps into three closed, backward-peeling magnetic flux streamers for a directional plasma impact without generic sprite debris.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.9, scale: 0.78, phase: 'plasma-hit-original-flipbook-discharge', tuning: { meshShader: 'plasma-impact-flipbook', meshMotion: 'flash', lifecycle: 'plasma-hit-discharge', blend: 'additive', colorOverride: '#ffffff', positionOffset: [1.15, 0.1, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 0.84, scale: 0.78, phase: 'plasma-hit-rebounding-flux-rake', tuning: { meshGeometry: 'plasma-hit-broken-flux-arcs', meshMotion: 'travel', lifecycle: 'plasma-hit-discharge', blend: 'alpha', colorOverride: '#4ff7ff', positionOffset: [1.15, 0.1, 0] } },
], 2, 2.0)
