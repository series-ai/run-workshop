import { describe, expect, it } from 'vitest'
import { formatDurationLabel, formatRelativeTimestamp } from '../format'

describe('formatDurationLabel', () => {
  it('returns 0:00 for zero', () => {
    expect(formatDurationLabel(0)).toBe('0:00')
  })
  it('zero-pads single-digit seconds', () => {
    expect(formatDurationLabel(7)).toBe('0:07')
  })
  it('handles whole minutes', () => {
    expect(formatDurationLabel(60)).toBe('1:00')
  })
  it('handles minutes + seconds', () => {
    expect(formatDurationLabel(83)).toBe('1:23')
  })
  it('floors fractional seconds', () => {
    expect(formatDurationLabel(23.7)).toBe('0:23')
  })
  it('clamps negatives to 0:00', () => {
    expect(formatDurationLabel(-5)).toBe('0:00')
  })
})

describe('formatRelativeTimestamp', () => {
  const now = 1_700_000_000_000

  it('returns "Just now" for ages under 60s', () => {
    expect(formatRelativeTimestamp(now - 30_000, now)).toBe('Just now')
  })
  it('returns minutes for ages under 1hr', () => {
    expect(formatRelativeTimestamp(now - 5 * 60_000, now)).toBe('5 min ago')
  })
  it('returns hours for ages under 24hr', () => {
    expect(formatRelativeTimestamp(now - 3 * 3_600_000, now)).toBe('3 hr ago')
  })
  it('returns a date string beyond 24hr', () => {
    const result = formatRelativeTimestamp(now - 5 * 86_400_000, now)
    // Locale date string varies by env; assert it's not one of the relative
    // forms — that's the contract we care about.
    expect(result).not.toBe('Just now')
    expect(result).not.toMatch(/min ago/)
    expect(result).not.toMatch(/hr ago/)
    expect(result.length).toBeGreaterThan(0)
  })
  it('clamps future timestamps to "Just now"', () => {
    expect(formatRelativeTimestamp(now + 1_000, now)).toBe('Just now')
  })
})

