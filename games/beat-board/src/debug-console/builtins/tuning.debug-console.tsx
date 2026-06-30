import { z } from 'zod'
import { Button, Settings } from '@modules/ui/skin/semantic'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  getTuningOverlayState,
  setTuningOverlayEnabled,
  useTuningOverlayState,
} from '../../tuning/state'
import {
  listRegisteredTunables,
  resetAllTunables,
  subscribeToTuningRegistry,
} from '../../tuning/registry'
import type { TunableDescriptor } from '../../tuning/registry'
import type { DebugConsoleModuleFactoryExport } from '../types'
import { useEffect, useState } from 'react'

function readCurrentValue(descriptor: TunableDescriptor): string {
  try {
    const raw = descriptor.get()
    if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw)
    return String(raw)
  } catch (error) {
    RundotAPI.error(`tuning: diagnostic get() threw for ${descriptor.id}`, {
      error,
    })
    return '(error)'
  }
}

function useRegisteredTunables(): TunableDescriptor[] {
  const [list, setList] = useState<TunableDescriptor[]>(() =>
    listRegisteredTunables(),
  )
  useEffect(() => {
    setList(listRegisteredTunables())
    return subscribeToTuningRegistry(() => {
      setList(listRegisteredTunables())
    })
  }, [])
  return list
}

function TuningDebugSection() {
  const state = useTuningOverlayState()
  const tunables = useRegisteredTunables()

  return (
    <Settings.Section title="Tuning Overlay">
      <Settings.Row
        title="Overlay"
        control={(
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button.Secondary
              onClick={() => {
                void setTuningOverlayEnabled(!state.userEnabled)
              }}
            >
              {state.userEnabled ? 'Hide Overlay' : 'Show Overlay'}
            </Button.Secondary>
            <Button.Ghost
              onClick={() => {
                resetAllTunables()
              }}
            >
              Reset All
            </Button.Ghost>
          </div>
        )}
      />
      <Settings.Row
        title="Registered"
        control={<span>{tunables.length}</span>}
      />
      {tunables.map((descriptor) => (
        <Settings.Row
          key={descriptor.id}
          title={descriptor.label}
          control={(
            <span data-debug-tuning-id={descriptor.id}>
              {descriptor.folder} · {readCurrentValue(descriptor)}
            </span>
          )}
        />
      ))}
    </Settings.Section>
  )
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => ({
  id: 'tuning',
  title: 'Tuning',
  order: 3,
  minimumRole: 'editor',
  commands: [
    {
      id: 'set-tuning-overlay',
      label: 'Set Tuning Overlay',
      description: 'Enable or disable the live parameter tuning overlay.',
      aliases: ['tuning-overlay'],
      schema: z.object({
        enabled: z.enum(['on', 'off']),
      }),
      fields: [
        {
          key: 'enabled',
          label: 'Overlay',
          kind: 'select',
          getOptions: () => [
            { label: 'On', value: 'on' },
            { label: 'Off', value: 'off' },
          ],
        },
      ],
      execute: async ({ enabled }) => {
        await setTuningOverlayEnabled(enabled === 'on')
        return { overlayEnabled: getTuningOverlayState().userEnabled }
      },
    },
    {
      id: 'reset-all-tunables',
      label: 'Reset All Tunables',
      description: 'Restore every registered tunable to its initial value.',
      aliases: ['tuning-reset'],
      schema: z.object({}),
      execute: () => {
        resetAllTunables()
        return { reset: true }
      },
    },
  ],
  render: () => <TuningDebugSection />,
})
