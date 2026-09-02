import { describe, it, expect } from 'vitest'
import {
  CROPS,
  AVATAR_LAYERS,
  DEFAULT_AVATAR_APPEARANCE,
  AUDIO_TRACKS,
  PACK_METRICS,
} from './catalog'

describe('catalog', () => {
  it('contains 14 crops with valid stage sprite paths', () => {
    expect(CROPS).toHaveLength(14)
    for (const crop of CROPS) {
      expect(crop.id).toBeDefined()
      expect(crop.name).toBeDefined()
      expect(crop.stageSprites.length).toBeGreaterThanOrEqual(3)
      for (const sprite of crop.stageSprites) {
        expect(sprite).toMatch(/^crops\//)
      }
    }
  })

  it('contains avatar layer definitions and default appearance', () => {
    expect(AVATAR_LAYERS.length).toBeGreaterThan(5)
    expect(DEFAULT_AVATAR_APPEARANCE.selections.body).toBe('body-greyscale')
    expect(DEFAULT_AVATAR_APPEARANCE.tints.skin).toBe('#fbd4b4')
  })

  it('contains audio tracks with category classifications', () => {
    expect(AUDIO_TRACKS.length).toBeGreaterThan(10)
    const music = AUDIO_TRACKS.filter((t) => t.category === 'music')
    const ambient = AUDIO_TRACKS.filter((t) => t.category === 'ambient')
    const sfx = AUDIO_TRACKS.filter((t) => t.category === 'sfx')
    expect(music.length).toBeGreaterThan(0)
    expect(ambient.length).toBeGreaterThan(0)
    expect(sfx.length).toBeGreaterThan(0)
  })

  it('has valid pack metrics', () => {
    expect(PACK_METRICS.packId).toBe('series-ai/mystvale')
    expect(PACK_METRICS.version).toBe('04811e1dd830')
    expect(PACK_METRICS.totalFiles).toBeGreaterThan(900)
    expect(PACK_METRICS.license).toBe('MIT')
  })
})
