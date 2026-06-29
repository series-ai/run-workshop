/**
 * Navigation store — derives all routing state from a single
 * `NavigationConfig`. The store exposes `navigateTo`, `navigateBack`, and
 * `navigateHome`; tab-bar visibility and desktop nav mode are derived from
 * the currently active screen's config entry rather than set imperatively.
 *
 * In addition to the canonical scaffold-tier API, this store carries the
 * BeatBoard-specific surface needed by the bottom tab bar (issue
 * `beat-board-05-tab-navigation`):
 *   - `setActiveTab(tab)` — idempotent tab-switch that emits a single
 *     `screen_viewed` analytics event per actual change.
 *   - `pushScreen(name, params?)` / `popScreen()` — semantic aliases for
 *     `navigateTo` / `navigateBack` that match the wording used in the PRD.
 *   - `openModal(name, params?)` / `closeModal()` — modal stack distinct
 *     from the screen stack (modals overlay the current screen).
 *   - `activeOverlay` — `'ftue' | 'fullscreen' | null` — set externally by
 *     full-screen overlays so the tab bar can hide.
 *   - `badges` / `setBadge` / `clearBadge` / `getBadge` — per-tab numeric
 *     unviewed counters (used by the Mixes tab).
 *   - `packsNewDot` — boolean signal for the Packs "NEW" dot.
 *   - `tabBarGate` — `'enabled' | 'disabled'` — set externally by the FTUE
 *     engine to gate tab-bar interaction during onboarding steps 1 & 2.
 *   - `handleDeepLink(payload)` — routes platform deep links per
 *     prd.md § Navigation Architecture § Deep links.
 *
 * Shape guarantees:
 * - `activeTab` is always a tab id from the config (or `null` before
 *   `configure()` runs).
 * - `stack` contains only pushed-screen ids.
 * - `currentScreenId` is the top of `stack` if non-empty, else `activeTab`.
 */

import { create } from 'zustand'
import { appShellConfig, type DesktopNavMode } from '../shell/config'
import type { NavigationConfig, NavigationScreen } from '../shell/navigation'
import { analytics } from '../modules/data/analytics-service/AnalyticsService'

export type NavigationOverlayKind = 'ftue' | 'fullscreen' | null
export type NavigationGateState = 'enabled' | 'disabled'

export type DeepLinkPayload =
  | { kind: 'idle_reminder' }
  | { kind: 'share_link_received'; mixId: string }

export interface NavigationState {
  config: NavigationConfig | null
  activeTab: string | null
  stack: string[]
  modalStack: string[]
  modalParams: Record<string, unknown>
  activeOverlay: NavigationOverlayKind
  badges: Record<string, number>
  packsNewDot: boolean
  tabBarGate: NavigationGateState
  focusedMixId: string | null
  importedFocusedMix: boolean

  configure: <S extends Readonly<Record<string, NavigationScreen>>>(
    config: NavigationConfig<S>,
  ) => void

  // Canonical template API
  navigateTo: (screenId: string) => void
  navigateBack: () => void
  navigateHome: () => void

  // Tab-bar API per issue beat-board-05-tab-navigation
  setActiveTab: (tab: string) => void
  pushScreen: (name: string, params?: Record<string, unknown>) => void
  popScreen: () => void
  openModal: (name: string, params?: Record<string, unknown>) => void
  closeModal: () => void
  getModalParams: (name: string) => Record<string, unknown> | undefined

  setActiveOverlay: (overlay: NavigationOverlayKind) => void
  setTabBarGate: (state: NavigationGateState) => void

  setBadge: (tabId: string, count: number) => void
  clearBadge: (tabId: string) => void
  getBadge: (tabId: string) => number
  setPacksNewDot: (value: boolean) => void

  handleDeepLink: (payload: DeepLinkPayload) => void
  setFocusedMix: (mixId: string | null, imported?: boolean) => void
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  config: null,
  activeTab: null,
  stack: [],
  modalStack: [],
  modalParams: {},
  activeOverlay: null,
  badges: {},
  packsNewDot: false,
  tabBarGate: 'enabled',
  focusedMixId: null,
  importedFocusedMix: false,

  configure: (config) => {
    // Widen the specific generic instance to the store's internal
    // NavigationConfig shape. The external API is sound because navigateTo
    // / navigateBack operate on string keys.
    set({
      config: config as unknown as NavigationConfig,
      activeTab: config.initial,
      stack: [],
    })
  },

  navigateTo: (screenId) => {
    const { config } = get()
    if (!config) {
      throw new Error('[navigation] navigateTo called before configure()')
    }
    const screen = config.screens[screenId]
    if (!screen) {
      throw new Error(
        `[navigation] unknown screen id "${screenId}" — declare it in the navigation config`,
      )
    }
    if (screen.type === 'tab') {
      set({ activeTab: screenId, stack: [] })
    } else {
      set((s) => ({ stack: [...s.stack, screenId] }))
    }
  },

  navigateBack: () => {
    set((s) => (s.stack.length === 0 ? s : { ...s, stack: s.stack.slice(0, -1) }))
  },

  navigateHome: () => {
    const { config } = get()
    if (!config) return
    set({ activeTab: config.initial, stack: [] })
  },

  // ===== Tab-bar API =====

