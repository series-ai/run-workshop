import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearTuningRegistryForTesting,
  getRegisteredTunable,
} from './registry'
import type { NumberTunableDescriptor } from './registry'
import { useTunable } from './useTunable'

function TestConsumer({ descriptor }: { descriptor: NumberTunableDescriptor }) {
  useTunable(descriptor)
  return null
}

function buildDescriptor(
  overrides: Partial<NumberTunableDescriptor> = {},
): NumberTunableDescriptor {
  return {
    id: 'hook:value',
    label: 'Value',
    folder: 'Hooks',
    type: 'number',
    min: 0,
    max: 10,
    step: 1,
    initialValue: 5,
    get: () => 5,
    set: () => undefined,
    ...overrides,
  }
}

describe('useTunable', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
  })

  it('registers the descriptor on mount and disposes on unmount', () => {
    const descriptor = buildDescriptor()
    const { unmount } = render(<TestConsumer descriptor={descriptor} />)

    expect(getRegisteredTunable('hook:value')).toBe(descriptor)

    unmount()

    expect(getRegisteredTunable('hook:value')).toBeUndefined()
  })

  it('re-registers when the descriptor id changes across renders', () => {
    const first = buildDescriptor({ id: 'hook:a' })
    const second = buildDescriptor({ id: 'hook:b' })

    const { rerender, unmount } = render(
      <TestConsumer descriptor={first} />,
    )
    expect(getRegisteredTunable('hook:a')).toBe(first)

    rerender(<TestConsumer descriptor={second} />)
    expect(getRegisteredTunable('hook:a')).toBeUndefined()
    expect(getRegisteredTunable('hook:b')).toBe(second)

    unmount()
  })
})
