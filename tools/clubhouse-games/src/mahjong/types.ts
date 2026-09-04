export type MahjongSuit = 'dots' | 'bamboo' | 'characters'
export type MahjongSuitValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type MahjongWind = 'east' | 'south' | 'west' | 'north'
export type MahjongDragon = 'red' | 'green' | 'white'
export type MahjongBonus =
  | 'plum' | 'orchid' | 'chrysanthemum' | 'bamboo'
  | 'spring' | 'summer' | 'autumn' | 'winter'

export type MahjongTile =
  | { kind: 'suit'; suit: MahjongSuit; value: MahjongSuitValue; copy: number }
  | { kind: 'wind'; wind: MahjongWind; copy: number }
  | { kind: 'dragon'; dragon: MahjongDragon; copy: number }
  | { kind: 'bonus'; bonus: MahjongBonus }

// Face design id (no copy number) — 42 unique values in a full set.
export function mahjongFaceId(t: MahjongTile): string {
  switch (t.kind) {
    case 'suit': return `${t.suit}-${t.value}`
    case 'wind': return `wind-${t.wind}`
    case 'dragon': return `dragon-${t.dragon}`
    case 'bonus': return `bonus-${t.bonus}`
  }
}

// Physical tile id (includes copy for multiplied kinds) — 144 unique values.
export function mahjongTileId(t: MahjongTile): string {
  const face = mahjongFaceId(t)
  return t.kind === 'bonus' ? face : `${face}#${t.copy}`
}
