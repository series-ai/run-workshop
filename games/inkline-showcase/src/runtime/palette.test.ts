import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { figureBands, propColor } from './palette'

const rgb = (v: THREE.Vector3) => [v.x, v.y, v.z]

describe('figure palette', () => {
  it('lifts the default ink body to the approved gunmetal bands', () => {
    const bands = figureBands('player', '#151716')
    rgb(bands.mid).forEach((value, i) => expect(value).toBeCloseTo([.16, .18, .21][i], 2))
    rgb(bands.lit).forEach((value, i) => expect(value).toBeCloseTo([.28, .32, .38][i], 2))
    rgb(bands.ink).forEach((value, i) => expect(value).toBeCloseTo([.012, .012, .015][i], 3))
  })
  it('keeps dark swatches distinct after the lift', () => {
    const a = figureBands('player', '#151716').mid, b = figureBands('player', '#3d4552').mid
    expect(a.distanceTo(b)).toBeGreaterThan(.12)
  })
  it('orders shadow, mid, and lit by luminance for every player color', () => {
    const luminance = (v: THREE.Vector3) => v.x * .2126 + v.y * .7152 + v.z * .0722
    for (const color of ['#151716', '#3d4552', '#faf9f5', '#4361ee', '#d45538']) {
      const bands = figureBands('player', color)
      expect(luminance(bands.ink)).toBeLessThan(luminance(bands.mid))
      expect(luminance(bands.shadow)).toBeLessThan(luminance(bands.mid))
      expect(luminance(bands.mid)).toBeLessThan(luminance(bands.lit))
    }
  })
  it('uses display values, not linear values, for saturated colors', () => {
    expect(figureBands('player', '#4361ee').mid.z).toBeCloseTo(0xee / 255, 3)
  })
  it('gives every threat the same vermillion bands', () => {
    expect(figureBands('threat', '#151716')).toEqual(figureBands('threat', '#ff2212'))
  })
})

describe('prop palette', () => {
  it('maps pack materials by name and keeps charcoal', () => {
    const source = new THREE.Color('#d45538')
    expect(propColor('InkMat_SafetyOrange', source).getHexString()).toBe('383c42')
    expect(propColor('InkMat_OffWhite', source).getHexString()).toBe('f2f4f7')
    expect(propColor('InkMat_Steel', source).getHexString()).toBe('94a3b8')
    expect(propColor('InkMat_Charcoal', source).getHexString()).toBe(source.getHexString())
  })
  it('rejects a pack material that has no palette entry', () => {
    expect(() => propColor('InkMat_Unknown', new THREE.Color())).toThrow(/no palette entry/)
  })
})
