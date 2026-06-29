export interface Tab { id: string; label: string; icon?: string; badge?: number }
export interface TabStore { tabs: Tab[]; activeTabId: string; setActive(id: string): void; setBadge(tabId: string, count: number): void; clearBadge(tabId: string): void }
