import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from '../debug-console/access'
import {
  clearTuningRegistryForTesting,
  registerTunable,
} from './registry'
import type { NumberTunableDescriptor } from './registry'
import { resetTuningOverlayStateForTesting } from './state'
import { resetPollingSuspensionForTesting } from './polling'
import { TuningOverlay } from './TuningOverlay'

async function mountVisibleOverlay(): Promise<void> {
  // loadTuningOverlayPreference() fires inside the component's effect. Flushing
  // pending microtasks lets it settle before the test asserts the rendered UI.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function buildNumberDescriptor(
  overrides: Partial<NumberTunableDescriptor> = {},
): NumberTunableDescriptor {
  return {
    id: 'jump:jumpHeight',
    label: 'Jump Height',
    folder: 'Jump',
    type: 'number',
    min: 0,
    max: 20,
    step: 0.5,
    initialValue: 10,
    get: () => 10,
    set: () => undefined,
    ...overrides,
  }
}

describe('<TuningOverlay />', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    vi.mocked(RundotAPI.error).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
    resetPollingSuspensionForTesting()
  })

  it('returns null while the overlay is hidden', () => {
    const { container } = render(<TuningOverlay />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not call any tunable get callback while hidden', async () => {
    const get = vi.fn(() => 10)
    registerTunable(buildNumberDescriptor({ get }))

    render(<TuningOverlay />)

    expect(get).not.toHaveBeenCalled()
  })

  it('renders registered tunables grouped by folder when visible', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')
    registerTunable(buildNumberDescriptor({ id: 'jump:jumpHeight', folder: 'Jump', label: 'Jump Height' }))
    registerTunable(
      buildNumberDescriptor({
        id: 'ai:aggression',
        folder: 'AI/Decisions',
        label: 'Aggression',
        initialValue: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
        get: () => 0.5,
      }),
    )

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    expect(screen.getByTestId('tuning-overlay')).toBeInTheDocument()
    expect(screen.getByText('Jump Height')).toBeInTheDocument()
    expect(screen.getByText('Aggression')).toBeInTheDocument()
    expect(screen.getByTestId('tuning-folder-Jump')).toBeInTheDocument()
    expect(screen.getByTestId('tuning-folder-AI')).toBeInTheDocument()
    expect(screen.getByTestId('tuning-folder-AI/Decisions')).toBeInTheDocument()
  })

  it('shows tunables registered after the overlay is already visible', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    await act(async () => {
      registerTunable(buildNumberDescriptor())
    })

    expect(screen.getByText('Jump Height')).toBeInTheDocument()
  })

  it('does not render descriptors with enabled: false and does not call their get callback', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    const disabledGet = vi.fn(() => 5)
    registerTunable(
      buildNumberDescriptor({
        id: 'hidden:value',
        folder: 'Hidden',
        label: 'Hidden Value',
        enabled: false,
        get: disabledGet,
      }),
    )
    registerTunable(
      buildNumberDescriptor({
        id: 'shown:value',
        folder: 'Shown',
        label: 'Shown Value',
      }),
    )

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    expect(screen.getByText('Shown Value')).toBeInTheDocument()
    expect(screen.queryByText('Hidden Value')).not.toBeInTheDocument()
    expect(disabledGet).not.toHaveBeenCalled()
  })

  it('stays null when the user is below editor access, even when deviceCache is true', async () => {
    setDebugConsoleAccessOverride('player')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    const { container } = render(<TuningOverlay />)
    await mountVisibleOverlay()

    expect(container).toBeEmptyDOMElement()
  })

  it('unmounts folder contents when the folder is collapsed (getter not called while collapsed)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setDebugConsoleAccessOverride('editor')
      vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

      const get = vi.fn(() => 5)
      registerTunable(
        buildNumberDescriptor({
          id: 'physics:gravity',
          folder: 'Physics',
          label: 'Gravity',
          get,
        }),
      )

      render(<TuningOverlay />)
      await mountVisibleOverlay()

      expect(screen.getByText('Gravity')).toBeInTheDocument()
      expect(get).toHaveBeenCalled()

      const callsBeforeCollapse = get.mock.calls.length

      fireEvent.click(screen.getByTestId('tuning-folder-toggle-Physics'))

      expect(screen.queryByText('Gravity')).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2_000)
      })

      expect(get.mock.calls.length).toBe(callsBeforeCollapse)
    } finally {
      vi.useRealTimers()
    }
  })

  it('wraps the panel in a pointer-events: none container with pointer-events: auto on the panel', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    const container = screen.getByTestId('tuning-overlay-container')
    const panel = screen.getByTestId('tuning-overlay')

    expect(container.style.pointerEvents).toBe('none')
    expect(panel.style.pointerEvents).toBe('auto')
  })

  it('can be minimized to a handle that toggles back to the full panel', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    fireEvent.click(screen.getByTestId('tuning-overlay-minimize'))

    const minimized = screen.getByTestId('tuning-overlay')
    expect(minimized.getAttribute('data-minimized')).toBe('true')
    expect(screen.getByTestId('tuning-overlay-expand')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('tuning-overlay-expand'))

    expect(
      screen.getByTestId('tuning-overlay').getAttribute('data-minimized'),
    ).not.toBe('true')
  })

  it('isolates a throwing get callback — logs via RundotAPI.error and still renders other tunables', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')
    registerTunable(
      buildNumberDescriptor({
        id: 'broken:value',
        folder: 'Physics',
        label: 'Broken Value',
        get: () => {
          throw new Error('boom')
        },
      }),
    )
    registerTunable(
      buildNumberDescriptor({
        id: 'ok:value',
        folder: 'Physics',
        label: 'Working Value',
      }),
    )

    render(<TuningOverlay />)
    await mountVisibleOverlay()

    expect(screen.getByText('Working Value')).toBeInTheDocument()
    expect(screen.getByText('Broken Value')).toBeInTheDocument()
    expect(vi.mocked(RundotAPI.error)).toHaveBeenCalled()
  })
})
