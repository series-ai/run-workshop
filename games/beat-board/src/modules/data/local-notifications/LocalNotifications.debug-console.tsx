import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { LocalNotificationsDebugDiagnostics, LocalNotificationsService } from './LocalNotifications'

interface DebugConsoleContext {
  getBinding: <T>(id: string) => T | undefined
}

const NOTIFICATIONS_BINDING_ID = 'data/local-notifications:service'

function getNotificationsService(context: DebugConsoleContext): LocalNotificationsService | undefined {
  return context.getBinding<LocalNotificationsService>(NOTIFICATIONS_BINDING_ID)
}

function NotificationsDebugPanel({ context }: { context: DebugConsoleContext }) {
  const [diagnostics, setDiagnostics] = useState<LocalNotificationsDebugDiagnostics | null>(null)
  const [status, setStatus] = useState('idle')
  const service = getNotificationsService(context)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      if (!service) {
        setDiagnostics(null)
        setStatus('not wired')
        return
      }

      setStatus('loading')
      try {
        const nextDiagnostics = await service.getDebugDiagnostics()
        if (!cancelled) {
          setDiagnostics(nextDiagnostics)
          setStatus('loaded')
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [service])

  if (!service) {
    return (
      <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        <h3>Local Notifications</h3>
        <span>Binding Status: not wired</span>
        <span>Register `data/local-notifications:service` to enable wrapper diagnostics.</span>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Local Notifications</h3>
      <span>Status: {status}</span>
      <span>Configured Entries: {diagnostics?.configuredEntryCount ?? 0}</span>
      <span>Pending Count: {diagnostics?.pendingNotificationCount ?? 0}</span>
      <span>Pending IDs: {diagnostics?.pendingNotificationIds.join(', ') || 'none'}</span>
      <span>
        Last Refresh: {diagnostics?.lastRefreshResult ? JSON.stringify(diagnostics.lastRefreshResult) : 'never'}
      </span>
    </section>
  )
}

export const createDebugConsoleModule = (context: DebugConsoleContext) => ({
  id: 'data/local-notifications',
  title: 'Local Notifications',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'data/local-notifications:refresh',
      label: 'Refresh Notifications',
      description: 'Cancel and reschedule this module notification set.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({}),
      isEnabled: () => Boolean(getNotificationsService(context)),
      execute: async () => {
        const service = getNotificationsService(context)
        if (!service) {
          throw new Error(
            `Local notifications not wired. Register ${NOTIFICATIONS_BINDING_ID} from your game bootstrap.`,
          )
        }

        return service.refresh()
      },
    },
    {
      id: 'data/local-notifications:cancel-all',
      label: 'Cancel Notifications',
      description: 'Cancel all scheduled notifications owned by this module prefix.',
      minimumRole: 'editor' as const,
      safety: 'dangerous-mutation' as const,
      confirm: {
        message: 'Cancel all scheduled notifications for this game prefix?',
        confirmLabel: 'Cancel Notifications',
      },
      schema: z.object({}),
      isEnabled: () => Boolean(getNotificationsService(context)),
      execute: async () => {
        const service = getNotificationsService(context)
        if (!service) {
          throw new Error(
            `Local notifications not wired. Register ${NOTIFICATIONS_BINDING_ID} from your game bootstrap.`,
          )
        }

        const cancelledCount = await service.cancelAll()
        return { cancelledCount }
      },
    },
  ],
  render: () => <NotificationsDebugPanel context={context} />,
})
