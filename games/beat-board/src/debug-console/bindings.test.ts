import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDebugConsoleBindingsForTesting,
  getDebugConsoleBinding,
  registerDebugConsoleBinding,
  subscribeToDebugConsoleBindings,
  unregisterDebugConsoleBinding,
} from './bindings'

describe('debug console bindings', () => {
  beforeEach(() => {
    clearDebugConsoleBindingsForTesting()
  })

  it('registers and unregisters bindings', () => {
    const binding = { ready: true }
    const dispose = registerDebugConsoleBinding('data/storage-service:service', binding)

    expect(getDebugConsoleBinding('data/storage-service:service')).toBe(binding)

    dispose()

    expect(getDebugConsoleBinding('data/storage-service:service')).toBeUndefined()
  })

  it('does not remove a replacement binding when an older disposer runs', () => {
    const first = { revision: 1 }
    const second = { revision: 2 }

    const disposeFirst = registerDebugConsoleBinding('systems/inventory:store', first)
    registerDebugConsoleBinding('systems/inventory:store', second)

    disposeFirst()

    expect(getDebugConsoleBinding('systems/inventory:store')).toBe(second)
  })

  it('notifies subscribers when bindings change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToDebugConsoleBindings(listener)

    registerDebugConsoleBinding('data/server-time:service', { sync: vi.fn() })
    unregisterDebugConsoleBinding('data/server-time:service')

    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })
})
