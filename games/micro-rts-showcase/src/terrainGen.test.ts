import { describe, expect, it } from 'vitest'
import type { EnvObjectEntry } from './catalog'
import { generateWfcBattleMap, isWalkableGround, MAP_PRESETS, MAP_TILES_H, MAP_TILES_W } from './terrainGen'

const MOCK_OBJECTS: EnvObjectEntry[] = [
  { id: 'mineral-blue', name: 'Mineral', category: 'resource', biome: 'any', stateMode: 'depletion', blocksMovement: true, blocksVision: false, cellW: 16, cellH: 14, frames: 4, sheet: 'environment/objects/obj-mineral-blue.png' },
  { id: 'mineral-gold', name: 'Gold', category: 'resource', biome: 'any', stateMode: 'depletion', blocksMovement: true, blocksVision: false, cellW: 16, cellH: 14, frames: 4, sheet: 'environment/objects/obj-mineral-gold.png' },
  { id: 'gas-geyser', name: 'Gas', category: 'resource', biome: 'any', stateMode: 'anim', blocksMovement: true, blocksVision: false, cellW: 16, cellH: 14, frames: 3, sheet: 'environment/objects/obj-gas-geyser.png' },
  { id: 'neutral-watchtower', name: 'Tower', category: 'objective', biome: 'any', stateMode: 'anim', blocksMovement: true, blocksVision: false, cellW: 16, cellH: 15, frames: 3, sheet: 'environment/objects/obj-neutral-watchtower.png' },
  { id: 'tree-pine', name: 'Pine', category: 'flora', biome: 'temperate', stateMode: 'static', blocksMovement: true, blocksVision: true, cellW: 13, cellH: 16, frames: 1, sheet: 'environment/objects/obj-tree-pine.png' },
  { id: 'obstacle-rocks', name: 'Rocks', category: 'obstacle', biome: 'temperate', stateMode: 'damage', blocksMovement: true, blocksVision: false, cellW: 24, cellH: 13, frames: 3, sheet: 'environment/objects/obj-obstacle-rocks.png' },
]

describe('WFC + Dual-Grid Wang-16 terrain generator', () => {
  it('generates deterministic, valid multi-elevation battlefields across all 4 presets', () => {
    for (const preset of MAP_PRESETS) {
      const m1 = generateWfcBattleMap('temperate', preset.id, 42, MOCK_OBJECTS)
      const m2 = generateWfcBattleMap('temperate', preset.id, 42, MOCK_OBJECTS)
      expect(m1.usedFallback).toBe(false)
      expect(m1.vertices).toEqual(m2.vertices)
      expect(m1.gridW).toBe(MAP_TILES_W + 1)
      expect(m1.gridH).toBe(MAP_TILES_H + 1)
      expect(m1.ramps.length).toBeGreaterThanOrEqual(1)
      expect(m1.props.length).toBeGreaterThanOrEqual(4)
      // All 3 faction base centers must be walkable
      for (const b of m1.bases) {
        expect(isWalkableGround(m1, b.x, b.y)).toBe(true)
      }
    }
  })

  it('produces varied maps across different seeds', () => {
    const a = generateWfcBattleMap('volcanic', 'wfc-frontier', 1, MOCK_OBJECTS)
    const b = generateWfcBattleMap('volcanic', 'wfc-frontier', 9, MOCK_OBJECTS)
    expect(a.sectors).not.toEqual(b.sectors)
  })
})
