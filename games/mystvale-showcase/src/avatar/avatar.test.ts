import { describe, it, expect } from 'vitest'
import {
  resolveAvatarLayers,
  generateRandomAppearance,
  hexToRgb,
  applyTintToImageData,
} from './avatar'

describe('avatar engine', () => {
  it('converts hex color to rgb numbers correctly', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#fbd4b4')).toEqual({ r: 251, g: 212, b: 180 })
  })

  it('resolves layered stack sorted by zIndex ascending', () => {
    const layers = resolveAvatarLayers({
      selections: {
        body: 'body-greyscale',
        eyes: 'fem-face',
        clothes: 'clothes-overalls',
        hair: 'bob-cut',
        accessories: 'acc-hat-lucky',
      },
      tints: {
        skin: '#fbd4b4',
        hair: '#5c3a21',
        eyes: '#264653',
        clothes: '#4a7c59',
      },
    })

    expect(layers.length).toBe(5)
    expect(layers[0].slot).toBe('body')
    expect(layers[1].slot).toBe('eyes')
    expect(layers[2].slot).toBe('clothes')
    expect(layers[3].slot).toBe('hair')
    expect(layers[4].slot).toBe('accessories')
  })

  it('generates a valid randomized avatar appearance', () => {
    const randomApp = generateRandomAppearance()
    expect(randomApp.selections.body).toBe('body-greyscale')
    expect(randomApp.selections.hair).toBeDefined()
    expect(randomApp.selections.clothes).toBeDefined()
    expect(randomApp.tints.skin).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('multiplies greyscale pixels by tint color preserving alpha', () => {
    // 1 pixel: grey (128, 128, 128, 255), tint #ff0000 (255, 0, 0)
    const rawData = new Uint8ClampedArray([128, 128, 128, 255])
    applyTintToImageData(rawData, '#ff0000')

    // 128/255 * 255 = 128, 128/255 * 0 = 0
    expect(rawData[0]).toBe(128)
    expect(rawData[1]).toBe(0)
    expect(rawData[2]).toBe(0)
    expect(rawData[3]).toBe(255)
  })
})
