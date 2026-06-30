import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  recordDebugAnimationFrame,
  refreshDebugMemorySample,
} from './debug-console/performance'
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
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

async function waitForCondition(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return
    }
    await flushDebugConsoleWork()
  }

  throw new Error('Timed out waiting for performance overlay condition')
}

describe('App performance overlay', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
    Object.defineProperty(performance, 'memory', {
      configurable: true,
      value: undefined,
    })
    await import('./debug-console/DebugConsoleShell')
  })

  it('restores the overlay preference from deviceCache on boot', async () => {
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValueOnce('true')

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(RundotAPI.deviceCache.getItem).toHaveBeenCalledWith(
      'series-game-core:debug-console:performance-overlay-enabled',
    )

    const overlay = container.querySelector('[data-testid="debug-performance-overlay"]')
    expect(overlay).not.toBeNull()
    expect(overlay?.textContent).toContain('FPS')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('lets the console toggle the overlay while the overlay stays visible after the sheet closes', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await waitForCondition(() => (
      container.querySelector('[data-debug-console-module-id="performance"] button') !== null
    ))

    const toggleButton = container.querySelector(
      '[data-debug-console-module-id="performance"] button',
    ) as HTMLButtonElement | null

    expect(toggleButton).not.toBeNull()

    await act(async () => {
      toggleButton?.click()
      await Promise.resolve()
    })

    expect(RundotAPI.deviceCache.setItem).toHaveBeenCalledWith(
      'series-game-core:debug-console:performance-overlay-enabled',
      'true',
    )
    expect(container.querySelector('[data-testid="debug-performance-overlay"]')).not.toBeNull()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Debug Console')
    expect(container.querySelector('[data-testid="debug-performance-overlay"]')).not.toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('shows sampled history in the performance module and lets the user clear it', async () => {
    Object.defineProperty(performance, 'memory', {
      configurable: true,
      value: { usedJSHeapSize: 50 * 1024 * 1024 },
    })

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await waitForCondition(() => (
      container.querySelector('[data-debug-console-module-id="performance"] button') !== null
    ))

    act(() => {
      recordDebugAnimationFrame(0)
      recordDebugAnimationFrame(1000)
      refreshDebugMemorySample(1000)
    })

    await flushDebugConsoleWork()
    await waitForCondition(() => container.textContent?.includes('50 MB') ?? false)

    expect(container.textContent).toContain('50 MB')

    const resetButton = Array.from(
      container.querySelectorAll('[data-debug-console-module-id="performance"] button'),
    ).find((button) => button.textContent?.includes('Reset History'))

    expect(resetButton).not.toBeUndefined()

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('No samples')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
