import { z } from 'zod'
import type { SubscriptionTier } from './types'
import { subscriptionNativeStore } from './SubscriptionNative'

const SUBSCRIPTION_TIERS = ['CORE', 'PLUS', 'PRIME', 'ULTIMATE'] as const satisfies readonly SubscriptionTier[]

function SubscriptionNativeDebugPanel() {
  const isSubscribed = subscriptionNativeStore((state) => state.isSubscribed)
  const currentTier = subscriptionNativeStore((state) => state.currentTier)
  const subscriptions = subscriptionNativeStore((state) => state.subscriptions)
  const isLoading = subscriptionNativeStore((state) => state.isLoading)
  const error = subscriptionNativeStore((state) => state.error)

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Subscription SDK</h3>
      <span>Subscribed: {String(isSubscribed)}</span>
      <span>Current Tier: {currentTier ?? 'none'}</span>
      <span>Subscription Records: {Object.keys(subscriptions).length}</span>
      <span>Loading: {String(isLoading)}</span>
      <span>Error: {error ?? 'none'}</span>
    </section>
  )
}

export const createDebugConsoleModule = () => ({
  id: 'monetization/subscription-sdk',
  title: 'Subscription SDK',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'monetization/subscription-sdk:check-status',
      label: 'Check Subscription Status',
      description: 'Check platform subscription ownership for one tier.',
      minimumRole: 'player' as const,
      safety: 'diagnostic' as const,
      schema: z.object({
        tier: z.enum(SUBSCRIPTION_TIERS),
      }),
      fields: [
        {
          key: 'tier',
          label: 'Tier',
          kind: 'select' as const,
          getOptions: () => SUBSCRIPTION_TIERS.map((tier) => ({ label: tier, value: tier })),
        },
      ],
      execute: async ({ tier }: { tier: SubscriptionTier }) => {
        await subscriptionNativeStore.getState().checkStatus(tier)
        return {
          isSubscribed: subscriptionNativeStore.getState().isSubscribed,
          currentTier: subscriptionNativeStore.getState().currentTier,
        }
      },
    },
    {
      id: 'monetization/subscription-sdk:fetch-subscriptions',
      label: 'Fetch Subscription Catalog',
      description: 'Refresh subscription catalog data from the SDK.',
      minimumRole: 'player' as const,
      safety: 'diagnostic' as const,
      schema: z.object({}),
      execute: async () => {
        await subscriptionNativeStore.getState().fetchSubscriptions()
        return {
          subscriptionCount: Object.keys(subscriptionNativeStore.getState().subscriptions).length,
        }
      },
    },
  ],
  render: () => <SubscriptionNativeDebugPanel />,
})
