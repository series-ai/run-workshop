import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clipLooksAnimated, groupSpriteClips, parseCocosAtlasPlist } from './parseCocosAtlas'
import { isCocosParticlePlist, parseCocosParticlePlist } from './parseCocosParticle'

const asset = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../../assets/duelyst', name), 'utf8')

describe('parseCocosAtlasPlist', () => {
  it('reads heal as one 15-frame animation clip', () => {
    const sheet = parseCocosAtlasPlist(asset('fx_heal.plist'))
    expect(sheet.textureWidth).toBe(512)
    expect(sheet.textureHeight).toBe(256)
    expect(sheet.clips).toHaveLength(1)
    expect(sheet.clips[0]?.id).toBe('fx_heal')
    expect(sheet.clips[0]?.frames).toHaveLength(15)
    expect(sheet.clips[0]?.animated).toBe(true)
    const first = sheet.clips[0]?.frames[0]
    expect(first?.width).toBe(80)
    expect(first?.u).toBeCloseTo(162 / 512)
    expect(first?.du).toBeCloseTo(80 / 512)
    expect(first?.dv).toBeCloseTo(80 / 256)
    expect(first?.v).toBeCloseTo(1 - (81 + 80) / 256)
  })

  it('keeps impact sequences as separate clips', () => {
    const sheet = parseCocosAtlasPlist(asset('fx_impact.plist'))
    expect(sheet.clips.length).toBeGreaterThan(1)
    for (const clip of sheet.clips) {
      expect(clip.frames.length).toBeGreaterThan(0)
      expect(clip.animated).toBe(true)
    }
  })

  it('treats ray stamps as variants, not one animation', () => {
    const sheet = parseCocosAtlasPlist(asset('rays.plist'))
    const ray = sheet.clips.find((clip) => clip.id === 'ray')
    expect(ray).toBeDefined()
    expect(ray && clipLooksAnimated(ray.frames)).toBe(false)
    expect(ray?.animated).toBe(false)
  })

  it('groups numbered frames in index order', () => {
    const sheet = parseCocosAtlasPlist(asset('fx_smoke2.plist'))
    expect(sheet.clips[0]?.frames.map((frame) => frame.name)).toEqual([
      'fx_smokeground_000.png',
      'fx_smokeground_001.png',
      'fx_smokeground_002.png',
      'fx_smokeground_003.png',
      'fx_smokeground_004.png',
      'fx_smokeground_005.png',
      'fx_smokeground_006.png',
      'fx_smokeground_007.png',
    ])
  })
})

describe('groupSpriteClips', () => {
  it('does not invent clips', () => {
    expect(groupSpriteClips([])).toEqual([])
  })
})

describe('parseCocosParticlePlist', () => {
  it('reads Duelyst rain as a gravity emitter', () => {
    const xml = asset('rain.plist')
    expect(isCocosParticlePlist(xml)).toBe(true)
    const rain = parseCocosParticlePlist(xml)
    expect(rain.maxParticles).toBe(250)
    expect(rain.speed).toBe(300)
    expect(rain.angle).toBe(-110)
    expect(rain.startSize).toBe(6)
    expect(rain.additive).toBe(true)
    expect(rain.textureFileName).toBe('rain.png')
    expect(rain.startColor[0]).toBe(0)
    expect(rain.startColor[1]).toBe(1)
    expect(rain.startColorAlpha).toBeCloseTo(0.35)
  })
})
