import { z } from 'zod'
import { adsService } from './AdsService'

function AdsServiceDebugPanel() {
  const diagnostics = adsService.getDebugDiagnostics()

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Ads Service</h3>
      <span>Last Privacy Consent: {String(diagnostics.lastPrivacyConsent ?? 'unknown')}</span>
      <span>Last Rewarded Availability: {String(diagnostics.lastRewardedAvailability ?? 'unknown')}</span>
      <span>Last Rewarded Placement: {diagnostics.lastRewardedPlacement ?? 'none'}</span>
      <span>Last Interstitial Placement: {diagnostics.lastInterstitialPlacement ?? 'none'}</span>
      <span>Last Error: {diagnostics.lastError ?? 'none'}</span>
    </section>
  )
}

export const createDebugConsoleModule = () => ({
  id: 'monetization/ads-service',
  title: 'Ads Service',
  minimumRole: 'player' as const,
  commands: [
    {
      id: 'monetization/ads-service:check-rewarded',
      label: 'Check Rewarded Availability',
      description: 'Check rewarded readiness without granting any reward.',
      minimumRole: 'player' as const,
      safety: 'diagnostic' as const,
      schema: z.object({}),
      execute: async () => {
        return {
          rewardedAvailable: await adsService.isRewardedAvailable(),
          ...adsService.getDebugDiagnostics(),
        }
      },
    },
  ],
  render: () => <AdsServiceDebugPanel />,
})
