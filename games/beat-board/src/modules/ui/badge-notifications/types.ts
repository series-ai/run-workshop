export interface BadgeState { key: string; count: number; isNew: boolean }
export interface BadgeStore { badges: Record<string, BadgeState>; set(key: string, count: number): void; increment(key: string): void; clear(key: string): void; markSeen(key: string): void; total(): number }
