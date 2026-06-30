/**
 * Navigation config — the single source of truth for every screen in the
 * game. One entry per screen; each entry declares whether it is a `tab`
 * (reachable from the tab bar / side rail, clears the back stack when
 * selected) or `pushed` (reached via `navigateTo()` from within another
 * screen, pushes onto the back stack).
 *
 * Because `screens` is a plain object literal, an id can exist in exactly
 * one place and a duplicate is a syntax error in TypeScript. A screen
 * cannot accidentally be both a tab and a pushed screen — the shape makes
 * that invariant structural, not enforced at runtime.
 *
 * `defineNavigation()` is the only constructor. It checks at import time
 * that `initial` names a tab screen in `screens`, failing fast so the
 * problem surfaces at module load rather than first navigation.
 */

import type { ReactNode } from 'react'
import type { UiSkinIconName } from '@modules/ui/skin'
import type { DesktopNavMode } from './config'

export type NavigationScreenType = 'tab' | 'pushed'

export interface NavigationScreen {
  /**
   * `tab` — rendered in the tab bar / side rail. Selecting it clears the
   * back stack and swaps the active tab.
   * `pushed` — not in the tab bar. Reached via `navigateTo(id)` from
   * another screen; pushed onto the back stack so `navigateBack()` returns
   * to the previous screen.
   */
  type: NavigationScreenType
  render: () => ReactNode
  /** Tab label. Required for `type: 'tab'`, ignored for `pushed`. */
  label?: string
  /** Tab icon. Required for `type: 'tab'`, ignored for `pushed`. */
  iconName?: UiSkinIconName
  /**
   * Whether the tab bar shows while this screen is active. Defaults to
   * `true` for tabs and `false` for pushed screens.
   */
  tabBarVisible?: boolean
  /** Desktop nav presentation override while this screen is active. */
  desktopNavMode?: DesktopNavMode
}

export interface NavigationConfig<
  S extends Readonly<Record<string, NavigationScreen>> = Readonly<
    Record<string, NavigationScreen>
  >,
> {
  readonly initial: keyof S & string
  readonly screens: S
}

/**
 * Declare the game's navigation. TypeScript infers `S` from the object
 * literal so `initial` must be a key of `screens`; typos and references to
 * missing screens fail at compile time.
 */
export function defineNavigation<
  S extends Readonly<Record<string, NavigationScreen>>,
>(config: { initial: keyof S & string; screens: S }): NavigationConfig<S> {
  const initial = config.screens[config.initial]
  if (!initial) {
    throw new Error(
      `[navigation] initial screen "${String(config.initial)}" is not a key of screens{}`,
    )
  }
  if (initial.type !== 'tab') {
    throw new Error(
      `[navigation] initial screen "${String(config.initial)}" must have type: 'tab'`,
    )
  }
  for (const [id, screen] of Object.entries(config.screens)) {
    if (screen.type === 'tab' && (!screen.label || !screen.iconName)) {
      throw new Error(
        `[navigation] tab screen "${id}" requires both label and iconName`,
      )
    }
  }
  return config
}

/** Filter to tab screens with their ids, in declaration order. */
export function listTabs<S extends Readonly<Record<string, NavigationScreen>>>(
  config: NavigationConfig<S>,
): Array<{ id: string; screen: NavigationScreen }> {
  return Object.entries(config.screens)
    .filter(([, s]) => s.type === 'tab')
    .map(([id, screen]) => ({ id, screen }))
}
