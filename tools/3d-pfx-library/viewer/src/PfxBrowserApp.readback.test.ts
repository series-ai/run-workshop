import { describe, expect, it } from 'vitest'
import { profileCanvasFromBrowserReadback } from './PfxBrowserApp'

describe('profileCanvasFromBrowserReadback', () => {
  it('counts non-background pixels from WebGL readback', () => {
    const pixels = new Uint8Array([
      17, 24, 39, 255,
      250, 120, 60, 255,
      17, 24, 39, 255,
      60, 180, 255, 255,
    ])
    const canvas = createReadbackCanvas({
      width: 2,
      height: 2,
      pixels,
    })

    expect(profileCanvasFromBrowserReadback(canvas, 100)).toEqual({
      width: 2,
      height: 2,
      nonBackgroundPixels: 2,
      measurementSource: 'screenshot-readback',
    })
  })

  it('falls back to browser-estimated pixels when readback is unavailable', () => {
    const canvas = {
      width: 0,
      height: 0,
      clientWidth: 10,
      clientHeight: 5,
      getContext: () => null,
    } as unknown as HTMLCanvasElement

    expect(profileCanvasFromBrowserReadback(canvas, 2)).toEqual({
      width: 10,
      height: 5,
      nonBackgroundPixels: 50,
      measurementSource: 'browser-estimate',
    })
  })
})

function createReadbackCanvas({
  width,
  height,
  pixels,
}: {
  width: number
  height: number
  pixels: Uint8Array
}): HTMLCanvasElement {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    getContext: () => ({
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      readPixels: (_x: number, _y: number, _width: number, _height: number, _format: number, _type: number, target: Uint8Array) => {
        target.set(pixels)
      },
    }),
  } as unknown as HTMLCanvasElement
}
