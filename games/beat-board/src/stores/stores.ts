/**
 * Stores barrel — every Zustand store the visual design surfaces depend on.
 * Importing through this file keeps the dependency graph one-deep so the
 * UI never imports across feature boundaries directly.
 */

export {
  useKitsStore,
  getKitById,
  type KitMeta,
  type KitOwnership,
  type KitTier,
} from './kitsStore'
export {
  usePadGridStore,
  padStateFor,
  PAD_PALETTE,
  type PadState,
  type RecordingMode,
  type PadPalette,
  type FxBypassMap,
} from './padGridStore'
export type { PadColor, PadBank, PadBlockId, PadMeta } from '../types/kit'
export { useMixesStore, type MixSummary } from './mixesStore'
export { useWalletStore } from './walletStore'
export {
  useSubscriptionStore,
  type GameSubscriptionTier,
  type SubscriptionState,
} from './subscriptionStore'

// Re-export the navigation store for parity with the rest of the scaffold.
export {
  useNavigationStore,
  useCurrentScreen,
  useCurrentScreenId,
  useCanGoBack,
  useTabBarVisible,
  useDesktopNavMode,
} from './navigationStore'
