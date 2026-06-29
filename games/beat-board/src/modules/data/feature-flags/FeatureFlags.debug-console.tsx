import { useEffect, useState } from 'react'
import { z } from 'zod'
import { featureFlagStore } from './FeatureFlags'

function getSortedFlagEntries(): Array<[string, boolean]> {
  return Object.entries(featureFlagStore.getState().getDebugSnapshot().flags)
    .sort(([left], [right]) => left.localeCompare(right))
}

function getFlagOptions() {
  return getSortedFlagEntries().map(([key]) => ({
    label: key,
    value: key,
  }))
}

function getDebugSnapshot() {
  return featureFlagStore.getState().getDebugSnapshot()
}

function FeatureFlagsDebugPanel() {
  const [snapshot, setSnapshot] = useState(() => getDebugSnapshot())

  useEffect(() => {
    return featureFlagStore.subscribe((state) => {
      setSnapshot(state.getDebugSnapshot())
    })
  }, [])

  const flags = snapshot.flags
  const baseFlags = snapshot.baseFlags
  const overrides = snapshot.overrides

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Feature Flags</h3>
      <span>Total Flags: {Object.keys(flags).length}</span>
      <span>Active Overrides: {Object.keys(overrides).length}</span>
      <div style={{ display: 'grid', gap: '4px' }}>
        {Object.entries(flags)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, enabled]) => (
            <span key={key}>
              {key in overrides
                ? `${key}: ${(baseFlags[key] ?? false) ? 'on' : 'off'} -> ${enabled ? 'on' : 'off'} (override)`
                : `${key}: ${enabled ? 'on' : 'off'}`}
            </span>
          ))}
      </div>
    </section>
  )
}

export const createDebugConsoleModule = () => ({
  id: 'data/feature-flags',
  title: 'Feature Flags',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'data/feature-flags:set-override',
      label: 'Set Flag Override',
      description: 'Set a DEV-only feature flag override.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({
        key: z.string().min(1),
        value: z.boolean(),
      }),
      fields: [
        {
          key: 'key',
          label: 'Flag',
          kind: 'select' as const,
          getOptions: () => getFlagOptions(),
        },
        {
          key: 'value',
          label: 'Enabled',
          kind: 'toggle' as const,
        },
      ],
      isVisible: () => import.meta.env.DEV,
      execute: ({ key, value }: { key: string; value: boolean }) => {
        featureFlagStore.getState().override(key, value)
        return {
          key,
          value,
          effectiveValue: featureFlagStore.getState().isEnabled(key),
        }
      },
    },
    {
      id: 'data/feature-flags:reset-overrides',
      label: 'Reset Flag Overrides',
      description: 'Clear all DEV-only feature flag overrides.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({}),
      isVisible: () => import.meta.env.DEV,
      execute: () => {
        featureFlagStore.getState().resetOverrides()
        return {
          overrideCount: Object.keys(featureFlagStore.getState().getDebugSnapshot().overrides).length,
        }
      },
    },
  ],
  render: () => <FeatureFlagsDebugPanel />,
})
