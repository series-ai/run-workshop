import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { ColorControl } from './ColorControl'
import {
  isPollingSuspended,
  resetPollingSuspensionForTesting,
} from '../polling'

describe('<ColorControl />', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.error).mockReset()
    resetPollingSuspensionForTesting()
  })

  it('renders a swatch button with the current hex value', () => {
    render(
      <ColorControl
        descriptor={{
          id: 'tint',
          label: 'Tint',
          folder: 'Color',
          type: 'color',
          initialValue: '#ff00aa',
          get: () => '#ff00aa',
          set: () => undefined,
        }}
      />,
    )

    const swatch = screen.getByTestId('tuning-control-tint')
    expect(swatch).toBeInTheDocument()
    expect(swatch.textContent).toContain('#ff00aa')
  })

  it('suspends polling while the popover is open and resumes on close', () => {
    render(
      <ColorControl
        descriptor={{
          id: 'tint',
          label: 'Tint',
          folder: 'Color',
          type: 'color',
          initialValue: '#ff00aa',
          get: () => '#ff00aa',
          set: () => undefined,
        }}
      />,
    )

    expect(isPollingSuspended('tint')).toBe(false)
    fireEvent.click(screen.getByTestId('tuning-control-tint'))
    expect(isPollingSuspended('tint')).toBe(true)
    expect(screen.getByTestId('tuning-color-popover-tint')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('tuning-control-tint'))
    expect(isPollingSuspended('tint')).toBe(false)
  })

  it('fires set with a lowercased hex on color change', () => {
    const set = vi.fn()
    render(
      <ColorControl
        descriptor={{
          id: 'tint',
          label: 'Tint',
          folder: 'Color',
          type: 'color',
          initialValue: '#ff00aa',
          get: () => '#ff00aa',
          set,
        }}
      />,
    )

    fireEvent.click(screen.getByTestId('tuning-control-tint'))
    fireEvent.change(screen.getByTestId('tuning-color-input-tint'), {
      target: { value: '#AABBCC' },
    })

    expect(set).toHaveBeenCalledWith('#aabbcc')
  })

  it('emits 8-digit hex values when alpha is enabled', () => {
    const set = vi.fn()
    render(
      <ColorControl
        descriptor={{
          id: 'tint',
          label: 'Tint',
          folder: 'Color',
          type: 'color',
          alpha: true,
          initialValue: '#ff00aa80',
          get: () => '#ff00aa80',
          set,
        }}
      />,
    )

    fireEvent.click(screen.getByTestId('tuning-control-tint'))
    fireEvent.change(screen.getByTestId('tuning-color-alpha-tint'), {
      target: { value: '255' },
    })

    expect(set).toHaveBeenCalledWith('#ff00aaff')
  })
})
