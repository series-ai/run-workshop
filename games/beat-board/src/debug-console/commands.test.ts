import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createDebugConsoleAccess } from './access'
import {
  applyDebugCommandFieldValue,
  clearDebugConsoleExecutionLog,
  executeDebugConsoleCommandById,
  executeDebugConsoleTextCommand,
  getDebugConsoleExecutionLog,
  getVisibleDebugConsoleCommands,
  getVisibleDebugConsoleCommandIds,
  resolveDebugCommandFields,
} from './commands'
import {
  ensureDebugConsoleModulesLoaded,
  resetDebugConsoleModules,
  setDebugConsoleModuleSourcesForTesting,
} from './modules'
import type { DebugConsoleModuleFactoryExport } from './types'

declare global {
  interface Window {
    __GAME_DEBUG__?: {
      ui?: {
        getCurrentScreen?: () => string
      }
    }
  }
}

const grantCoins = vi.fn(async ({ amount }: { amount: number }) => ({
  balance: amount,
}))

beforeEach(async () => {
  window.__GAME_DEBUG__ = {
    ui: {
      getCurrentScreen: () => 'home',
    },
  }
  grantCoins.mockClear()
  vi.mocked(RundotAPI.log).mockClear()
  vi.mocked(RundotAPI.error).mockClear()
  clearDebugConsoleExecutionLog()
  const supportModuleSource: DebugConsoleModuleFactoryExport = {
    createDebugConsoleModule: () => ({
        id: 'support',
        title: 'Support',
        render: () => null,
        commands: [
          {
            id: 'grant-coins',
            label: 'Grant Coins',
            description: 'Adds coins for support workflows.',
            aliases: ['coins'],
            minimumRole: 'editor',
            safety: 'support-mutation',
            schema: z.object({
              amount: z.coerce.number().int().positive(),
              reason: z.string().min(1).optional(),
            }),
            fields: [
              { key: 'amount', label: 'Amount', kind: 'number' },
              { key: 'reason', label: 'Reason', kind: 'text', redact: true },
            ],
            execute: grantCoins,
          },
          {
            id: 'configure-support',
            label: 'Configure Support',
            aliases: ['support-mode'],
            schema: z.object({
              mode: z.enum(['basic', 'advanced']),
              detail: z.string().optional(),
            }),
            fields: [
              {
                key: 'mode',
                label: 'Mode',
                kind: 'select',
                getOptions: () => [
                  { label: 'Basic', value: 'basic' },
                  { label: 'Advanced', value: 'advanced' },
                ],
                onValueChanged: ({ nextValue }) => (
                  nextValue === 'advanced'
                    ? { detail: 'auto-filled' }
                    : { detail: undefined }
                ),
              },
              {
                key: 'detail',
                label: 'Detail',
                kind: 'text',
                isVisible: ({ args }) => args.mode === 'advanced',
                isEnabled: ({ args }) => args.mode === 'advanced',
              },
            ],
            execute: vi.fn(),
          },
          {
            id: 'lab-only',
            label: 'Lab Only',
            description: 'Only appears while viewing the lab screen.',
            minimumRole: 'editor',
            safety: 'diagnostic',
            schema: z.object({}),
            isVisible: ({ currentScreen }) => currentScreen === 'lab',
            isEnabled: ({ currentScreen }) => currentScreen === 'lab',
            execute: vi.fn(),
          },
        ],
      }),
  }

  setDebugConsoleModuleSourcesForTesting({
    '../support/support.debug-console.ts': supportModuleSource,
  })
  resetDebugConsoleModules()
  await ensureDebugConsoleModulesLoaded()
})

describe('debug console commands', () => {
  it('lists visible command IDs using access filters', () => {
    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('player'))).toEqual([
      'configure-support',
    ])
    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('editor'))).toEqual(
      expect.arrayContaining([
        'configure-support',
        'grant-coins',
      ]),
    )
  })

  it('filters discovered commands by command-level visibility and enabled state', () => {
    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('editor'))).not.toContain('lab-only')
    expect(getVisibleDebugConsoleCommands(createDebugConsoleAccess('editor')).map((command) => command.id))
      .not.toContain('lab-only')

    window.__GAME_DEBUG__ = {
      ui: {
        getCurrentScreen: () => 'lab',
      },
    }

    expect(getVisibleDebugConsoleCommandIds(createDebugConsoleAccess('editor'))).toContain('lab-only')
  })

  it('executes a command by alias text and records a redacted mutation log', async () => {
    const result = await executeDebugConsoleTextCommand('coins 25 reason=secret-note', {
      access: createDebugConsoleAccess('editor'),
    })

    expect(result.status).toBe('success')
    expect(grantCoins).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 25,
        reason: 'secret-note',
      }),
      expect.anything(),
    )
    expect(vi.mocked(RundotAPI.log)).toHaveBeenCalledWith(
      '[Debug Console] Command execution',
      expect.objectContaining({
        commandId: 'grant-coins',
        status: 'success',
        args: {
          amount: 25,
          reason: '<redacted>',
        },
      }),
    )
    expect(getDebugConsoleExecutionLog()).toEqual([
      expect.objectContaining({
        commandId: 'grant-coins',
        status: 'success',
      }),
    ])
  })

  it('rejects commands that fail execution-time access checks', async () => {
    const result = await executeDebugConsoleCommandById('grant-coins', { amount: 10 }, {
      access: createDebugConsoleAccess('player'),
    })

    expect(result.status).toBe('error')
    expect(grantCoins).not.toHaveBeenCalled()
    expect(result.error).toContain('editor')
  })

  it('surfaces validation errors before execution', async () => {
    const result = await executeDebugConsoleCommandById('grant-coins', { amount: 0 }, {
      access: createDebugConsoleAccess('editor'),
    })

    expect(result.status).toBe('error')
    expect(result.error).toContain('greater than 0')
    expect(grantCoins).not.toHaveBeenCalled()
  })

  it('resolves conditional fields, dynamic options, and onValueChanged patches', async () => {
    expect(
      await resolveDebugCommandFields('configure-support', { mode: 'basic' }, {
        access: createDebugConsoleAccess('editor'),
      }),
    ).toEqual([
      expect.objectContaining({
        key: 'mode',
        enabled: true,
        options: [
          { label: 'Basic', value: 'basic' },
          { label: 'Advanced', value: 'advanced' },
        ],
      }),
    ])

    expect(
      applyDebugCommandFieldValue(
        'configure-support',
        { mode: 'basic' },
        'mode',
        'advanced',
        { access: createDebugConsoleAccess('editor') },
      ),
    ).toEqual({
      mode: 'advanced',
      detail: 'auto-filled',
    })
  })
})
