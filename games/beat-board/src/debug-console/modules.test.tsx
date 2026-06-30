import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createDebugConsoleAccess } from './access'
import {
  clearDebugConsoleBindingsForTesting,
  registerDebugConsoleBinding,
} from './bindings'
import {
  ensureDebugConsoleModulesLoaded,
  getVisibleDebugConsoleModules,
  listDebugConsoleModules,
  registerDebugConsoleModule,
  resetDebugConsoleModules,
  setDebugConsoleModuleSourcesForTesting,
} from './modules'

describe('debug console module registry', () => {
  beforeEach(() => {
    clearDebugConsoleBindingsForTesting()
    setDebugConsoleModuleSourcesForTesting({})
    resetDebugConsoleModules()
  })

  it('supports runtime registration and unregistration without shell rewiring', () => {
    const unregister = registerDebugConsoleModule({
      id: 'support-tools',
      title: 'Support Tools',
      render: () => null,
    })

    expect(listDebugConsoleModules().map((module) => module.id)).toContain('support-tools')

    unregister()

    expect(listDebugConsoleModules().map((module) => module.id)).not.toContain('support-tools')
  })

  it('filters modules by minimum access threshold', () => {
    registerDebugConsoleModule({
      id: 'editor-tools',
      title: 'Editor Tools',
      minimumRole: 'editor',
      render: () => null,
    })

    expect(
      getVisibleDebugConsoleModules(createDebugConsoleAccess('player')).map((module) => module.id),
    ).not.toContain('editor-tools')

    expect(
      getVisibleDebugConsoleModules(createDebugConsoleAccess('owner')).map((module) => module.id),
    ).toContain('editor-tools')
  })

  it('hydrates discovered module files without central registry edits', async () => {
    const createNavigationModule = () => ({
      id: 'navigation',
      title: 'Navigation',
      render: () => null,
    })
    const createSupportModule = () => ([
      {
        id: 'support-tools',
        title: 'Support Tools',
        minimumRole: 'editor',
        render: () => null,
      },
    ])

    setDebugConsoleModuleSourcesForTesting({
      '../features/navigation.debug-console.ts': {
        createDebugConsoleModule: createNavigationModule,
      },
      '../features/support.debug-console.ts': {
        createDebugConsoleModule: createSupportModule,
      },
      '../features/ignored.debug-console.ts': {},
    })

    resetDebugConsoleModules()

    expect(listDebugConsoleModules()).toEqual([])

    await ensureDebugConsoleModulesLoaded()

    expect(listDebugConsoleModules().map((module) => module.id)).toEqual([
      'navigation',
      'support-tools',
    ])
  })

  it('treats missing discovered module exports as absence instead of failure', () => {
    setDebugConsoleModuleSourcesForTesting({
      '../features/ignored.debug-console.ts': {},
    })

    resetDebugConsoleModules()

    expect(listDebugConsoleModules()).toEqual([])
  })

  it('does not invoke discovered module factories until explicitly loaded', async () => {
    const createModule = vi.fn(() => ({
      id: 'lazy-tools',
      title: 'Lazy Tools',
      render: () => null,
    }))

    setDebugConsoleModuleSourcesForTesting({
      '../features/lazy.debug-console.ts': {
        createDebugConsoleModule: createModule,
      },
    })

    resetDebugConsoleModules()

    expect(createModule).not.toHaveBeenCalled()
    expect(listDebugConsoleModules()).toEqual([])

    await ensureDebugConsoleModulesLoaded()

    expect(createModule).toHaveBeenCalledTimes(1)
    expect(listDebugConsoleModules().map((module) => module.id)).toEqual(['lazy-tools'])
  })

  it('passes live binding lookups through the bootstrap context', async () => {
    const binding = { label: 'storage' }
    registerDebugConsoleBinding('data/storage-service:service', binding)

    const createModule = vi.fn((context) => ({
      id: 'binding-aware',
      title: 'Binding Aware',
      render: () => null,
      commands: [
        {
          id: 'binding-aware:ping',
          label: 'Ping',
          schema: z.object({}),
          isEnabled: () => context.getBinding('data/storage-service:service') === binding,
          execute: () => 'ok',
        },
      ],
    }))

    setDebugConsoleModuleSourcesForTesting({
      '../features/binding-aware.debug-console.ts': {
        createDebugConsoleModule: createModule,
      },
    })

    await ensureDebugConsoleModulesLoaded()

    const [module] = listDebugConsoleModules()
    expect(module?.commands?.[0]?.isEnabled?.({
      access: createDebugConsoleAccess('editor'),
      currentScreen: 'home',
      args: {},
    })).toBe(true)
  })
})
