import { useEffect } from 'react'
import { openDebugConsole } from './controller'

export const DEBUG_CONSOLE_TOUCH_HOLD_MS = 600
export const DEBUG_CONSOLE_TOUCH_MAX_DRIFT_PX = 24

interface TouchPoint {
  identifier: number
  clientX: number
  clientY: number
}

function toTouchPoints(touches: TouchList | Touch[]): TouchPoint[] {
  return Array.from(touches).map((touch) => ({
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
  }))
}

export function useDebugConsoleTouchGesture(): void {
  useEffect(() => {
    let timerId: number | null = null
    let originByTouchId = new Map<number, TouchPoint>()

    const clearGesture = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId)
      }

      timerId = null
      originByTouchId = new Map()
    }

    const beginGesture = (touches: TouchList | Touch[]) => {
      clearGesture()

      const touchPoints = toTouchPoints(touches)
      if (touchPoints.length !== 3) {
        return
      }

      originByTouchId = new Map(
        touchPoints.map((touch) => [touch.identifier, touch]),
      )
      timerId = window.setTimeout(() => {
        openDebugConsole()
        timerId = null
        originByTouchId = new Map()
      }, DEBUG_CONSOLE_TOUCH_HOLD_MS)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 3) {
        beginGesture(event.touches)
        return
      }

      if (timerId !== null) {
        clearGesture()
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (timerId === null) {
        return
      }

      if (event.touches.length !== 3) {
        clearGesture()
        return
      }

      const drifted = toTouchPoints(event.touches).some((touch) => {
        const origin = originByTouchId.get(touch.identifier)
        if (!origin) {
          return true
        }

        return Math.hypot(
          touch.clientX - origin.clientX,
          touch.clientY - origin.clientY,
        ) > DEBUG_CONSOLE_TOUCH_MAX_DRIFT_PX
      })

      if (drifted) {
        clearGesture()
      }
    }

    const onTouchEnd = () => {
      if (timerId !== null) {
        clearGesture()
      }
    }

    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)

    return () => {
      clearGesture()
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])
}
