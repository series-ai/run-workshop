import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JAM_PACKS, licenseText, runtimeFileCount } from './export-to-jam-assets'

describe('JAM_PACKS', () => {
  it('declares four packs with globally unique slugs', () => {
    expect(JAM_PACKS).toHaveLength(4)
    const slugs = JAM_PACKS.map((pack) => pack.slug)
    expect(new Set(slugs).size).toBe(4)
  })

  it('places each pack at a path build-manifest.mjs walks', () => {
    expect(JAM_PACKS.map((pack) => pack.destDir)).toEqual([
      '3D/pirate/proofofplay-pirate-nation-models',
      'ui/proofofplay-pirate-nation-icons',
      'ui/proofofplay-pirate-nation-ui',
      'audio/proofofplay-pirate-nation-audio',
    ])
  })

  it('prefixes every slug with the creator key so creatorOf() resolves it', () => {
    for (const pack of JAM_PACKS) expect(pack.slug.startsWith('proofofplay-')).toBe(true)
  })

  it('declares the source file count each pack must hold', () => {
    expect(JAM_PACKS.map((pack) => pack.expectedFiles)).toEqual([375, 151, 362, 30])
  })

  it('attaches thumbnails to the existing model pack', () => {
    expect(JAM_PACKS).toHaveLength(4)
    expect(JAM_PACKS[0]).toMatchObject({
      slug: 'proofofplay-pirate-nation-models',
      destDir: '3D/pirate/proofofplay-pirate-nation-models',
      category: '3d',
      expectedFiles: 375,
      expectedThumbnailFiles: 355,
      expectedRuntimeFiles: 730,
      expectedTotalFiles: 733,
    })
  })

  it('names the expected preview model for each pack', () => {
    expect(JAM_PACKS.map((pack) => pack.previewModelId)).toEqual([
      'ships-ship-pirate-xl',
      'ships-ship-pirate-xl',
      'buildings-building-6x8-townhall-01',
      'world-bosses-creature-16x16-kraken',
    ])
  })
})

describe('runtimeFileCount', () => {
  it('counts only files build-manifest.mjs treats as runtime', () => {
    expect(runtimeFileCount('3d', [
      'ships/ships-boat.glb',
      'ships/Previews/ships-boat.jpg',
      'preview.png',
      'License.txt',
    ])).toBe(2)
    expect(runtimeFileCount('ui', ['a.png', 'preview.png', 'License.txt'])).toBe(2)
    expect(runtimeFileCount('audio', ['a.mp3', 'b.wav', 'License.txt'])).toBe(1)
  })

  it('counts model previews without applying the obsolete import cap', () => {
    expect(runtimeFileCount('3d', Array.from(
      { length: 730 },
      (_, index) => index < 375
        ? `category/model-${index}.glb`
        : `category/Previews/thumb-${index}.jpg`,
    ))).toBe(730)
  })
})

describe('licenseText', () => {
  it('heads the MIT body with checkable provenance', () => {
    const mitBody = readFileSync(
      join(process.cwd(), 'public/catalog/pirate-nation/LICENSE'),
      'utf8',
    )
    const text = licenseText('2026-08-26', undefined, mitBody.trimEnd())
    expect(text).toMatch(/^SPDX-License-Identifier: MIT$/m)
    expect(text).toMatch(/^Source: https:\/\/github\.com\/proofofplay\/piratenation-game$/m)
    expect(text).toMatch(/^Verified-by: .+, 2026-08-26$/m)
    expect(text).toMatch(/^Copyright \(c\) 2026 Proof of Play, Inc\.$/m)
    expect(text).toContain('Permission is hereby granted, free of charge')
    expect(text).toContain('The above copyright notice and this permission notice shall be included')
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"')
    expect(text).toMatch(/IN NO EVENT SHALL THE\s+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/)
  })
})
