import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { Vec3Control } from './Vec3Control'
import {
  isPollingSuspended,
  resetPollingSuspensionForTesting,
} from '../polling'

describe('<Vec3Control />', () => {
  beforeEach(() => {
    vi.mocked(RundotAPI.error).mockReset()
    resetPollingSuspensionForTesting()
  })

  it('renders three labeled inputs (x, y, z)', () => {
    render(
      <Vec3Control
        descriptor={{
          id: 'pos',
          label: 'Position',
          folder: 'Scene',
          type: 'vec3',
          min: -10,
          max: 10,
          step: 0.5,
          initialValue: { x: 1, y: 2, z: 3 },
          get: () => ({ x: 1, y: 2, z: 3 }),
          set: () => undefined,
        }}
      />,
    )

    expect(screen.getByTestId('tuning-vec3-pos-x')).toBeInTheDocument()
    expect(screen.getByTestId('tuning-vec3-pos-y')).toBeInTheDocument()
    expect(screen.getByTestId('tuning-vec3-pos-z')).toBeInTheDocument()
  })

  it('fires set with the full { x, y, z } object and snaps the changed component', () => {
    const set = vi.fn()
    render(
      <Vec3Control
        descriptor={{
          id: 'pos',
          label: 'Position',
          folder: 'Scene',
          type: 'vec3',
          min: -10,
          max: 10,
          step: 0.5,
          initialValue: { x: 1, y: 2, z: 3 },
          get: () => ({ x: 1, y: 2, z: 3 }),
          set,
        }}
      />,
    )

    const yInput = screen.getByTestId('tuning-vec3-pos-y') as HTMLInputElement
    fireEvent.change(yInput, { target: { value: '3.7' } })

    // 3.7 snaps to 3.5 with step 0.5
    expect(set).toHaveBeenCalledWith({ x: 1, y: 3.5, z: 3 })
  })

  it('clamps out-of-range values on commit', () => {
    const set = vi.fn()
    render(
      <Vec3Control
        descriptor={{
          id: 'pos',
          label: 'Position',
          folder: 'Scene',
          type: 'vec3',
          min: -5,
          max: 5,
          step: 1,
          initialValue: { x: 0, y: 0, z: 0 },
          get: () => ({ x: 0, y: 0, z: 0 }),
          set,
        }}
      />,
    )

    fireEvent.change(screen.getByTestId('tuning-vec3-pos-x'), {
      target: { value: '100' },
    })

    expect(set).toHaveBeenCalledWith({ x: 5, y: 0, z: 0 })
  })

  it('suspends polling while a component is focused', () => {
    render(
      <Vec3Control
        descriptor={{
          id: 'pos',
          label: 'Position',
          folder: 'Scene',
          type: 'vec3',
          min: 0,
          max: 10,
          step: 1,
          initialValue: { x: 0, y: 0, z: 0 },
          get: () => ({ x: 0, y: 0, z: 0 }),
          set: () => undefined,
        }}
      />,
    )

    expect(isPollingSuspended('pos')).toBe(false)

    fireEvent.focus(screen.getByTestId('tuning-vec3-pos-x'))
    expect(isPollingSuspended('pos')).toBe(true)

    fireEvent.blur(screen.getByTestId('tuning-vec3-pos-x'))
    expect(isPollingSuspended('pos')).toBe(false)
  })
})
