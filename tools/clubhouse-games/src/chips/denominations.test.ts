import { describe, expect, it } from 'vitest'
import { CHIP_DENOMINATIONS, chipDenomination, chipsForAmount } from './denominations'

const HEX = /^#[0-9a-f]{6}$/i

describe('CHIP_DENOMINATIONS', () => {
  it('are ascending, unique, and well formed', () => {
    const values = CHIP_DENOMINATIONS.map((d) => d.value)
    expect(new Set(values).size).toBe(values.length)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    for (const d of CHIP_DENOMINATIONS) {
      expect(d.value).toBeGreaterThan(0)
      expect(d.label.length).toBeGreaterThan(0)
      expect(HEX.test(d.base)).toBe(true)
      expect(HEX.test(d.accent)).toBe(true)
      expect(HEX.test(d.ink)).toBe(true)
    }
  })
})

describe('chipDenomination', () => {
  it('finds a known value and names the alternatives for an unknown one', () => {
    expect(chipDenomination(25).label).toBe('25')
    expect(() => chipDenomination(3)).toThrow(/No chip denomination for 3/)
    expect(() => chipDenomination(3)).toThrow(/1, 5, 25, 100, 500, 1000/)
  })
})

describe('chipsForAmount', () => {
  it('rejects amounts that are not whole or are negative', () => {
    expect(() => chipsForAmount(1.5)).toThrow(/whole/)
    expect(() => chipsForAmount(-5)).toThrow(/negative/)
  })

  it('makes an empty stack for nothing', () => {
    expect(chipsForAmount(0)).toEqual([])
  })

  it('pays out largest first and sums back to the amount', () => {
    for (const amount of [1, 4, 5, 26, 99, 137, 1687, 24999]) {
      const stack = chipsForAmount(amount)
      const total = stack.reduce((s, e) => s + e.denomination.value * e.count, 0)
      expect(total).toBe(amount)
      const values = stack.map((e) => e.denomination.value)
      expect([...values].sort((a, b) => b - a)).toEqual(values)
    }
  })

  it('uses the fewest chips it can', () => {
    // 1687 = 1x1000 + 1x500 + 1x100 + 3x25 + 2x5 + 2x1
    const stack = chipsForAmount(1687)
    expect(stack.reduce((s, e) => s + e.count, 0)).toBe(10)
  })
})
