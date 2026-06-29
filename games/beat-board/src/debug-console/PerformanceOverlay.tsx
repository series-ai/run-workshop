import { useEffect, useState } from 'react'
import {
  getDebugPerformanceState,
  loadDebugPerformancePreference,
  subscribeToDebugPerformance,
} from './performance'

function formatMemoryBytes(memoryBytes: number | null): string {
  if (memoryBytes === null) {
    return 'Unavailable'
  }

  return `${Math.round(memoryBytes / (1024 * 1024))} MB`
}

export function PerformanceOverlay() {
  const [snapshot, setSnapshot] = useState(
    () => getDebugPerformanceState(),
  )

  useEffect(() => {
    void loadDebugPerformancePreference()

    return subscribeToDebugPerformance(() => {
      setSnapshot(getDebugPerformanceState())
    })
  }, [])

  if (!snapshot.overlayEnabled) {
    return null
  }

  return (
    <div data-testid="debug-performance-overlay">
      <span>FPS {snapshot.currentFps ?? '--'}</span>
      <span>Memory {formatMemoryBytes(snapshot.currentMemoryBytes)}</span>
    </div>
  )
}
