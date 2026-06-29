export type AnalyticsPropertyValue = string | number | boolean

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | null | undefined>

export const COMMON_ANALYTICS_EVENT_GROUPS = {
  coreLoop: [
    'game_opened',
    'screen_viewed',
    'ftue_started',
    'ftue_completed',
    'class_selected',
    'zone_selected',
    'game_mode_start',
    'run_started',
    'run_completed',
    'run_failed',
    'level_started',
    'level_completed',
    'level_failed',
    'floor_reached',
    'player_death',
  ],
  session: [
    'player_identity',
    'session_end',
  ],
  economy: [
    'currency_earned',
    'currency_spent',
    'shop_purchase',
    'mercenary_hired',
    'item_sold',
    'item_equipped',
    'reward_claimed',
  ],
  monetization: [
    'store_opened',
    'offer_shown',
    'offer_clicked',
    'offer_dismissed',
    'premium_purchased',
    'first_purchase',
    'iap_purchase_started',
    'iap_purchase_complete',
    'iap_purchase_failed',
    'rewarded_ad_offered',
    'rewarded_ad_watched',
    'rewarded_ad_dismissed',
    'interstitial_shown',
  ],
} as const

export type AnalyticsEventGroup = keyof typeof COMMON_ANALYTICS_EVENT_GROUPS

export type CanonicalAnalyticsEventName =
  (typeof COMMON_ANALYTICS_EVENT_GROUPS)[AnalyticsEventGroup][number]

export type SessionEndEventProperties = AnalyticsProperties & {
  screen: string
  trigger: string
  durationSeconds?: number
}

export type PlayerIdentityEventProperties = AnalyticsProperties & {
  isSignedIn: boolean
  hasProfileName?: boolean
}

const CANONICAL_EVENT_NAMES = new Set<CanonicalAnalyticsEventName>(
  Object.values(COMMON_ANALYTICS_EVENT_GROUPS).flat()
)

function toSnakeCaseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase()
}

export function normalizeAnalyticsProperties(
  properties?: AnalyticsProperties
): Record<string, AnalyticsPropertyValue> | undefined {
  if (!properties) {
    return undefined
  }

  const normalizedEntries = Object.entries(properties)
    .filter(
      (entry): entry is [string, AnalyticsPropertyValue] =>
        entry[1] !== undefined && entry[1] !== null,
    )
    .map(([key, value]) => [toSnakeCaseKey(key), value] as const)

  if (normalizedEntries.length === 0) {
    return undefined
  }

  return Object.fromEntries(normalizedEntries)
}

export function isCanonicalAnalyticsEventName(name: string): name is CanonicalAnalyticsEventName {
  return CANONICAL_EVENT_NAMES.has(name as CanonicalAnalyticsEventName)
}
