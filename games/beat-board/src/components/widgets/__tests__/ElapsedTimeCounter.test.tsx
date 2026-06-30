import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import * as React from 'react'

import {
  ElapsedTimeCounter,
  formatElapsed,
} from '../ElapsedTimeCounter'
import {
  useRecordingStore,
  resetRecordingStore,
} from '../../../stores/recordingStore'

const h = React.createElement

beforeEach(() => {
  resetRecordingStore()
})

afterEach(() => {
  cleanup()
  resetRecordingStore()
})

describe('formatElapsed', () => {
  it('zero pads single-digit seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(7)).toBe('0:07')
  })
  it('crosses the minute boundary', () => {
    expect(formatElapsed(60)).toBe('1:00')
    expect(formatElapsed(83)).toBe('1:23')
  })
  it('floors fractional seconds', () => {
    expect(formatElapsed(23.7)).toBe('0:23')
  })
  it('clamps negatives to 0:00', () => {
    expect(formatElapsed(-5)).toBe('0:00')
  })
  it('handles 10+ minute takes', () => {
    expect(formatElapsed(625)).toBe('10:25')
  })
})

describe('ElapsedTimeCounter', () => {
  it('renders nothing when status is idle', () => {
    render(h(ElapsedTimeCounter))
    expect(screen.queryByTestId('recording-elapsed')).not.toBeInTheDocument()
  })

  it('renders MM:SS while capturing', () => {
    useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 5 })
    render(h(ElapsedTimeCounter))
    expect(screen.getByTestId('recording-elapsed')).toHaveTextContent('0:05')
  })

  it('updates when elapsed changes', () => {
    useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 1 })
    render(h(ElapsedTimeCounter))
    act(() => {
      useRecordingStore.setState({ elapsedSeconds: 70 })
    })
    expect(screen.getByTestId('recording-elapsed')).toHaveTextContent('1:10')
  })

  it('hides once status returns to idle', () => {
    useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 12 })
    render(h(ElapsedTimeCounter))
    expect(screen.getByTestId('recording-elapsed')).toBeInTheDocument()
    act(() => {
      useRecordingStore.setState({ status: 'idle', elapsedSeconds: 0 })
    })
    expect(screen.queryByTestId('recording-elapsed')).not.toBeInTheDocument()
  })
})