  setActiveTab: (tab) => {
    const { activeTab, config } = get()
    if (!config) {
      throw new Error('[navigation] setActiveTab called before configure()')
    }
    const screen = config.screens[tab]
    if (!screen || screen.type !== 'tab') {
      throw new Error(
        `[navigation] setActiveTab: "${tab}" is not a tab screen in the navigation config`,
      )
    }
    // Idempotent — only emit analytics + mutate state when the tab actually
    // changes. Calling setActiveTab(currentTab) is a no-op.
    if (activeTab === tab) return

    set({ activeTab: tab, stack: [] })
    analytics.track('screen_viewed', { screen: tab })
  },

  pushScreen: (name, params) => {
    const { config } = get()
    if (!config) {
      throw new Error('[navigation] pushScreen called before configure()')
    }
    const screen = config.screens[name]
    if (!screen) {
      throw new Error(`[navigation] pushScreen: unknown screen id "${name}"`)
    }
    if (screen.type === 'tab') {
      // Pushing a tab swaps tabs (consistent with navigateTo).
      get().setActiveTab(name)
    } else {
      set((s) => ({ stack: [...s.stack, name] }))
    }
    if (params) {
      set((s) => ({ modalParams: { ...s.modalParams, [name]: params } }))
    }
  },

  popScreen: () => {
    set((s) => (s.stack.length === 0 ? s : { ...s, stack: s.stack.slice(0, -1) }))
  },

  openModal: (name, params) => {
    set((s) => ({
      modalStack: [...s.modalStack, name],
      modalParams: params !== undefined ? { ...s.modalParams, [name]: params } : s.modalParams,
    }))
  },

  closeModal: () => {
    set((s) => {
      if (s.modalStack.length === 0) return s
      const next = s.modalStack.slice(0, -1)
      const closed = s.modalStack[s.modalStack.length - 1]
      const nextParams = { ...s.modalParams }
      if (closed !== undefined) {
        delete nextParams[closed]
      }
      return { ...s, modalStack: next, modalParams: nextParams }
    })
  },

  getModalParams: (name) => {
    return get().modalParams[name] as Record<string, unknown> | undefined
  },

  setActiveOverlay: (overlay) => set({ activeOverlay: overlay }),

  setTabBarGate: (state) => set({ tabBarGate: state }),

  setBadge: (tabId, count) => {
    set((s) => ({ badges: { ...s.badges, [tabId]: Math.max(0, count) } }))
  },

  clearBadge: (tabId) => {
    set((s) => ({ badges: { ...s.badges, [tabId]: 0 } }))
  },

  getBadge: (tabId) => {
    return get().badges[tabId] ?? 0
  },

  setPacksNewDot: (value) => set({ packsNewDot: value }),

  setFocusedMix: (mixId, imported = false) => {
    set({ focusedMixId: mixId, importedFocusedMix: imported })
  },

  handleDeepLink: (payload) => {
    if (payload.kind === 'idle_reminder') {
      get().setActiveTab('play')
      return
    }
    if (payload.kind === 'share_link_received') {
      // Imported mixes are always playback-only per prd.md
      // § Navigation Architecture § Deep links (license-safe).
      set({ focusedMixId: payload.mixId, importedFocusedMix: true })
      get().setActiveTab('mixes')
      return
    }
  },
}))

function currentScreenIdFrom(state: NavigationState): string | null {
  if (state.stack.length > 0) return state.stack[state.stack.length - 1] ?? null
  return state.activeTab
}

function currentScreenFrom(state: NavigationState): NavigationScreen | null {
  if (!state.config) return null
  const id = currentScreenIdFrom(state)
  return id ? state.config.screens[id] ?? null : null
}

/** The id of the screen currently rendered (top of stack if pushed, else active tab). */
export function useCurrentScreenId(): string | null {
  return useNavigationStore(currentScreenIdFrom)
}

/** The screen definition currently rendered. */
export function useCurrentScreen(): NavigationScreen | null {
  return useNavigationStore(currentScreenFrom)
}

/** True when there is at least one pushed screen on the stack. */
export function useCanGoBack(): boolean {
  return useNavigationStore((s) => s.stack.length > 0)
}

/**
 * Tab bar visibility. Pushed screens hide the tab bar by default;
 * individual screens override via `tabBarVisible: true | false` in their
 * config entry. Full-screen overlays (`activeOverlay === 'ftue' |
 * 'fullscreen'`) suppress the tab bar entirely.
 */
export function useTabBarVisible(): boolean {
  return useNavigationStore((s) => {
    if (s.activeOverlay === 'ftue' || s.activeOverlay === 'fullscreen') return false
    const screen = currentScreenFrom(s)
    if (!screen) return false
    return screen.tabBarVisible ?? screen.type === 'tab'
  })
}

/**
 * Desktop nav mode, derived from the current screen. Pushed screens default
 * to `rail`; tabs default to `appShellConfig.desktopNavMode`. Individual
 * screens override via `desktopNavMode` in their config entry.
 */
export function useDesktopNavMode(): DesktopNavMode {
  return useNavigationStore((s) => {
    const screen = currentScreenFrom(s)
    if (screen?.desktopNavMode) return screen.desktopNavMode
    if (screen?.type === 'pushed') return 'rail'
    return appShellConfig.desktopNavMode
  })
}
