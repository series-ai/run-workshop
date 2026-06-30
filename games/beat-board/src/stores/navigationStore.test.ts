import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { defineNavigation } from '../shell/navigation'
import {
  useNavigationStore,
  useCurrentScreenId,
  useCanGoBack,
  useTabBarVisible,
  useDesktopNavMode,
} from './navigationStore'

const config = defineNavigation({
  initial: 'home',
  screens: {
    home: { type: 'tab', label: 'Home', iconName: 'home', render: () => null },
    shop: { type: 'tab', label: 'Shop', iconName: 'shop', render: () => null },
    'game-detail': { type: 'pushed', render: () => null },
    'tile-detail': { type: 'pushed', render: () => null, desktopNavMode: 'sidebar' },
  },
})

describe('navigationStore', () => {
  beforeEach(() => {
    useNavigationStore.setState({ config: null, activeTab: null, stack: [] })
    useNavigationStore.getState().configure(config)
  })

  it('starts on the initial tab with an empty stack', () => {
    expect(useNavigationStore.getState().activeTab).toBe('home')
    expect(useNavigationStore.getState().stack).toEqual([])
  })

  it('navigateTo a tab swaps activeTab and clears the stack', () => {
    useNavigationStore.getState().navigateTo('game-detail')
    expect(useNavigationStore.getState().stack).toEqual(['game-detail'])
    useNavigationStore.getState().navigateTo('shop')
    expect(useNavigationStore.getState().activeTab).toBe('shop')
    expect(useNavigationStore.getState().stack).toEqual([])
  })

  it('navigateTo a pushed screen appends to the stack without touching activeTab', () => {
    useNavigationStore.getState().navigateTo('game-detail')
    expect(useNavigationStore.getState().activeTab).toBe('home')
    expect(useNavigationStore.getState().stack).toEqual(['game-detail'])
    useNavigationStore.getState().navigateTo('tile-detail')
    expect(useNavigationStore.getState().stack).toEqual(['game-detail', 'tile-detail'])
  })

  it('navigateBack pops the top pushed screen', () => {
    useNavigationStore.getState().navigateTo('game-detail')
    useNavigationStore.getState().navigateTo('tile-detail')
    useNavigationStore.getState().navigateBack()
    expect(useNavigationStore.getState().stack).toEqual(['game-detail'])
    useNavigationStore.getState().navigateBack()
    expect(useNavigationStore.getState().stack).toEqual([])
  })

  it('navigateBack is a no-op when the stack is empty', () => {
    const before = useNavigationStore.getState()
    useNavigationStore.getState().navigateBack()
    const after = useNavigationStore.getState()
    expect(after.activeTab).toBe(before.activeTab)
    expect(after.stack).toEqual([])
  })

  it('navigateHome returns to the initial tab and clears the stack', () => {
    useNavigationStore.getState().navigateTo('shop')
    useNavigationStore.getState().navigateTo('tile-detail')
    useNavigationStore.getState().navigateHome()
    expect(useNavigationStore.getState().activeTab).toBe('home')
    expect(useNavigationStore.getState().stack).toEqual([])
  })

  it('throws on an unknown screen id', () => {
    expect(() => useNavigationStore.getState().navigateTo('does-not-exist')).toThrow(
      /unknown screen id/,
    )
  })

  it('throws when navigateTo runs before configure()', () => {
    useNavigationStore.setState({ config: null, activeTab: null, stack: [] })
    expect(() => useNavigationStore.getState().navigateTo('home')).toThrow(
      /before configure/,
    )
  })

  it('derives currentScreenId, canGoBack, tabBarVisible, desktopNavMode from state', () => {
    const id = renderHook(() => useCurrentScreenId())
    const back = renderHook(() => useCanGoBack())
    const tabBar = renderHook(() => useTabBarVisible())
    const desktop = renderHook(() => useDesktopNavMode())

    expect(id.result.current).toBe('home')
    expect(back.result.current).toBe(false)
    expect(tabBar.result.current).toBe(true)

    useNavigationStore.getState().navigateTo('tile-detail')
    id.rerender()
    back.rerender()
    tabBar.rerender()
    desktop.rerender()

    expect(id.result.current).toBe('tile-detail')
    expect(back.result.current).toBe(true)
    expect(tabBar.result.current).toBe(false) // pushed default
    expect(desktop.result.current).toBe('sidebar') // screen override
  })
})
