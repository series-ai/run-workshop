import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import App from './App'
import {
  registerDebugConsoleModule,
  resetDebugConsoleModules,
} from './debug-console/modules'
import { listTabs } from './shell/navigation'
import { NAVIGATION, DEFAULT_TAB_ID } from './tabs/tabConfig'
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider'
import appConfig from '../config.json'

// Read tab IDs dynamically so this test passes in every consumer project,
// regardless of how they customize the tab bar. Tests navigate to a tab that
// is NOT the default so the "navigated to new screen" assertion is meaningful.
const TAB_IDS = listTabs(NAVIGATION).map(({ id }) => id)
const ALT_TAB_ID = TAB_IDS.find((id) => id !== DEFAULT_TAB_ID) ?? DEFAULT_TAB_ID

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

  throw new Error('Timed out waiting for debug console condition')
}

describe('App debug console command palette', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    resetDebugConsoleModules()
    window.__GAME_DEBUG__?.console.close()
    window.__GAME_DEBUG__?.ui.reset()
    await import('./debug-console/DebugConsoleShell')
  })

  it('shows the release version in the debug console header', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()

    expect(container.textContent).toContain(`v${appConfig.appData.versionTag}`)

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('executes a structured command form and records the result in the execution log', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()
    await waitForCondition(() => container.textContent?.includes('Open Screen') ?? false)

    expect(container.textContent).toContain('Command Palette')

    const openScreenButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Open Screen'))
    expect(openScreenButton).toBeTruthy()

    await act(async () => {
      openScreenButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const screenSelect = container.querySelector('select[aria-label="Open Screen Screen"]') as HTMLSelectElement | null
    expect(screenSelect).not.toBeNull()

    await act(async () => {
      if (screenSelect) {
        screenSelect.value = ALT_TAB_ID
        screenSelect.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await Promise.resolve()
    })

    const runCommandButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Run Command'))
    expect(runCommandButton).toBeTruthy()

    await act(async () => {
      runCommandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(window.__GAME_DEBUG__.ui.getCurrentScreen()).toBe(ALT_TAB_ID)
    expect(container.textContent).toContain('Execution Log')
    expect(container.textContent).toContain('open-screen')
    expect(container.textContent).toContain('success')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('executes text commands through the same palette runtime', async () => {
    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()
    await waitForCondition(() => container.textContent?.includes('Open Screen') ?? false)

    const commandInput = container.querySelector('input[aria-label="Debug command input"]') as HTMLInputElement | null
    expect(commandInput).not.toBeNull()

    await act(async () => {
      if (commandInput) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set
        setter?.call(commandInput, `screen ${ALT_TAB_ID}`)
        commandInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
      await Promise.resolve()
    })

    const runTextButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Run Text'))
    expect(runTextButton).toBeTruthy()

    await act(async () => {
      runTextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(window.__GAME_DEBUG__.ui.getCurrentScreen()).toBe(ALT_TAB_ID)
    expect(container.textContent).toContain('open-screen')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('supports autocomplete-backed fuzzy matching and semantic number/textarea fields', async () => {
    registerDebugConsoleModule({
      id: 'grant-fixtures',
      title: 'Grant Fixtures',
      commands: [
        {
          id: 'grant-notes',
          label: 'Grant Notes',
          aliases: ['notes-grant'],
          schema: z.object({
            amount: z.coerce.number().int().positive(),
            note: z.string().min(1),
          }),
          fields: [
            {
              key: 'amount',
              label: 'Amount',
              kind: 'number',
            },
            {
              key: 'note',
              label: 'Note',
              kind: 'textarea',
            },
          ],
          execute: async () => ({ ok: true }),
        },
      ],
      render: () => null,
    })

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()
    await waitForCondition(() => container.textContent?.includes('Grant Notes') ?? false)

    const commandInput = container.querySelector('input[aria-label="Debug command input"]') as HTMLInputElement | null
    expect(commandInput?.getAttribute('list')).toBe('debug-command-autocomplete')
    expect(container.querySelectorAll('#debug-command-autocomplete option').length).toBeGreaterThan(0)

    await act(async () => {
      if (commandInput) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set
        setter?.call(commandInput, 'gntnts')
        commandInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await flushDebugConsoleWork()

    expect(container.textContent).toContain('Grant Notes')

    const grantNotesButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Grant Notes'))
    expect(grantNotesButton).toBeTruthy()

    await act(async () => {
      grantNotesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushDebugConsoleWork()

    const amountInput = container.querySelector(
      'input[type="number"][aria-label="Grant Notes Amount"]',
    ) as HTMLInputElement | null
    const noteTextarea = container.querySelector(
      'textarea[aria-label="Grant Notes Note"]',
    ) as HTMLTextAreaElement | null

    expect(amountInput).not.toBeNull()
    expect(noteTextarea).not.toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('captures toggle field changes before executing a structured command', async () => {
    const runToggleFixture = vi.fn(async () => ({ ok: true }))

    registerDebugConsoleModule({
      id: 'toggle-fixtures',
      title: 'Toggle Fixtures',
      commands: [
        {
          id: 'set-toggle-fixture',
          label: 'Set Toggle Fixture',
          schema: z.object({
            enabled: z.boolean(),
          }),
          fields: [
            {
              key: 'enabled',
              label: 'Enabled',
              kind: 'toggle',
            },
          ],
          execute: runToggleFixture,
        },
      ],
      render: () => null,
    })

    const { container, root } = renderNode(
      <UiThemeProvider>
        <App />
      </UiThemeProvider>,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }))
    })
    await flushDebugConsoleWork()
    await waitForCondition(() => container.textContent?.includes('Set Toggle Fixture') ?? false)

    const toggleFixtureButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Set Toggle Fixture'))
    expect(toggleFixtureButton).toBeTruthy()

    await act(async () => {
      toggleFixtureButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await flushDebugConsoleWork()

    const enabledToggle = container.querySelector(
      'input[type="checkbox"][aria-label="Set Toggle Fixture Enabled"]',
    ) as HTMLInputElement | null
    expect(enabledToggle).not.toBeNull()

    await act(async () => {
      if (enabledToggle) {
        enabledToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
      await Promise.resolve()
    })
    await flushDebugConsoleWork()

    expect(enabledToggle?.checked).toBe(true)

    const runCommandButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Run Command'))
    expect(runCommandButton).toBeTruthy()

    await act(async () => {
      runCommandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await flushDebugConsoleWork()

    expect(runToggleFixture).toHaveBeenCalledWith(
      { enabled: true },
      expect.anything(),
    )
    expect(container.textContent).toContain('success')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
