import type {
  AnalyticsProperties,
  AnalyticsPropertyValue,
  CanonicalAnalyticsEventName,
  PlayerIdentityEventProperties,
  SessionEndEventProperties,
} from './contract'

export type { AnalyticsProperties, AnalyticsPropertyValue, CanonicalAnalyticsEventName }
export type { PlayerIdentityEventProperties, SessionEndEventProperties }

export interface AnalyticsEvent {
  name: string
  properties?: AnalyticsProperties
}
