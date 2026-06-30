export type SubscriptionTier = 'CORE' | 'PLUS' | 'PRIME' | 'ULTIMATE'
export type SubscriptionInterval = 'WEEKLY' | 'MONTHLY' | 'ANNUAL'

export interface SubscriptionPackage {
  interval: SubscriptionInterval
  price: number
  currencyCode: string
  description: string
}

export type RunSubscriptionsResponse = Record<string, SubscriptionPackage[]>

export interface NativeSubscriptionState {
  isSubscribed: boolean
  currentTier: SubscriptionTier | null
  subscriptions: RunSubscriptionsResponse
  isLoading: boolean
  error: string | null
}
