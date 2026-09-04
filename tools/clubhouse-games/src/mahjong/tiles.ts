import { MahjongBonus, MahjongDragon, MahjongSuit, MahjongSuitValue, MahjongTile, MahjongWind } from './types'

const SUITS: MahjongSuit[] = ['dots', 'bamboo', 'characters']
const WINDS: MahjongWind[] = ['east', 'south', 'west', 'north']
const DRAGONS: MahjongDragon[] = ['red', 'green', 'white']
const BONUS: MahjongBonus[] = [
  'plum', 'orchid', 'chrysanthemum', 'bamboo',
  'spring', 'summer', 'autumn', 'winter',
]

// 144 tiles: (27 suit + 4 wind + 3 dragon) kinds x4 copies + 8 bonus x1.
export function fullMahjongSet(): MahjongTile[] {
  const set: MahjongTile[] = []
  for (let copy = 1; copy <= 4; copy++) {
    for (const suit of SUITS) {
      for (let value = 1; value <= 9; value++) {
        set.push({ kind: 'suit', suit, value: value as MahjongSuitValue, copy })
      }
    }
    for (const wind of WINDS) set.push({ kind: 'wind', wind, copy })
    for (const dragon of DRAGONS) set.push({ kind: 'dragon', dragon, copy })
  }
  for (const bonus of BONUS) set.push({ kind: 'bonus', bonus })
  return set
}
