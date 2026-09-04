// Casino chip denominations. The colors follow common US house standards, so
// a stack reads at a glance the way a real rack does.
export interface ChipDenomination {
  value: number
  // Short label printed on the face.
  label: string
  // Clay body color.
  base: string
  // Edge inserts and the ring band; the contrast color of the chip.
  accent: string
  // Ink for the label and the fine rules.
  ink: string
}

export const CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  { value: 1, label: '1', base: '#f2f0ea', accent: '#2f4d8f', ink: '#2a2a32' },
  { value: 5, label: '5', base: '#a8202f', accent: '#f2f0ea', ink: '#f7f2e8' },
  { value: 25, label: '25', base: '#1f6b46', accent: '#f2f0ea', ink: '#f7f2e8' },
  { value: 100, label: '100', base: '#1b1b21', accent: '#d8b271', ink: '#f2e4c4' },
  { value: 500, label: '500', base: '#4b2a72', accent: '#f2f0ea', ink: '#f4ecfb' },
  { value: 1000, label: '1K', base: '#d4a72c', accent: '#1b1b21', ink: '#2a2214' },
]

export function chipDenomination(value: number): ChipDenomination {
  const found = CHIP_DENOMINATIONS.find((d) => d.value === value)
  if (!found) {
    const known = CHIP_DENOMINATIONS.map((d) => d.value).join(', ')
    throw new Error(`No chip denomination for ${value}. Known values: ${known}`)
  }
  return found
}

// Splits an amount into the fewest chips, largest first. Returns one entry per
// denomination that is used.
export interface ChipStackEntry {
  denomination: ChipDenomination
  count: number
}

export function chipsForAmount(amount: number): ChipStackEntry[] {
  if (!Number.isInteger(amount)) throw new Error(`Chip amounts are whole, got ${amount}`)
  if (amount < 0) throw new Error(`Chip amounts cannot be negative, got ${amount}`)
  const out: ChipStackEntry[] = []
  let left = amount
  for (const denomination of [...CHIP_DENOMINATIONS].sort((a, b) => b.value - a.value)) {
    const count = Math.floor(left / denomination.value)
    if (count > 0) {
      out.push({ denomination, count })
      left -= count * denomination.value
    }
  }
  return out
}
