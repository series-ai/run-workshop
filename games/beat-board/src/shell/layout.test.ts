import { describe, expect, it } from 'vitest'
import { resolveLayoutMode } from './layout'

describe('resolveLayoutMode', () => {
  it('uses viewport ratio for responsive projects', () => {
    expect(resolveLayoutMode(900, 500, 'responsive')).toBe('landscape')
    expect(resolveLayoutMode(390, 844, 'responsive')).toBe('portrait')
  })

  it('honors portrait lock', () => {
    expect(resolveLayoutMode(1200, 600, 'portrait')).toBe('portrait')
  })

  it('honors landscape lock', () => {
    expect(resolveLayoutMode(390, 844, 'landscape')).toBe('landscape')
  })
})
