export interface Entitlement {
  entitlementId: string
  itemId: string
  quantity: number
  consumable: boolean
  status: 'active' | 'revoked' | 'expired'
  expiresAt: number | null
}

export interface LedgerEntry {
  entitlementId: string
  itemId: string
  quantity: number
  reason: string
  referenceId: string | null
  createdAt: number
}

export interface EntitlementState {
  entitlements: Map<string, Entitlement>
  isLoading: boolean
  error: string | null
}
