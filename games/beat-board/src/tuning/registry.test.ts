import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  clearTuningRegistryForTesting,
  getRegisteredTunable,
  getTunableIds,
  registerTunable,
  resetAllTunables,
  subscribeToTuningRegistry,
} from './registry'
import type { NumberTunableDescriptor } from './registry'

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

describe('tuning registry', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
  })

  it('registers a tunable and returns a disposer that removes it', () => {
    const descriptor = buildNumberDescriptor()

    const dispose = registerTunable(descriptor)

    expect(getRegisteredTunable('jump:jumpHeight')).toBe(descriptor)

    dispose()

    expect(getRegisteredTunable('jump:jumpHeight')).toBeUndefined()
  })

  it('throws synchronously when the descriptor fails validation (min > max)', () => {
    expect(() =>
      registerTunable(buildNumberDescriptor({ min: 100, max: 0 })),
    ).toThrow(/min.*max/i)
    expect(getTunableIds()).toEqual([])
  })

  it('does not call the descriptor get callback at registration time', () => {
    const get = vi.fn(() => 10)
    registerTunable(buildNumberDescriptor({ get }))

    expect(get).not.toHaveBeenCalled()
  })

  it('notifies registry subscribers when a tunable is registered and when it is disposed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTuningRegistry(listener)

    const dispose = registerTunable(buildNumberDescriptor())
    expect(listener).toHaveBeenCalledTimes(1)

    dispose()
    expect(listener).toHaveBeenCalledTimes(2)

    expect(getTunableIds()).toEqual([])

    unsubscribe()
  })

  it('replaces a previous descriptor when the same id is re-registered and makes the first disposer a no-op', () => {
    const first = buildNumberDescriptor({ initialValue: 1 })
    const second = buildNumberDescriptor({ initialValue: 2 })

    const disposeFirst = registerTunable(first)
    registerTunable(second)

    expect(getRegisteredTunable('jump:jumpHeight')).toBe(second)

    disposeFirst()

    expect(getRegisteredTunable('jump:jumpHeight')).toBe(second)
  })
})

describe('resetAllTunables', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
    vi.mocked(RundotAPI.error).mockReset()
  })

  it('invokes each setter with its initialValue', () => {
    const setA = vi.fn()
    const setB = vi.fn()
    registerTunable(buildNumberDescriptor({ id: 'a', initialValue: 3, set: setA }))
    registerTunable(buildNumberDescriptor({ id: 'b', initialValue: 7, set: setB }))

    resetAllTunables()

    expect(setA).toHaveBeenCalledWith(3)
    expect(setB).toHaveBeenCalledWith(7)
  })

  it('continues past a throwing setter and logs via RundotAPI.error', () => {
    const setOk = vi.fn()
    registerTunable(
      buildNumberDescriptor({
        id: 'boom',
        initialValue: 1,
        set: () => {
          throw new Error('boom')
        },
      }),
    )
    registerTunable(buildNumberDescriptor({ id: 'ok', initialValue: 2, set: setOk }))

    expect(() => resetAllTunables()).not.toThrow()
    expect(setOk).toHaveBeenCalledWith(2)
    expect(vi.mocked(RundotAPI.error)).toHaveBeenCalled()
  })

  it('snapshots ids so a setter that unregisters its own tunable does not break iteration', () => {
    const setOther = vi.fn()
    registerTunable(
      buildNumberDescriptor({
        id: 'self-unregister',
        initialValue: 1,
        set: () => {
          clearTuningRegistryForTesting()
          registerTunable(
            buildNumberDescriptor({ id: 'other', initialValue: 2, set: setOther }),
          )
        },
      }),
    )
    registerTunable(
      buildNumberDescriptor({ id: 'other', initialValue: 9, set: setOther }),
    )

    expect(() => resetAllTunables()).not.toThrow()
  })
})
