export interface UnlockGate { featureKey: string; requiredLevel: number; requiredStep?: string; celebrationText?: string }
export interface UnlockState { unlockedFeatures: string[]; pendingCelebrations: string[] }
