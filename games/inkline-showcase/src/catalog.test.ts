import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseManifest } from './catalog'
import type { PackManifest } from './types'

const source = (): PackManifest => JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as PackManifest
describe('exported contact metadata boundary', () => {
  it('retains the authored contact frame for every event in the real catalog', () => {
    const manifest = source(), parsed = parseManifest(manifest)
    for (const clip of manifest.animations.filter(clip => clip.contactFrame !== undefined)) {
      expect(parsed.animations.find(item => item.id === clip.id)?.contactFrame).toBe(clip.contactFrame)
    }
  })
  it('rejects a contact event one GLB sample early', () => {
    const manifest = source(), clip = manifest.animations.find(clip => clip.contactFrame !== undefined)!
    clip.contactTime = (clip.contactFrame! - 1) / 30
    expect(() => parseManifest(manifest)).toThrow('exported time')
  })
  it('rejects a frame without its time and a fractional frame', () => {
    const manifest = source(), clip = manifest.animations.find(clip => clip.contactFrame !== undefined)!
    const time = clip.contactTime
    delete clip.contactTime
    expect(() => parseManifest(manifest)).toThrow('exported time')
    clip.contactTime = time; clip.contactFrame! += .5
    expect(() => parseManifest(manifest)).toThrow('exported time')
  })
})

describe('locomotion speed boundary', () => {
  it('preserves authored jump phases and rejects phases outside the clip', () => {
    const manifest = source(), clip = manifest.animations.find(clip => clip.id === 'jump-start')!
    clip.motion = { phases: [{ name: 'takeoff', frame: 6 }] }
    expect(parseManifest(manifest).animations.find(clip => clip.id === 'jump-start')?.motion).toEqual(clip.motion)
    clip.motion.phases[0].frame = clip.duration * 30 + 1
    expect(() => parseManifest(manifest)).toThrow('phase')
  })
  it('preserves a positive authored travel speed and rejects invalid values', () => {
    const manifest = source(), clip = manifest.animations.find(clip => clip.id === 'run')!
    clip.travelSpeed = 3
    expect(parseManifest(manifest).animations.find(clip => clip.id === 'run')?.travelSpeed).toBe(3)
    for (const value of [0, -1, Infinity, NaN]) {
      clip.travelSpeed = value
      expect(() => parseManifest(manifest)).toThrow('Travel speed')
    }
    clip.travelSpeed = 3; clip.loop = false
    expect(() => parseManifest(manifest)).toThrow('requires a loop')
  })
})
