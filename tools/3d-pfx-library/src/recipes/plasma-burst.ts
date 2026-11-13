import { authoredRecipe } from '../constants/01'

// A small hot ion packet with a dark separation band sits in uneven magnetic
// loops and open filaments, with ions bouncing along them. The field
// squeezes and the core flares once; then each loop snaps, its free ends
// whip outward, the sheath tears open and cools, and the ions leave on short
// spiral traces that shrink. Tempo keeps the earlier 0.870 s cycle.
export default authoredRecipe('plasma-burst', 'Plasma burst', 'A hot ion packet held by uneven magnetic loops squeezes, then the field snaps open, the sheath tears and ion traces spiral away.', [
  { kind: 'shield-shell', role: 'body', opacity: 0.95, scale: 1.15, phase: 'plasma-burst-ion-packet', tuning: { meshShader: 'plasma-burst-magnetic-core', colorIndex: 1, turbulenceScale: 0 } },
  { kind: 'mesh-fragments', role: 'trail', opacity: 0.94, scale: 1.15, phase: 'plasma-burst-magnetic-filaments', tuning: { meshShader: 'plasma-burst-ion-filaments', colorIndex: 1, turbulenceScale: 0 } },
], 2, 1.3)
