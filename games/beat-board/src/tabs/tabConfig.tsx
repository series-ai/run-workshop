/**
 * Navigation config — declare every screen in one place.
 *
 * BeatBoard has four root screens that map directly to the bottom tab bar:
 *   - play     → PadGridScreen     (primary gameplay)
 *   - mixes    → MyMixesScreen     (recording portfolio)
 *   - packs    → PackDrawerScreen  (content acquisition)
 *   - settings → SettingsTabScreen (audio, subscription, credits)
 *
 * The Settings tab replaces the previous top-right gear icon on Play. The
 * tab still routes to the existing `SettingsSheet` content; we render it
 * inside a tab shell so it lives alongside the other tab destinations.
 *
 * Pushed screens (KitDetail, RecordingReview, …) register below.
 */

import { defineNavigation } from '../shell/navigation'
import { useNavigationStore } from '../stores/navigationStore'
import { PadGridScreen } from '../components/screens/PadGridScreen'
import { MyMixesScreen } from '../components/screens/MyMixesScreen'
import { PackDrawerScreen } from '../components/screens/PackDrawerScreen'
import { KitDetailScreen } from '../components/screens/KitDetailScreen'
import { SettingsTabScreen } from '../components/screens/SettingsTabScreen'

export const NAVIGATION = defineNavigation({
  initial: 'play',
  screens: {
    play: {
      type: 'tab',
      label: 'Play',
      iconName: 'gamepad',
      render: () => <PadGridScreen />,
    },
    mixes: {
      type: 'tab',
      label: 'Mixes',
      iconName: 'cards',
      render: () => <MyMixesScreen />,
    },
    packs: {
      type: 'tab',
      label: 'Packs',
      iconName: 'shop',
      render: () => <PackDrawerScreen />,
    },
    settings: {
      type: 'tab',
      label: 'Settings',
      iconName: 'settings',
      render: () => <SettingsTabScreen />,
    },
    'kit-detail': {
      type: 'pushed',
      label: 'Kit detail',
      render: () => <KitDetailScreen />,
    },
    // Pushed screens land here in the implementation pass. Examples:
    // 'recording-review': { type: 'pushed', render: () => <RecordingReviewScreen /> },
  },
})

export type TabId = keyof typeof NAVIGATION.screens & string
export const DEFAULT_TAB_ID: TabId = NAVIGATION.initial

// Configure the nav store at module load so any importer (App.tsx, DebugApi,
// tests) gets a ready-to-use store without a separate boot step.
useNavigationStore.getState().configure(NAVIGATION)
