import { describe, expect, it } from 'vitest'
import { resolveAssetUrl } from './assetSource'
import { LEAF_2D, LEAF_UI, PINS, REQUIRED_LEAVES } from './pins'

describe('micro-rts-showcase pins and asset URLs', () => {
  it('pins every required jam-ready-assets leaf with a 12-char content hash', () => {
    for (const leaf of REQUIRED_LEAVES) {
      expect(PINS[leaf]).toMatch(/^[a-f0-9]{12}$/)
    }
  })

  it('resolves local dev URLs under /jam/<leafId>/<path>', async () => {
    const url2d = await resolveAssetUrl(
      { leafId: LEAF_2D, path: 'units/vanguard/V16-siege-tank-8way.png' },
      { kind: 'local', base: 'jam' },
    )
    expect(url2d).toBe('jam/run-micro-rts/2D/space-scifi/units/vanguard/V16-siege-tank-8way.png')

    const urlUi = await resolveAssetUrl(
      { leafId: LEAF_UI, path: 'selection-rings/sel-md.png' },
      { kind: 'local', base: 'jam' },
    )
    expect(urlUi).toBe('jam/run-micro-rts/ui/selection-rings/sel-md.png')
  })

  it('rejects unpinned leaves in pinned mode', async () => {
    await expect(
      resolveAssetUrl({ leafId: 'run-micro-rts/unknown', path: 'foo.png' }, { kind: 'pinned', pins: PINS }),
    ).rejects.toThrow(/No published jam-ready-assets pin/)
  })
})
