export { CARD_H, CARD_RADIUS, CARD_W, WORLD_H, WORLD_W, Z_OFF } from './constants'
export { roundRectPath } from './canvasUtils'
export { isRedSuit, suitColor, RANKS, SUITS } from './types'
export type { Card, Rank, Suit } from './types'
export { cardId, fullDeck, parseCardId } from './deck'
export { drawSuitPath } from './faces/suitPaths'
export { isSpotRank, pipLayout, SPOT_RANKS } from './faces/pipLayouts'
export type { Pip, SpotRank } from './faces/pipLayouts'
export { paintFace } from './faces/paintFace'
export type { PaintFaceOptions } from './faces/paintFace'
export { BACK_PRESETS, getBackPreset } from './backs/backThemes'
export type { BackPattern, BackTheme } from './backs/backThemes'
export { paintBack } from './backs/paintBack'
export type { PaintBackOptions } from './backs/paintBack'
export {
  disposeCardTextureCaches,
  getBackTexture,
  getFaceTexture,
  loadBackTexture,
  toTexture,
} from './three/textures'
export { PlayingCard, useCardBackTexture } from './three/PlayingCard'
export type { CardBackSource, PlayingCardProps } from './three/PlayingCard'

// Dominoes
export { doubleSixSet, PIP_LAYOUTS } from './dominoes/set'
export { dominoId, parseDominoId } from './dominoes/types'
export type { Domino, PipValue } from './dominoes/types'
export { paintDomino } from './dominoes/paintDomino'
export type { PaintDominoOptions } from './dominoes/paintDomino'
export { DominoPiece } from './three/DominoPiece'
export type { DominoPieceProps } from './three/DominoPiece'

// Dice
export { DIE_FACES, DIE_PIP_LAYOUTS } from './dice/pipFaces'
export type { DieValue } from './dice/pipFaces'
export { DIE_KINDS, parseDieKind, parseDieStyle, resolveDieStyle } from './dice/kinds'
export type { DieKind, DieStyle } from './dice/kinds'
export { DIE_COLORWAYS, DIE_PALETTES, parseDieColorway } from './dice/colorways'
export type { DieColorway, DiePalette } from './dice/colorways'
export { paintDieFace } from './dice/paintDieFace'
export type { PaintDieFaceOptions } from './dice/paintDieFace'
export { paintDieNumeral } from './dice/paintDieNumeral'
export { readTopFace, restQuaternion, snapToFace } from './dice/readTopFace'
export { startToss, stepToss } from './dice/toss'
export type { TossBody, TossOptions } from './dice/toss'
export { Die } from './three/Die'
export type { DieProps } from './three/Die'
export { TossedDie } from './three/TossedDie'
export type { TossedDieProps } from './three/TossedDie'

// Mahjong
export { fullMahjongSet } from './mahjong/tiles'
export { mahjongFaceId, mahjongTileId } from './mahjong/types'
export type { MahjongBonus, MahjongDragon, MahjongSuit, MahjongSuitValue, MahjongTile, MahjongWind } from './mahjong/types'
export { TILE_CJK_FONT } from './mahjong/fonts'
export { paintMahjongFace } from './mahjong/paintMahjongFace'
export { paintMahjongBack } from './mahjong/paintMahjongBack'
export { MahjongPiece } from './three/MahjongPiece'
export type { MahjongPieceProps } from './three/MahjongPiece'

// Shared piece plumbing
export { BoxPiece, BOX_FACE, useFlipY } from './three/BoxPiece'
export type { BoxFaceMap, BoxFaceName, BoxPieceProps } from './three/BoxPiece'
