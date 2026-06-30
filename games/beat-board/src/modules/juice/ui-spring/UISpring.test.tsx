import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useUISpring } from './UISpring'

describe('useUISpring', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('starts settled', () => {
    const { result } = renderHook(() => useUISpring())
    expect(result.current.isSettled).toBe(true)
  })

  it('initial style has identity transform', () => {
    const { result } = renderHook(() => useUISpring())
    expect(result.current.style.transform).toContain('translate(0px, 0px)')
    expect(result.current.style.transform).toContain('scale(1)')
    expect(result.current.style.transform).toContain('rotate(0deg)')
  })

  it('initial style has opacity 1', () => {
    const { result } = renderHook(() => useUISpring())
    expect(result.current.style.opacity).toBe(1)
  })

  it('moveTo sets unsettled', () => {
    const { result } = renderHook(() => useUISpring())
    act(() => { result.current.moveTo({ x: 100 }) })
    expect(result.current.isSettled).toBe(false)
  })

  it('moveTo x updates transform after animation', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.moveTo({ x: 50 }) })

    // Advance enough for spring to settle
    act(() => { vi.advanceTimersByTime(2000) })

    expect(result.current.style.transform).toContain('translate(50px,')
  })

  it('moveTo scale updates transform', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.moveTo({ scale: 2 }) })

    act(() => { vi.advanceTimersByTime(2000) })

    expect(result.current.style.transform).toContain('scale(2)')
  })

  it('moveTo rotate updates transform', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.moveTo({ rotate: 45 }) })

    act(() => { vi.advanceTimersByTime(2000) })

    expect(result.current.style.transform).toContain('rotate(45deg)')
  })

  it('moveTo opacity updates style', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.moveTo({ opacity: 0.5 }) })

    act(() => { vi.advanceTimersByTime(2000) })

    // Should be close to 0.5
    expect(result.current.style.opacity).toBeCloseTo(0.5, 1)
  })

  it('bump creates motion from rest', () => {
    const { result } = renderHook(() => useUISpring())
    act(() => { result.current.bump({ x: 100 }) })
    expect(result.current.isSettled).toBe(false)
  })

  it('settles back after bump', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.bump({ x: 50 }) })

    act(() => { vi.advanceTimersByTime(3000) })

    // Should settle back to 0
    expect(result.current.isSettled).toBe(true)
    expect(result.current.style.transform).toContain('translate(0px,')
  })

  it('multiple properties can be set simultaneously', () => {
    const { result } = renderHook(() => useUISpring({ damping: 1, frequency: 10 }))
    act(() => { result.current.moveTo({ x: 10, y: 20, scale: 1.5 }) })

    act(() => { vi.advanceTimersByTime(2000) })

    const transform = result.current.style.transform as string
    expect(transform).toContain('translate(10px, 20px)')
    expect(transform).toContain('scale(1.5)')
  })
})
