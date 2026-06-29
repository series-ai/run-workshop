import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from './debug-console/access'
import {
  clearTuningRegistryForTesting,
  registerTunable,
} from './tuning/registry'
import { resetTuningOverlayStateForTesting } from './tuning/state'
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

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

describe('App tuning overlay mount', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearTuningRegistryForTesting()
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
  })

  it('does not render the tuning overlay when the deviceCache preference is absent', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await flushEffects()

    expect(container.querySelector('[data-testid="tuning-overlay"]')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('restores the tuning overlay from deviceCache on boot for an editor user', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockImplementation(async (key: string) => {
      if (key === 'series-game-core:tuning-overlay-enabled') return 'true'
      return null
    })

    registerTunable({
      id: 'demo:alpha',
      label: 'Alpha',
      folder: 'Demo',
      type: 'number',
      min: 0,
      max: 10,
      step: 1,
      initialValue: 5,
      get: () => 5,
      set: () => undefined,
    })

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await flushEffects()

    expect(RundotAPI.deviceCache.getItem).toHaveBeenCalledWith(
      'series-game-core:tuning-overlay-enabled',
    )
    expect(container.querySelector('[data-testid="tuning-overlay"]')).not.toBeNull()
    expect(container.textContent).toContain('Alpha')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('keeps the tuning overlay hidden when the user is below editor access', async () => {
    setDebugConsoleAccessOverride('player')
    vi.mocked(RundotAPI.deviceCache.getItem).mockImplementation(async (key: string) => {
      if (key === 'series-game-core:tuning-overlay-enabled') return 'true'
      return null
    })

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await flushEffects()

    expect(container.querySelector('[data-testid="tuning-overlay"]')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
