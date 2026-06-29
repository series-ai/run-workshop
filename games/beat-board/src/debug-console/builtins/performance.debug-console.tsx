import { z } from 'zod'
import { Button, Settings } from '@modules/ui/skin/semantic'
import {
  clearDebugPerformanceHistory,
  DEBUG_PERFORMANCE_HISTORY_LIMIT,
  getDebugPerformanceState,
  setDebugPerformanceOverlayEnabled,
  useDebugPerformanceState,
} from '../performance'
import type { DebugConsoleModuleFactoryExport } from '../types'

function DebugPerformanceModuleSection() {
  const { overlayEnabled } = useDebugPerformanceState()
  const snapshot = getDebugPerformanceState()
  const fpsHistoryPreview = snapshot.fpsHistory
    .slice(-5)
    .map((value) => String(value))
    .join(' ')
  const memoryHistoryPreview = snapshot.memoryHistory
    .slice(-5)
    .map((value) => (value === null ? 'n/a' : `${Math.round(value / (1024 * 1024))}MB`))
    .join(' ')

  return (
    <Settings.Section title="Performance">
      <Settings.Row
        title="Overlay"
        control={(
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button.Secondary
              onClick={() => {
                void setDebugPerformanceOverlayEnabled(!overlayEnabled)
              }}
            >
              {overlayEnabled ? 'Hide Overlay' : 'Show Overlay'}
            </Button.Secondary>
            <Button.Ghost
              onClick={() => {
                clearDebugPerformanceHistory()
              }}
            >
              Reset History
            </Button.Ghost>
          </div>
        )}
      />
      <Settings.Row
        title="FPS"
        control={<span>{snapshot.currentFps ?? '--'}</span>}
      />
      <Settings.Row
        title="Memory"
        control={(
          <span>
            {snapshot.memorySupported
              ? `${Math.round((snapshot.currentMemoryBytes ?? 0) / (1024 * 1024))} MB`
              : 'Unavailable'}
          </span>
        )}
      />
      <Settings.Row
        title="FPS History"
        control={<span>{fpsHistoryPreview || `No samples (max ${DEBUG_PERFORMANCE_HISTORY_LIMIT})`}</span>}
      />
      <Settings.Row
        title="Memory History"
        control={<span>{memoryHistoryPreview || `No samples (max ${DEBUG_PERFORMANCE_HISTORY_LIMIT})`}</span>}
      />
    </Settings.Section>
  )
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => ({
  id: 'performance',
  title: 'Performance',
  order: 2,
  commands: [
    {
      id: 'set-performance-overlay',
      label: 'Set Performance Overlay',
      description: 'Enable or disable the live FPS and memory overlay.',
      aliases: ['perf-overlay'],
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
        await setDebugPerformanceOverlayEnabled(enabled === 'on')
        return { overlayEnabled: enabled === 'on' }
      },
    },
    {
      id: 'reset-performance-history',
      label: 'Reset Performance History',
      description: 'Clear sampled FPS and memory history.',
      aliases: ['clear-performance'],
      schema: z.object({}),
      execute: () => {
        clearDebugPerformanceHistory()
        return { cleared: true }
      },
    },
  ],
  render: () => <DebugPerformanceModuleSection />,
})
