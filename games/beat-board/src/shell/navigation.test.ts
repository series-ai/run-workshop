import { describe, expect, it } from 'vitest'
import { defineNavigation, listTabs } from './navigation'

describe('defineNavigation', () => {
  it('accepts a minimal tab-only config', () => {
    const nav = defineNavigation({
      initial: 'home',
      screens: {
        home: { type: 'tab', label: 'Home', iconName: 'home', render: () => null },
        shop: { type: 'tab', label: 'Shop', iconName: 'shop', render: () => null },
      },
    })
    expect(nav.initial).toBe('home')
    expect(Object.keys(nav.screens)).toEqual(['home', 'shop'])
  })

  it('accepts tabs and pushed screens in the same map', () => {
    const nav = defineNavigation({
      initial: 'board',
      screens: {
        board: { type: 'tab', label: 'Board', iconName: 'home', render: () => null },
        'tile-detail': { type: 'pushed', render: () => null },
      },
    })
    const tabs = listTabs(nav)
    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.id).toBe('board')
  })

  it('throws when initial is missing from screens', () => {
    expect(() =>
      // @ts-expect-error — initial must be a key of screens
      defineNavigation({
        initial: 'missing',
        screens: {
          home: { type: 'tab', label: 'Home', iconName: 'home', render: () => null },
        },
      }),
    ).toThrow(/is not a key of screens/)
  })

  it('throws when initial is a pushed screen', () => {
    expect(() =>
      defineNavigation({
        initial: 'detail',
        screens: {
          detail: { type: 'pushed', render: () => null },
          home: { type: 'tab', label: 'Home', iconName: 'home', render: () => null },
        },
      }),
    ).toThrow(/must have type: 'tab'/)
  })

  it('throws when a tab screen is missing label or iconName', () => {
    expect(() =>
      defineNavigation({
        initial: 'home',
        screens: {
          home: { type: 'tab', render: () => null },
        },
      }),
    ).toThrow(/requires both label and iconName/)
  })
})
