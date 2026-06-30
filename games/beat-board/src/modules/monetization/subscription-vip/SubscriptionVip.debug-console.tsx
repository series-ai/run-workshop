import { subscriptionStore } from './SubscriptionVip'

function SubscriptionVipDebugPanel() {
  const tier = subscriptionStore((state) => state.tier)
  const expiresAt = subscriptionStore((state) => state.expiresAt)
  const benefits = subscriptionStore((state) => state.benefits)
  const lastDailyClaimAt = subscriptionStore((state) => state.lastDailyClaimAt)

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Subscription VIP</h3>
      <span>Tier: {tier}</span>
      <span>Active: {String(subscriptionStore.getState().isActive())}</span>
      <span>Expires At: {expiresAt ? new Date(expiresAt).toISOString() : 'none'}</span>
      <span>Benefits: {benefits.join(', ') || 'none'}</span>
      <span>Can Claim Daily: {String(subscriptionStore.getState().canClaimDaily())}</span>
      <span>Last Daily Claim: {lastDailyClaimAt ? new Date(lastDailyClaimAt).toISOString() : 'never'}</span>
    </section>
  )
}

export const createDebugConsoleModule = () => ({
  id: 'monetization/subscription-vip',
  title: 'Subscription VIP',
  minimumRole: 'player' as const,
  commands: [],
  render: () => <SubscriptionVipDebugPanel />,
})
