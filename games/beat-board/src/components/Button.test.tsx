import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider'
import { Button } from './Button'

describe('Button', () => {
  function renderNode(node: React.ReactNode): { container: HTMLDivElement; root: Root } {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(node)
    })

    return { container, root }
  }

  it('renders a button element by default', () => {
    const { container, root } = renderNode(
      <UiThemeProvider as="div">
        <Button>Play</Button>
      </UiThemeProvider>,
    )

    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Play')
    expect(button?.getAttribute('type')).toBe('button')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('maps the wrapper to the semantic button surface', () => {
    const { container, root } = renderNode(
      <UiThemeProvider as="div">
        <Button variant="secondary">Play now</Button>
      </UiThemeProvider>,
    )

    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Play now')
    expect(button?.getAttribute('data-ui-skin-role')).toBe('button.secondary')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('forwards refs to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>()

    const { container, root } = renderNode(
      <UiThemeProvider as="div">
        <Button ref={ref}>Ref target</Button>
      </UiThemeProvider>,
    )

    const button = container.querySelector('button')
    expect(ref.current).toBe(button)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
