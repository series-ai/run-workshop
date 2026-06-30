import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  normalizeAnalyticsProperties,
  type CanonicalAnalyticsEventName,
  type PlayerIdentityEventProperties,
  type SessionEndEventProperties,
} from './contract'
import type { AnalyticsEvent, AnalyticsProperties } from './types'

export const analytics = {
  track(name: string, properties?: AnalyticsProperties): void {
    RundotAPI['analytics'].recordCustomEvent(name, properties)
  },

  trackFunnel(step: number, stepName: string, funnelName: string): void {
    RundotAPI['analytics'].trackFunnelStep(step, stepName, funnelName)
  },

  /** Convenience shorthand for tracking a named event with properties object */
  trackEvent(event: AnalyticsEvent): void {
    RundotAPI['analytics'].recordCustomEvent(event.name, event.properties)
  },

  /**
   * Tracks a shared analytics event with snake_case property normalization so
   * warehouse queries can aggregate across generated games more reliably.
   */
  trackCanonical(name: CanonicalAnalyticsEventName, properties?: AnalyticsProperties): void {
    RundotAPI['analytics'].recordCustomEvent(name, normalizeAnalyticsProperties(properties))
  },

  trackSessionEnd(properties: SessionEndEventProperties): void {
    analytics.trackCanonical('session_end', properties)
  },

  trackPlayerIdentity(properties: PlayerIdentityEventProperties): void {
    analytics.trackCanonical('player_identity', properties)
  },
}

export {
  COMMON_ANALYTICS_EVENT_GROUPS,
  isCanonicalAnalyticsEventName,
  normalizeAnalyticsProperties,
} from './contract'
