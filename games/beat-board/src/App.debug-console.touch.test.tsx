import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetDebugConsoleModules } from './debug-console/modules'
import {
  DEBUG_CONSOLE_TOUCH_HOLD_MS,
  DEBUG_CONSOLE_TOUCH_MAX_DRIFT_PX,
} from './debug-console/useDebugConsoleTouchGesture'
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider'

function renderNode(node: React.ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(node)
  })

  return { container, root }
}

async function flushDebugConsoleWork(): Promise<void> {
  await act(async () => {
    vi.runOnlyPendingTimers()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function dispatchTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ identifier: number; clientX: number; clientY: number }>,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: points,
  })
  window.dispatchEvent(event)
}

describe('App debug console touch gesture', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    resetDebugConsoleModules()
    window.__GAME_DEBUG__?.console.close()
    await import('./debug-console/DebugConsoleShell')
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('opens on a simultaneous three-finger hold', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    act(() => {
      dispatchTouchEvent('touchstart', [
        { identifier: 1, clientX: 10, clientY: 10 },
        { identifier: 2, clientX: 40, clientY: 10 },
        { identifier: 3, clientX: 70, clientY: 10 },
      ])
      vi.advanceTimersByTime(DEBUG_CONSOLE_TOUCH_HOLD_MS)
    })

    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(true)
    await flushDebugConsoleWork()
    act(() => {
      window.__GAME_DEBUG__.console.close()
    })

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('cancels the hold when a finger lifts before completion', () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    act(() => {
      dispatchTouchEvent('touchstart', [
        { identifier: 1, clientX: 10, clientY: 10 },
        { identifier: 2, clientX: 40, clientY: 10 },
        { identifier: 3, clientX: 70, clientY: 10 },
      ])
      dispatchTouchEvent('touchend', [
        { identifier: 1, clientX: 10, clientY: 10 },
        { identifier: 2, clientX: 40, clientY: 10 },
      ])
      vi.advanceTimersByTime(DEBUG_CONSOLE_TOUCH_HOLD_MS)
    })

    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(false)

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('cancels the hold when touches drift too far', () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    act(() => {
      dispatchTouchEvent('touchstart', [
        { identifier: 1, clientX: 10, clientY: 10 },
        { identifier: 2, clientX: 40, clientY: 10 },
        { identifier: 3, clientX: 70, clientY: 10 },
      ])
      dispatchTouchEvent('touchmove', [
        {
          identifier: 1,
          clientX: 10 + DEBUG_CONSOLE_TOUCH_MAX_DRIFT_PX + 1,
          clientY: 10,
        },
        { identifier: 2, clientX: 40, clientY: 10 },
        { identifier: 3, clientX: 70, clientY: 10 },
      ])
      vi.advanceTimersByTime(DEBUG_CONSOLE_TOUCH_HOLD_MS)
    })

    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(false)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
