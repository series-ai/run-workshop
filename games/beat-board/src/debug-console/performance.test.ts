import { beforeEach, describe, expect, it } from 'vitest'
import * as performanceRuntime from './performance'

describe('debug performance runtime', () => {
  beforeEach(() => {
    ;(performanceRuntime as { resetDebugPerformanceState?: () => void }).resetDebugPerformanceState?.()
    delete (performance as Performance & { memory?: unknown }).memory
  })

  it('records bounded FPS history without notifying subscribers on every frame', () => {
    const notifications: number[] = []

    const unsubscribe = performanceRuntime.subscribeToDebugPerformance(() => {
      notifications.push(Date.now())
    })

    for (let second = 0; second < 65; second += 1) {
      for (let frame = 0; frame < 10; frame += 1) {
        ;(performanceRuntime as { recordDebugAnimationFrame?: (timestampMs: number) => void })
          .recordDebugAnimationFrame?.(second * 1000 + frame * 16)
      }
    }

    unsubscribe()

    const snapshot = performanceRuntime.getDebugPerformanceState() as {
      fpsHistory?: number[]
    }

    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications.length).toBeLessThan(65 * 10)
    expect(snapshot.fpsHistory).toHaveLength(60)
  })

  it('marks memory as unavailable when the host does not expose a memory API', () => {
    ;(performanceRuntime as { refreshDebugMemorySample?: (timestampMs: number) => void })
      .refreshDebugMemorySample?.(1000)

    const snapshot = performanceRuntime.getDebugPerformanceState() as {
      memorySupported?: boolean
      memoryHistory?: Array<number | null>
    }

    expect(snapshot.memorySupported).toBe(false)
    expect(snapshot.memoryHistory?.at(-1)).toBeNull()
  })
})
