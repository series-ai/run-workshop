export type FeatureFlags = Record<string, boolean>
export interface FeatureFlagDebugSnapshot {
  flags: FeatureFlags
  baseFlags: FeatureFlags
  overrides: FeatureFlags
}
export interface FlagStore {
  flags: FeatureFlags
  enable(key: string): void
  disable(key: string): void
  isEnabled(key: string): boolean
  override(key: string, value: boolean): void
  resetOverrides(): void
  getDebugSnapshot(): FeatureFlagDebugSnapshot
}
