import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { BooleanControl } from './BooleanControl'

describe('<BooleanControl />', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.error).mockReset()
  })

  it('fires set with the new value when toggled', () => {
    const set = vi.fn()
    let state = false
    render(
      <BooleanControl
        descriptor={{
          id: 'sound',
          label: 'Sound',
          folder: 'Settings',
          type: 'boolean',
          initialValue: false,
          get: () => state,
          set: (next) => {
            state = next
            set(next)
          },
        }}
      />,
    )

    // BooleanControl wraps the Switch inside a label with data-testid on the label.
    const testIdEl = screen.getByTestId('tuning-control-sound')
    const input = testIdEl.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(input).toBeTruthy()
    fireEvent.click(input)

    expect(set).toHaveBeenCalledWith(true)
  })
})
