import { describe, expect, it } from 'vitest'
import { fullMahjongSet } from './tiles'
import { mahjongFaceId, mahjongTileId } from './types'

describe('fullMahjongSet', () => {
  it('returns 144 tiles with unique tile ids', () => {
    const set = fullMahjongSet()
    expect(set).toHaveLength(144)
    expect(new Set(set.map(mahjongTileId)).size).toBe(144)
  })

  it('has 42 distinct face designs: 34 kinds x4 copies + 8 bonus x1', () => {
    const faces = new Set(fullMahjongSet().map(mahjongFaceId))
    expect(faces.size).toBe(42)
    const counts = new Map<string, number>()
    for (const t of fullMahjongSet()) {
      const f = mahjongFaceId(t)
      counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    const bonus = [...counts.entries()].filter(([f]) => f.startsWith('bonus-'))
    expect(bonus).toHaveLength(8)
    for (const [, n] of bonus) expect(n).toBe(1)
    for (const [f, n] of counts) {
      if (!f.startsWith('bonus-')) expect(n).toBe(4)
    }
  })
})
