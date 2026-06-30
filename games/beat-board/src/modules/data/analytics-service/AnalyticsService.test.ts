import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  analytics,
  COMMON_ANALYTICS_EVENT_GROUPS,
  isCanonicalAnalyticsEventName,
  normalizeAnalyticsProperties,
} from './AnalyticsService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('analytics.track', () => {
  it('calls recordCustomEvent with name', () => {
    analytics.track('battle_start')
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('battle_start', undefined)
  })

  it('calls recordCustomEvent with properties', () => {
    analytics.track('battle_start', { level: 3, mode: 'campaign' })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'battle_start',
      { level: 3, mode: 'campaign' },
    )
  })
})

describe('analytics.trackFunnel', () => {
  it('calls trackFunnelStep with correct args', () => {
    analytics.trackFunnel(1, 'tutorial_start', 'onboarding')
    expect(RundotAPI.analytics.trackFunnelStep).toHaveBeenCalledWith(1, 'tutorial_start', 'onboarding')
  })
})

describe('analytics.trackEvent', () => {
  it('calls recordCustomEvent via event object', () => {
    analytics.trackEvent({ name: 'purchase', properties: { item: 'gem_pack' } })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('purchase', { item: 'gem_pack' })
  })
})

describe('analytics.trackCanonical', () => {
  it('normalizes canonical event properties to snake_case', () => {
    analytics.trackCanonical('premium_purchased', {
      offerType: 'starter_pack',
      playerGold: 1250,
      isVip: true,
      ignoredValue: undefined,
    })

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith('premium_purchased', {
      offer_type: 'starter_pack',
      player_gold: 1250,
      is_vip: true,
    })
  })

  it('provides shared helpers for session and identity events', () => {
    analytics.trackSessionEnd({
      screen: 'battle',
      trigger: 'quit',
      durationSeconds: 42,
    })
    analytics.trackPlayerIdentity({
      isSignedIn: true,
      hasProfileName: false,
    })

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenNthCalledWith(1, 'session_end', {
      screen: 'battle',
      trigger: 'quit',
      duration_seconds: 42,
    })
    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenNthCalledWith(2, 'player_identity', {
      is_signed_in: true,
      has_profile_name: false,
    })
  })
})

describe('analytics contract helpers', () => {
  it('exposes the shared exported event groups', () => {
    expect(COMMON_ANALYTICS_EVENT_GROUPS.coreLoop).toContain('run_started')
    expect(COMMON_ANALYTICS_EVENT_GROUPS.economy).toContain('currency_earned')
    expect(COMMON_ANALYTICS_EVENT_GROUPS.monetization).toContain('iap_purchase_complete')
  })

  it('normalizes keys and recognizes canonical names', () => {
    expect(normalizeAnalyticsProperties({ priceRunbucks: 100, offerType: 'starter' })).toEqual({
      price_runbucks: 100,
      offer_type: 'starter',
    })
    expect(isCanonicalAnalyticsEventName('session_end')).toBe(true)
    expect(isCanonicalAnalyticsEventName('custom_debug_ping')).toBe(false)
  })
})
