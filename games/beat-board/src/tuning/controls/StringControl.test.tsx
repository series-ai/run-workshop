import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { StringControl } from './StringControl'

describe('<StringControl />', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.error).mockReset()
  })

  it('renders a select when options are provided and fires set on change', () => {
    const set = vi.fn()
    render(
      <StringControl
        descriptor={{
          id: 'mode',
          label: 'Mode',
          folder: 'Settings',
          type: 'string',
          options: ['easy', 'normal', 'hard'],
          initialValue: 'normal',
          get: () => 'normal',
          set,
        }}
      />,
    )

    const select = screen.getByTestId('tuning-control-mode') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    fireEvent.change(select, { target: { value: 'hard' } })

    expect(set).toHaveBeenCalledWith('hard')
  })

  it('renders a text input without options and fires set on blur', () => {
    const set = vi.fn()
    render(
      <StringControl
        descriptor={{
          id: 'name',
          label: 'Name',
          folder: 'Settings',
          type: 'string',
          initialValue: 'alpha',
          get: () => 'alpha',
          set,
        }}
      />,
    )

    const input = screen.getByTestId('tuning-control-name') as HTMLInputElement
    expect(input.tagName).toBe('INPUT')
    expect(input.type).toBe('text')
    fireEvent.change(input, { target: { value: 'beta' } })
    expect(set).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(set).toHaveBeenCalledWith('beta')
  })

  it('fires set on Enter key press without waiting for blur', () => {
    const set = vi.fn()
    render(
      <StringControl
        descriptor={{
          id: 'tag',
          label: 'Tag',
          folder: 'Settings',
          type: 'string',
          initialValue: 'foo',
          get: () => 'foo',
          set,
        }}
      />,
    )

    const input = screen.getByTestId('tuning-control-tag') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'bar' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(set).toHaveBeenCalledWith('bar')
  })
})
