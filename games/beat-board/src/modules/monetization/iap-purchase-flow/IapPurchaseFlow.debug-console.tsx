import { z } from 'zod'
import { iapStore } from './IapPurchaseFlow'

function IapPurchaseFlowDebugPanel() {
  const balance = iapStore((state) => state.balance)
  const isLoading = iapStore((state) => state.isLoading)
  const error = iapStore((state) => state.error)
  const lastOpenedAt = iapStore((state) => state.lastOpenedAt)

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>IAP Purchase Flow</h3>
      <span>Balance: {balance}</span>
      <span>Loading: {String(isLoading)}</span>
      <span>Error: {error ?? 'none'}</span>
      <span>Last Opened At: {lastOpenedAt ? new Date(lastOpenedAt).toISOString() : 'never'}</span>
    </section>
  )
}

export const createDebugConsoleModule = () => ({
  id: 'monetization/iap-purchase-flow',
  title: 'IAP Purchase Flow',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'monetization/iap-purchase-flow:get-balance',
      label: 'Refresh IAP Balance',
      description: 'Refresh the current hard-currency balance.',
      minimumRole: 'player' as const,
      safety: 'diagnostic' as const,
      schema: z.object({}),
      execute: async () => ({
        balance: await iapStore.getState().getBalance(),
      }),
    },
    {
      id: 'monetization/iap-purchase-flow:has-user-made-purchase',
      label: 'Check Purchase History',
      description: 'Check whether this user has completed a purchase before.',
      minimumRole: 'player' as const,
      safety: 'diagnostic' as const,
      schema: z.object({}),
      execute: async () => ({
        hasUserMadePurchase: await iapStore.getState().hasUserMadePurchase(),
      }),
    },
  ],
  render: () => <IapPurchaseFlowDebugPanel />,
})
