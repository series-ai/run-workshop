import {
  normalizeUiRendererVariantId,
  type UiRendererVariantId,
} from '@modules/ui/skin/types'
import { listTabs, type NavigationScreen } from '../shell/navigation'
import { NAVIGATION } from '../tabs/tabConfig'

type PreviewTab = { id: string; label: string }

const DEFAULT_PREVIEW_TABS: PreviewTab[] = listTabs(NAVIGATION).map(({ id, screen }) => ({
  id,
  label: screen.label ?? id,
}))

export type PreviewOrientation = 'portrait' | 'landscape'

export interface PreviewRequest {
  previewId: string | null
  screen: string | null
  rendererVariantId: UiRendererVariantId | null
  orientation: PreviewOrientation | null
}

export interface PreviewDebugApi {
  ui: {
    reset: () => void
    openScreen: (screen: string) => void
  }
}

/**
 * Discover available preview screens from the app's tab/route config.
 * Returns tab IDs that can be used as `?preview=<id>` targets.
 */
export function discoverScreens(
  tabs: ReadonlyArray<PreviewTab> = DEFAULT_PREVIEW_TABS,
): ReadonlyArray<{ id: string; label: string }> {
  return tabs.map((tab) => ({ id: tab.id, label: tab.label }))
}

/**
 * Check whether a screen id is a known preview target.
 */
export function isKnownScreen(
  screenId: string,
  tabs: ReadonlyArray<Pick<PreviewTab, 'id'>> = DEFAULT_PREVIEW_TABS,
): boolean {
  return tabs.some((tab) => tab.id === screenId)
}

// Re-export for consumers that imported the screen type from here.
export type { NavigationScreen }

export function readPreviewRequest(search: string): PreviewRequest {
  const params = new URLSearchParams(search)
  const previewId = params.get('preview')
  const screen = params.get('screen')
  const rendererVariantId = normalizeUiRendererVariantId(params.get('renderer'))
  const orientationParam = params.get('orientation')
  const orientation =
    orientationParam === 'portrait' || orientationParam === 'landscape'
      ? orientationParam
      : null

  return {
    previewId: previewId && previewId.trim().length > 0 ? previewId : null,
    screen: screen && screen.trim().length > 0 ? screen : null,
    rendererVariantId,
    orientation,
  }
}

/**
 * Apply preview selection from URL search params.
 *
 * `?preview=<screen-id>` opens a screen by id (must be a known tab).
 * `?screen=<screen-id>` is a fallback that opens any screen directly.
 * Both support `&renderer=<variant>` and `&orientation=portrait|landscape`.
 */
export function applyPreviewSelection(
  search: string,
  debugApi: PreviewDebugApi | null | undefined = typeof window !== 'undefined' ? window.__GAME_DEBUG__ : undefined,
): void {
  if (!debugApi) {
    return
  }

  const request = readPreviewRequest(search)

  if (request.previewId) {
    debugApi.ui.reset()
    debugApi.ui.openScreen(request.previewId)
    return
  }

  if (request.screen) {
    debugApi.ui.reset()
    debugApi.ui.openScreen(request.screen)
  }
}
