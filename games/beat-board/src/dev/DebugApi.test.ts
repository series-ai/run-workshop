import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  resetDebugConsoleModules,
  setDebugConsoleModuleSourcesForTesting,
} from '../debug-console/modules'
import type { DebugConsoleModuleFactoryExport } from '../debug-console/types'
import { installDebugApi } from './DebugApi'

declare global {
  interface Window {
    __GAME_DEBUG__?: unknown
  }
}

describe('DebugApi', () => {
  beforeEach(() => {
    delete window.__GAME_DEBUG__
    vi.mocked(RundotAPI.getProfile).mockReset()
    vi.mocked(RundotAPI.getProfile).mockReturnValue({
      id: 'mock_user',
      username: 'MockUser',
      isAnonymous: false,
    })
    delete (RundotAPI as typeof RundotAPI & { app?: unknown }).app
    setDebugConsoleModuleSourcesForTesting(null)
    resetDebugConsoleModules()
  })

  it('installs a console namespace on the debug api', () => {
    installDebugApi()

    expect(window.__GAME_DEBUG__).toMatchObject({
      console: {
        isOpen: expect.any(Function),
        open: expect.any(Function),
        close: expect.any(Function),
        toggle: expect.any(Function),
        executeCommandById: expect.any(Function),
        executeTextCommand: expect.any(Function),
        getExecutionLog: expect.any(Function),
        getVisibleCommandIds: expect.any(Function),
      },
    })
    expect(window.__GAME_DEBUG__.console).not.toHaveProperty('installFeatureFlagsFixture')
    expect(window.__GAME_DEBUG__.console).not.toHaveProperty('clearTestModuleFixtures')
  })

  it('normalizes console access for an authenticated non-admin user', async () => {
    installDebugApi()

    const access = await window.__GAME_DEBUG__.console.getAccess()

    expect(access.role).toBe('player')
    expect(access.isOwner).toBe(false)
    expect(access.isEditor).toBe(false)
    expect(access.isPlayer).toBe(true)
    expect(access.canAccessAtLeast('player')).toBe(true)
    expect(access.canAccessAtLeast('editor')).toBe(false)
  })

  it('fails closed to anonymous access when role lookup throws', async () => {
    vi.mocked(RundotAPI.getProfile)
      .mockImplementationOnce(() => {
        throw new Error('profile lookup failed')
      })
      .mockImplementationOnce(() => {
        throw new Error('profile lookup failed')
      })

    installDebugApi()

    const access = await window.__GAME_DEBUG__.console.getAccess()

    expect(access.role).toBe('anonymous')
    expect(access.isPlayer).toBe(false)
    expect(access.canAccessAtLeast('player')).toBe(false)
  })

  it('reports the visible debug console module ids for the current viewer', async () => {
    installDebugApi()

    await window.__GAME_DEBUG__.console.getAccess()
    const visibleIds = await window.__GAME_DEBUG__.console.getVisibleModuleIds()

    // Baseline modules that MUST be registered on every scaffolded project.
    // Projects that install additional modules (local-notifications, server-time,
    // ads-service, etc.) contribute extra entries — assert containment, not equality.
    expect(visibleIds).toEqual(
      expect.arrayContaining(['diagnostics', 'navigation', 'performance', 'simulation', 'grants']),
    )

    // Shape invariant: every entry is a non-empty string.
    for (const id of visibleIds) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it('executes discovered commands through the debug api and exposes the execution log', async () => {
    installDebugApi()

    const result = await window.__GAME_DEBUG__.console.executeCommandById('open-screen', {
      screen: 'settings',
    })

    expect(result.status).toBe('success')
    expect(window.__GAME_DEBUG__.ui.getCurrentScreen()).toBe('settings')
    expect(await window.__GAME_DEBUG__.console.getVisibleCommandIds()).toEqual(
      expect.arrayContaining([
        'open-screen',
        'reset-navigation',
        'set-performance-overlay',
      ]),
    )
    expect(window.__GAME_DEBUG__.console.getExecutionLog()).toEqual([
      expect.objectContaining({
        commandId: 'open-screen',
        status: 'success',
      }),
    ])
  })

  it('loads discovered modules lazily when automation explicitly queries them', async () => {
    installDebugApi()

    expect(await window.__GAME_DEBUG__.console.getVisibleCommandIds()).toEqual(
      expect.arrayContaining([
        'open-screen',
        'set-performance-overlay',
      ]),
    )
  })

  it('waits for access normalization before reporting role-filtered module and command ids', async () => {
    vi.mocked(RundotAPI.getProfile).mockImplementationOnce(() => {
      throw new Error('profile lookup failed')
    })

    installDebugApi()
    await window.__GAME_DEBUG__.console.getAccess()

    delete window.__GAME_DEBUG__
    vi.mocked(RundotAPI.getProfile).mockClear()

    let resolveProfile: ((profile: { id: string; username: string; isAnonymous: boolean }) => void) | null = null
    vi.mocked(RundotAPI.getProfile).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProfile = resolve
      }) as never,
    )

    const playerOnlyModule: DebugConsoleModuleFactoryExport = {
      createDebugConsoleModule: () => ({
        id: 'player-tools',
        title: 'Player Tools',
        minimumRole: 'player',
        render: () => null,
        commands: [
          {
            id: 'player-command',
            label: 'Player Command',
            minimumRole: 'player',
            schema: z.object({}),
            execute: vi.fn(),
          },
        ],
      }),
    }

    setDebugConsoleModuleSourcesForTesting({
      '../testing/player-tools.debug-console.ts': playerOnlyModule,
    })
    resetDebugConsoleModules()

    installDebugApi()

    const visibleModuleIdsPromise = window.__GAME_DEBUG__.console.getVisibleModuleIds()
    const visibleCommandIdsPromise = window.__GAME_DEBUG__.console.getVisibleCommandIds()

    resolveProfile?.({
      id: 'mock_user',
      username: 'MockUser',
      isAnonymous: false,
    })

    expect(await visibleModuleIdsPromise).toContain('player-tools')
    expect(await visibleCommandIdsPromise).toContain('player-command')
    expect(vi.mocked(RundotAPI.getProfile)).toHaveBeenCalledTimes(1)
  })

  it('drops elevated command visibility immediately after clearing an access override', async () => {
    installDebugApi()

    await window.__GAME_DEBUG__.console.getAccess()
    window.__GAME_DEBUG__.console.setAccessOverride('editor')

    expect(await window.__GAME_DEBUG__.console.getVisibleCommandIds()).toContain('execute-recipe')

    window.__GAME_DEBUG__.console.clearAccessOverride()

    expect(await window.__GAME_DEBUG__.console.getVisibleCommandIds()).not.toContain('execute-recipe')
  })
})
