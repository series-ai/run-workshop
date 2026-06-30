import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { ShareServiceDebugDiagnostics } from './ShareService'

interface DebugConsoleContext {
  getBinding: <T>(id: string) => T | undefined
}

interface ShareServiceBinding {
  getShareClicks(shareLinkId: string): Promise<{ clicks: unknown[]; truncated: boolean }>
  getMyShareClickData(shareLinkId: string): Promise<unknown | null>
  getDebugDiagnostics(): Promise<ShareServiceDebugDiagnostics>
}

const SHARE_SERVICE_BINDING_ID = 'data/share-service:service'

function getShareService(context: DebugConsoleContext): ShareServiceBinding | undefined {
  return context.getBinding<ShareServiceBinding>(SHARE_SERVICE_BINDING_ID)
}

function ShareServiceDebugPanel({ context }: { context: DebugConsoleContext }) {
  const service = getShareService(context)
  const [diagnostics, setDiagnostics] = useState<ShareServiceDebugDiagnostics | null>(null)

  useEffect(() => {
    if (!service) {
      setDiagnostics(null)
      return
    }
    let cancelled = false
    void service.getDebugDiagnostics().then(next => {
      if (!cancelled) setDiagnostics(next)
    })
    return () => {
      cancelled = true
    }
  }, [service])

  if (!service || !diagnostics) {
    return (
      <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        <h3>Share Service</h3>
        <span>Binding Status: not wired</span>
        <span>Register `data/share-service:service` to inspect share diagnostics.</span>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Share Service</h3>
      <span>Incoming Link Id: {diagnostics.incomingShareLinkId ?? 'none'}</span>
      <span>
        Incoming Params: {diagnostics.incomingShareParams ? JSON.stringify(diagnostics.incomingShareParams) : 'none'}
      </span>
    </section>
  )
}

export const createDebugConsoleModule = (context: DebugConsoleContext) => ({
  id: 'data/share-service',
  title: 'Share Service',
  minimumRole: 'editor' as const,
  commands: [
    {
      id: 'data/share-service:get-share-clicks',
      label: 'Get Share Clicks',
      description: 'Inspect click-tracking summary for a share link id.',
      minimumRole: 'editor' as const,
      safety: 'diagnostic' as const,
      schema: z.object({
        shareLinkId: z.string().min(1),
      }),
      fields: [
        {
          key: 'shareLinkId',
          label: 'Share Link Id',
          kind: 'text' as const,
        },
      ],
      isEnabled: () => Boolean(getShareService(context)),
      execute: async ({ shareLinkId }: { shareLinkId: string }) => {
        const service = getShareService(context)
        if (!service) {
          throw new Error(
            `Share service not wired. Register ${SHARE_SERVICE_BINDING_ID} from your game bootstrap.`,
          )
        }

        const result = await service.getShareClicks(shareLinkId)
        return {
          shareLinkId,
          clickCount: result.clicks.length,
          truncated: result.truncated,
        }
      },
    },
    {
      id: 'data/share-service:get-my-click-data',
      label: 'Get My Share Click Data',
      description: 'Inspect the current player click record for a share link id.',
      minimumRole: 'editor' as const,
      safety: 'diagnostic' as const,
      schema: z.object({
        shareLinkId: z.string().min(1),
      }),
      fields: [
        {
          key: 'shareLinkId',
          label: 'Share Link Id',
          kind: 'text' as const,
        },
      ],
      isEnabled: () => Boolean(getShareService(context)),
      execute: async ({ shareLinkId }: { shareLinkId: string }) => {
        const service = getShareService(context)
        if (!service) {
          throw new Error(
            `Share service not wired. Register ${SHARE_SERVICE_BINDING_ID} from your game bootstrap.`,
          )
        }

        return {
          shareLinkId,
          hasClickData: (await service.getMyShareClickData(shareLinkId)) !== null,
        }
      },
    },
  ],
  render: () => <ShareServiceDebugPanel context={context} />,
})
