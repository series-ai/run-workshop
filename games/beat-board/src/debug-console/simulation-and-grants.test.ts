import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createDebugConsoleAccess } from './access'
import { createDebugConsoleModule as createSimulationDebugConsoleModule } from './builtins/simulation.debug-console'
import {
  createDebugCurrencyGrantProvider,
  createDebugInventoryGrantProvider,
} from './grant-adapters'
import {
  clearDebugConsoleExecutionLog,
  executeDebugConsoleCommandById,
  getDebugConsoleExecutionLog,
  getVisibleDebugConsoleCommandIds,
} from './commands'
import {
  ensureDebugConsoleModulesLoaded,
  registerDebugConsoleModule,
  resetDebugConsoleModules,
  setDebugConsoleModuleSourcesForTesting,
} from './modules'
import { resetDebugSimulationSnapshot } from './simulation'
import type { DebugConsoleModule } from './types'

describe('debug console simulation and grants', () => {
  beforeEach(() => {
    clearDebugConsoleExecutionLog()
    setDebugConsoleModuleSourcesForTesting(null)
    resetDebugConsoleModules()
    resetDebugSimulationSnapshot()
    vi.mocked(RundotAPI.log).mockClear()
    vi.mocked(RundotAPI.error).mockClear()
    vi.mocked(RundotAPI.simulation.getAvailableRecipesAsync).mockResolvedValue({
      success: true,
      recipes: [
        { id: 'forge-sword', label: 'Forge Sword' },
      ],
    } as unknown as Awaited<ReturnType<typeof RundotAPI.simulation.getAvailableRecipesAsync>>)
    vi.mocked(RundotAPI.simulation.executeRecipeAsync).mockResolvedValue({
      success: true,
      runId: 'run-forge-sword',
    })
    vi.mocked(RundotAPI.simulation.getStateAsync).mockResolvedValue({
      entities: { coin: { amount: 100 } },
      activeRuns: [],
      disabledRecipes: [],
    } as unknown as Awaited<ReturnType<typeof RundotAPI.simulation.getStateAsync>>)
    vi.mocked(RundotAPI.simulation.getActiveRunsAsync).mockResolvedValue([])
  })

  it('does not fetch simulation data just by rendering the debug panel', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const module = createSimulationDebugConsoleModule()

    vi.mocked(RundotAPI.simulation.getAvailableRecipesAsync).mockClear()
    vi.mocked(RundotAPI.simulation.getStateAsync).mockClear()
    vi.mocked(RundotAPI.simulation.getActiveRunsAsync).mockClear()

    await act(async () => {
      root.render(module?.render?.({ access: createDebugConsoleAccess('editor'), currentScreen: 'home' }) ?? null)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vi.mocked(RundotAPI.simulation.getAvailableRecipesAsync)).not.toHaveBeenCalled()
    expect(vi.mocked(RundotAPI.simulation.getStateAsync)).not.toHaveBeenCalled()
    expect(vi.mocked(RundotAPI.simulation.getActiveRunsAsync)).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Not refreshed')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('executes recipes through the built-in simulation command surface', async () => {
    await ensureDebugConsoleModulesLoaded()

    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('editor'))).toContain('execute-recipe')

    const result = await executeDebugConsoleCommandById(
      'execute-recipe',
      { recipeId: 'forge-sword' },
      { access: createDebugConsoleAccess('editor') },
    )

    expect(result.status).toBe('success')
    expect(vi.mocked(RundotAPI.simulation.executeRecipeAsync)).toHaveBeenCalledWith('forge-sword')
    expect(getDebugConsoleExecutionLog()).toEqual([
      expect.objectContaining({
        commandId: 'execute-recipe',
        status: 'success',
      }),
    ])
  })

  it('surfaces grant providers as shared commands for currency, inventory, and hero-style grants', async () => {
    const grantCurrency = vi.fn().mockResolvedValue({ balance: 250 })
    const grantItem = vi.fn().mockResolvedValue({ itemId: 'potion', quantity: 2 })
    const grantHero = vi.fn().mockResolvedValue({ heroId: 'hero-knight' })

    const grantFixtureModule: DebugConsoleModule = {
      id: 'grant-fixtures',
      title: 'Grant Fixtures',
      render: () => null,
      grantProviders: [
        createDebugCurrencyGrantProvider({
          minimumRole: 'editor',
          getOptions: async () => [{ label: 'Coins', value: 'coins' }],
          executeGrant: grantCurrency,
        }),
        createDebugInventoryGrantProvider({
          minimumRole: 'editor',
          getOptions: async () => [{ label: 'Potion', value: 'potion' }],
          executeGrant: grantItem,
        }),
        {
          id: 'grant-hero',
          label: 'Grant Hero',
          minimumRole: 'editor',
          schema: z.object({ heroId: z.string().min(1) }),
          fields: [{ key: 'heroId', label: 'Hero', kind: 'text' }],
          executeGrant: grantHero,
        },
      ],
    }

    registerDebugConsoleModule(grantFixtureModule)

    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('player'))).not.toEqual(
      expect.arrayContaining(['grant-currency', 'grant-item', 'grant-hero']),
    )
    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('editor'))).toEqual(
      expect.arrayContaining(['grant-currency', 'grant-item', 'grant-hero']),
    )

    await executeDebugConsoleCommandById(
      'grant-currency',
      { currencyId: 'coins', amount: 250 },
      { access: createDebugConsoleAccess('editor') },
    )
    await executeDebugConsoleCommandById(
      'grant-item',
      { itemId: 'potion', quantity: 2 },
      { access: createDebugConsoleAccess('editor') },
    )
    await executeDebugConsoleCommandById(
      'grant-hero',
      { heroId: 'hero-knight' },
      { access: createDebugConsoleAccess('editor') },
    )

    expect(grantCurrency).toHaveBeenCalledWith({ currencyId: 'coins', amount: 250 }, expect.anything())
    expect(grantItem).toHaveBeenCalledWith({ itemId: 'potion', quantity: 2 }, expect.anything())
    expect(grantHero).toHaveBeenCalledWith({ heroId: 'hero-knight' }, expect.anything())
    expect(getDebugConsoleExecutionLog().map((entry) => entry.commandId)).toEqual([
      'grant-hero',
      'grant-item',
      'grant-currency',
    ])
  })
})
