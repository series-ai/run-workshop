/**
 * Acceptance tests for issue beat-board-05-tab-navigation.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests exercise the navigation store + TabBar component
 * directly. Store-level tests use `useNavigationStore.getState()`; UI tests
 * render the TabBar via @testing-library/react and assert visible behavior.
 *
 * Authored as `.test.ts` (no JSX) to match the `owns` declaration in the
 * issue frontmatter exactly. React elements are constructed via
 * `React.createElement` so the file is a valid TypeScript module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { UiThemeProvider } from '@modules/ui/skin/theme/UiThemeProvider'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  useNavigationStore,
} from '../stores/navigationStore'
import { NAVIGATION } from '../tabs/tabConfig'
import { TabBar as ShellTabBar } from '../components/shell/TabBar'

const h = React.createElement
function withTheme(node: React.ReactNode) {
  return h(UiThemeProvider as React.ComponentType<{ as: string; children: React.ReactNode }>, { as: 'div' }, node)
}

function resetNav() {
  useNavigationStore.setState({
    config: null,
    activeTab: null,
    stack: [],
    modalStack: [],
    activeOverlay: null,
    badges: {},
    packsNewDot: false,
    tabBarGate: 'enabled',
    focusedMixId: null,
    importedFocusedMix: false,
    modalParams: {},
  })
  useNavigationStore.getState().configure(NAVIGATION)
}

describe('accept: Tab navigation — Play / Mixes / Packs / Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetNav()
  })

  // [state] navigationStore exposes activeTab + pushScreen/popScreen + openModal/closeModal
  it('navigationStore exposes activeTab, pushScreen, popScreen, openModal, closeModal', () => {
    const s = useNavigationStore.getState()
    expect(s.activeTab).toBe('play')
    expect(typeof s.pushScreen).toBe('function')
    expect(typeof s.popScreen).toBe('function')
    expect(typeof s.openModal).toBe('function')
    expect(typeof s.closeModal).toBe('function')
  })

  // [state] setActiveTab is idempotent and emits screen_viewed analytics
  it('setActiveTab is idempotent — calling twice with the same id does not double-emit screen_viewed', () => {
    const recordSpy = RundotAPI.analytics.recordCustomEvent as unknown as ReturnType<typeof vi.fn>
    recordSpy.mockClear()

    useNavigationStore.getState().setActiveTab('mixes')
    useNavigationStore.getState().setActiveTab('mixes')

    const calls = recordSpy.mock.calls.filter(([name]) => name === 'screen_viewed')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[1]).toMatchObject({ screen: 'mixes' })
    expect(useNavigationStore.getState().activeTab).toBe('mixes')
  })

  it('setActiveTab to a different id emits screen_viewed with that id', () => {
    const recordSpy = RundotAPI.analytics.recordCustomEvent as unknown as ReturnType<typeof vi.fn>
    recordSpy.mockClear()

    useNavigationStore.getState().setActiveTab('packs')

    const calls = recordSpy.mock.calls.filter(([name]) => name === 'screen_viewed')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[1]).toMatchObject({ screen: 'packs' })
  })

  // pushScreen / popScreen wrap navigateTo / navigateBack
  it('pushScreen appends to the stack; popScreen pops it', () => {
    useNavigationStore.getState().pushScreen('mixes')
    expect(useNavigationStore.getState().activeTab).toBe('mixes')
    useNavigationStore.getState().pushScreen('packs')
    expect(useNavigationStore.getState().activeTab).toBe('packs')
    useNavigationStore.getState().popScreen()
    // popScreen on a tab clears any pushed screens — tabs do not stack
    expect(useNavigationStore.getState().stack).toEqual([])
  })

  // openModal / closeModal manage a modal stack
  it('openModal appends to the modal stack; closeModal pops it', () => {
    useNavigationStore.getState().openModal('settings')
    expect(useNavigationStore.getState().modalStack).toEqual(['settings'])
    useNavigationStore.getState().openModal('credits')
    expect(useNavigationStore.getState().modalStack).toEqual(['settings', 'credits'])
    useNavigationStore.getState().closeModal()
    expect(useNavigationStore.getState().modalStack).toEqual(['settings'])
    useNavigationStore.getState().closeModal()
    expect(useNavigationStore.getState().modalStack).toEqual([])
  })

  it('openModal stores params keyed by modal name', () => {
    useNavigationStore.getState().openModal('pack-purchase', { packId: 'lofi-heights' })
    const params = useNavigationStore.getState().getModalParams('pack-purchase')
    expect(params).toMatchObject({ packId: 'lofi-heights' })
  })

  // [state] activeOverlay state field exists and can be set
  it('activeOverlay state field is null by default and accepts "ftue" / "fullscreen"', () => {
    expect(useNavigationStore.getState().activeOverlay).toBeNull()
    useNavigationStore.getState().setActiveOverlay('ftue')
    expect(useNavigationStore.getState().activeOverlay).toBe('ftue')
    useNavigationStore.getState().setActiveOverlay('fullscreen')
    expect(useNavigationStore.getState().activeOverlay).toBe('fullscreen')
    useNavigationStore.getState().setActiveOverlay(null)
    expect(useNavigationStore.getState().activeOverlay).toBeNull()
  })

  // Deep link handlers
  it('handleDeepLink({ kind: "idle_reminder" }) sets activeTab to play', () => {
    useNavigationStore.getState().setActiveTab('packs')
    useNavigationStore.getState().handleDeepLink({ kind: 'idle_reminder' })
    expect(useNavigationStore.getState().activeTab).toBe('play')
  })

  it('handleDeepLink({ kind: "share_link_received", mixId }) routes to mixes with focused mix', () => {
    useNavigationStore.getState().handleDeepLink({
      kind: 'share_link_received',
      mixId: 'mix-abc',
    })
    expect(useNavigationStore.getState().activeTab).toBe('mixes')
    expect(useNavigationStore.getState().focusedMixId).toBe('mix-abc')
    // Imported mix is always playback-only per prd.md § Navigation Architecture
    expect(useNavigationStore.getState().importedFocusedMix).toBe(true)
  })

  // ==== UI render tests for the shell/TabBar component ====
  describe('TabBar render', () => {
    it('renders four tabs with labels Play / Mixes / Packs / Settings in order', () => {
      const { container } = render(withTheme(h(ShellTabBar)))

      const labels = Array.from(container.querySelectorAll('.ui-tab-bar__label')).map(
        (el) => el.textContent,
      )
      expect(labels).toEqual(['Play', 'Mixes', 'Packs', 'Settings'])
    })

    it('Settings tab navigates to the settings root screen', () => {
      render(withTheme(h(ShellTabBar)))
      fireEvent.click(screen.getByText('Settings'))
      expect(useNavigationStore.getState().activeTab).toBe('settings')
    })

    it('tapping Mixes invokes setActiveTab and clears the mixes badge', () => {
      const recordSpy = RundotAPI.analytics.recordCustomEvent as unknown as ReturnType<
        typeof vi.fn
      >
      recordSpy.mockClear()
      useNavigationStore.getState().setBadge('mixes', 3)

      render(withTheme(h(ShellTabBar)))

      fireEvent.click(screen.getByText('Mixes'))

      expect(useNavigationStore.getState().activeTab).toBe('mixes')
      const calls = recordSpy.mock.calls.filter(([name]) => name === 'screen_viewed')
      expect(calls).toHaveLength(1)
      expect(useNavigationStore.getState().getBadge('mixes')).toBe(0)
    })

    it('Mixes tab renders a numeric badge equal to unviewed mix count', () => {
      useNavigationStore.getState().setBadge('mixes', 5)

      const { container } = render(withTheme(h(ShellTabBar)))

      const mixesButton = Array.from(container.querySelectorAll('.ui-tab-bar__item')).find(
        (el) => el.querySelector('.ui-tab-bar__label')?.textContent === 'Mixes',
      )
      const badge = mixesButton?.querySelector('.ui-tab-bar__badge')
      expect(badge?.textContent).toBe('5')
    })

    it('Packs tab renders a "NEW" dot when packs new dot signal is set', () => {
      useNavigationStore.getState().setPacksNewDot(true)

      const { container } = render(withTheme(h(ShellTabBar)))

      const packsButton = Array.from(container.querySelectorAll('.ui-tab-bar__item')).find(
        (el) => el.querySelector('.ui-tab-bar__label')?.textContent === 'Packs',
      )
      expect(packsButton?.getAttribute('data-new-dot')).toBe('true')
    })

    it('Packs tab dot disappears after tapping Packs', () => {
      useNavigationStore.getState().setPacksNewDot(true)

      const { container } = render(withTheme(h(ShellTabBar)))

      fireEvent.click(screen.getByText('Packs'))
      expect(useNavigationStore.getState().packsNewDot).toBe(false)
      const packsButton = Array.from(container.querySelectorAll('.ui-tab-bar__item')).find(
        (el) => el.querySelector('.ui-tab-bar__label')?.textContent === 'Packs',
      )
      expect(packsButton?.getAttribute('data-new-dot')).toBe('false')
    })

    it('renders the active tab with data-state="active"', () => {
      useNavigationStore.getState().setActiveTab('mixes')

      const { container } = render(withTheme(h(ShellTabBar)))

      const activeButton = container.querySelector(
        '.ui-tab-bar__item[data-state="active"]',
      ) as HTMLElement | null
      expect(activeButton?.querySelector('.ui-tab-bar__label')?.textContent).toBe('Mixes')
    })

    it('disables tab buttons when tabBarGate is "disabled"', () => {
      useNavigationStore.setState({ tabBarGate: 'disabled' })

      const { container } = render(withTheme(h(ShellTabBar)))

      const buttons = container.querySelectorAll('.ui-tab-bar__item')
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((b) => expect(b.hasAttribute('disabled')).toBe(true))
    })
  })
})
