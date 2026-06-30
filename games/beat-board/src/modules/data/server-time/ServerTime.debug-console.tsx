import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { ServerTimeService } from './ServerTime'

interface DebugConsoleContext {
  getBinding: <T>(id: string) => T | undefined
}

const SERVER_TIME_BINDING_ID = 'data/server-time:service'

function getServerTimeService(context: DebugConsoleContext): ServerTimeService | undefined {
  return context.getBinding<ServerTimeService>(SERVER_TIME_BINDING_ID)
}

function ServerTimeDebugPanel({ context }: { context: DebugConsoleContext }) {
  const [, setTick] = useState(0)
  const service = getServerTimeService(context)
  const diagnostics = service?.getDebugDiagnostics() ?? null

  useEffect(() => {
    if (!service) {
      return
    }

    const interval = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [service])

  if (!service || !diagnostics) {
    return (
      <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        <h3>Server Time</h3>
        <span>Binding Status: not wired</span>
        <span>Register `data/server-time:service` to enable server clock diagnostics.</span>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Server Time</h3>
      <span>Synced: {String(diagnostics.synced)}</span>
      <span>Offset (ms): {diagnostics.offsetMs}</span>
      <span>Now: {new Date(diagnostics.now).toISOString()}</span>
      <span>Day Key (UTC): {diagnostics.dayKeyUtc}</span>
      <span>Last Sync At: {diagnostics.lastSyncAt ? new Date(diagnostics.lastSyncAt).toISOString() : 'never'}</span>
      <span>Last Sync Error: {diagnostics.lastSyncError ?? 'none'}</span>
    </section>
  )
}

export const createDebugConsoleModule = (context: DebugConsoleContext) => ({
  id: 'data/server-time',
  title: 'Server Time',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'data/server-time:sync',
      label: 'Sync Server Time',
      description: 'Refresh the local server-time offset from Rundot.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({}),
      isEnabled: () => Boolean(getServerTimeService(context)),
      execute: async () => {
        const service = getServerTimeService(context)
        if (!service) {
          throw new Error(
            `Server time not wired. Register ${SERVER_TIME_BINDING_ID} from your game bootstrap.`,
          )
        }

        await service.sync()
        return service.getDebugDiagnostics()
      },
    },
  ],
  render: () => <ServerTimeDebugPanel context={context} />,
})
