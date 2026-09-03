// Canvas resolution for a 2.5:3.5 poker card (spike-verified crisp at
// fullscreen-closeup on a 1280x720 viewport).
export const CARD_W = 512
export const CARD_H = 716
export const CARD_RADIUS = 36

// World-space card size (poker ratio 2.5 : 3.5).
export const WORLD_W = 2.5
export const WORLD_H = 3.5

// Half-gap between the two single-sided face planes. Kills z-fighting with
// zero visible parallax at this scene scale (spike-verified).
export const Z_OFF = 0.002
