/**
 * BeatBoard tab bar — bottom-fixed, 56pt tall, 3 tabs (Play / Mixes / Packs).
 *
 * This is the canonical TabBar for the BeatBoard shell. It is built on top
 * of the `@modules/ui/skin` semantic surface (`Icon`, `Badge`) and consumes
 * the project's `NAVIGATION` declaration as the source of truth for tab
 * order, labels, and icons.
 *
 * Behavior matrix (per issue beat-board-05-tab-navigation):
 *   - Selecting a tab → `useNavigationStore.setActiveTab(id)`. That action
 *     is idempotent and emits a `screen_viewed` analytics event on actual
 *     change.
 *   - Mixes badge → numeric `badges['mixes']` value, cleared on Mixes tap.
 *   - Packs badge → "NEW" dot when `packsNewDot` is true OR the
 *     `packs_new_dot` feature flag is enabled. Cleared on Packs tap.
 *   - Active tab gets `data-state="active"` so the renderer can drive the
 *     scale-pulse animation specified in prd.md § Component Translation
 *     Table § Tab bar.
 *   - When `tabBarGate === 'disabled'` (FTUE step 1 or 2), every tab
 *     button is rendered with `disabled` so taps are ignored. The bar is
 *     still visible — full hide is driven separately by `activeOverlay`
 *     and `useTabBarVisible()`.
 *
 * Renderer chrome (colors, fonts, shadows, radius) comes from the active UI
 * renderer via the `.ui-tab-bar*` CSS classes shipped by
 * `@modules/ui/skin`. This component owns layout/structure only.
 */

import { useMemo } from 'react'
import { Badge, Icon } from '@modules/ui/skin'
import type { UiSkinIconName } from '@modules/ui/skin'
import { listTabs } from '../../shell/navigation'
import { NAVIGATION } from '../../tabs/tabConfig'
import { useNavigationStore } from '../../stores/navigationStore'
import { featureFlagStore } from '../../modules/data/feature-flags/FeatureFlags'

const PACKS_NEW_DOT_FLAG = 'packs_new_dot'

interface TabItem {
  id: string
  label: string
  iconName: UiSkinIconName
}

export const TabBar: React.FC = () => {
  const activeTab = useNavigationStore((s) => s.activeTab)
  const badges = useNavigationStore((s) => s.badges)
  const packsNewDot = useNavigationStore((s) => s.packsNewDot)
  const tabBarGate = useNavigationStore((s) => s.tabBarGate)
  const setActiveTab = useNavigationStore((s) => s.setActiveTab)
  const clearBadge = useNavigationStore((s) => s.clearBadge)
  const setPacksNewDot = useNavigationStore((s) => s.setPacksNewDot)

  // Feature flag check is read once per render — flag changes don't need
  // per-frame reactivity for this UI surface.
  const flagPacksNewDot = featureFlagStore((s) => s.flags[PACKS_NEW_DOT_FLAG] === true)

  const tabs: TabItem[] = useMemo(
    () =>
      listTabs(NAVIGATION).map(({ id, screen }) => ({
        id,
        label: screen.label!,
        iconName: screen.iconName!,
      })),
    [],
  )

  const disabled = tabBarGate === 'disabled'
  const activeId = activeTab ?? NAVIGATION.initial
  const showPacksDot = packsNewDot || flagPacksNewDot

  const handleSelect = (tabId: string) => {
    if (disabled) return
    setActiveTab(tabId)
    // Tab-tap badge clearing per acceptance criteria.
    if (tabId === 'mixes') {
      clearBadge('mixes')
    } else if (tabId === 'packs') {
      setPacksNewDot(false)
    }
  }

  return (
    <nav className="ui-tab-bar" data-ui-skin-role="nav.bottomBar" data-skin-role="nav.tabBar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        const badgeCount = badges[tab.id] ?? 0
        const hasBadge = badgeCount > 0
        const showNewDot = tab.id === 'packs' && showPacksDot

        return (
          <button
            key={tab.id}
            type="button"
            className="ui-tab-bar__item"
            data-state={isActive ? 'active' : 'default'}
            data-tab-id={tab.id}
            data-ftue={`tab-${tab.id}`}
            data-new-dot={showNewDot ? 'true' : 'false'}
            disabled={disabled}
            onClick={() => handleSelect(tab.id)}
          >
            <span className="ui-tab-bar__icon-wrap">
              <Icon className="ui-tab-bar__icon" name={tab.iconName} size={22} />
            </span>
            <span className="ui-tab-bar__label">{tab.label}</span>
            {hasBadge ? (
              <Badge.Counter className="ui-tab-bar__badge">{badgeCount}</Badge.Counter>
            ) : null}
            {showNewDot ? (
              <Badge.New className="ui-tab-bar__badge ui-tab-bar__badge--dot">NEW</Badge.New>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
