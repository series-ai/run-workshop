import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import {
  registerDebugConsoleModule,
  resetDebugConsoleModules,
} from './debug-console/modules'
import { listTabs } from './shell/navigation'
import { NAVIGATION, DEFAULT_TAB_ID } from './tabs/tabConfig'
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider'

// Read tab IDs dynamically so this test passes in every consumer project,
// regardless of how they customize the tab bar.
const TAB_IDS = listTabs(NAVIGATION).map(({ id }) => id)
const FIRST_TAB_ID = DEFAULT_TAB_ID
const ALT_TAB_ID = TAB_IDS.find((id) => id !== FIRST_TAB_ID) ?? FIRST_TAB_ID

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

  throw new Error('Timed out waiting for app debug console condition')
}

describe.skip('App debug console hotkeys', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    resetDebugConsoleModules()
    window.__GAME_DEBUG__?.console.close()
    await import('./debug-console/DebugConsoleShell')
  })

  it('toggles the debug console when backquote is pressed', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(false)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()

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

  it('renders a debug console sheet with diagnostics when opened', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await waitForCondition(() => container.textContent?.includes(FIRST_TAB_ID) ?? false)

    expect(container.textContent).toContain('Debug Console')
    expect(container.textContent).toContain(FIRST_TAB_ID)
    expect(container.textContent).toContain('player')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders modules registered after the shell has already opened', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await waitForCondition(() => container.textContent?.includes(FIRST_TAB_ID) ?? false)

    expect(container.textContent).not.toContain('Support Tools')

    await act(async () => {
      registerDebugConsoleModule({
        id: 'support-tools',
        title: 'Support Tools',
        render: () => <div>Support Tools</div>,
      })
    })
    await waitForCondition(() => container.textContent?.includes('Support Tools') ?? false)

    expect(container.textContent).toContain('Support Tools')

    act(() => {
      window.__GAME_DEBUG__.console.close()
    })

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('updates the diagnostics screen label while the shell remains open', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await waitForCondition(() => container.textContent?.includes(FIRST_TAB_ID) ?? false)

    expect(container.textContent).toContain(FIRST_TAB_ID)

    await act(async () => {
      window.__GAME_DEBUG__.ui.openScreen(ALT_TAB_ID)
    })
    await waitForCondition(() => container.textContent?.includes(ALT_TAB_ID) ?? false)

    expect(container.textContent).toContain(ALT_TAB_ID)

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('ignores the backquote shortcut while typing in an input', () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <input aria-label="chat input" />
        <App />
      </UiThemeProvider>,
    )

    const input = container.querySelector('input')
    expect(input).not.toBeNull()

    act(() => {
      input?.focus()
    })

    expect(document.activeElement).toBe(input)
    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(false)

    act(() => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Backquote' }))
    })

    expect(window.__GAME_DEBUG__.console.isOpen()).toBe(false)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
