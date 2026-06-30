import type { UiRendererVariantId } from '../types'
import { getUiRendererArtProfile } from '../renderers/traits'

const SHARED_HEADER_SHELL_BY_VARIANT = {
  banner: new URL('./svg/header-banner-notch.svg', import.meta.url).href,
  ribbon: new URL('./svg/header-ribbon-wings.svg', import.meta.url).href,
} as const

// Fantasy-shell SVG assets live in renderers/active/ and only exist when the
// installed renderer provides them. @vite-ignore suppresses build-time
// warnings for non-fantasy-shell variants — the URLs resolve at runtime only
// when those assets are present, so missing files are expected elsewhere.
const FANTASY_HEADER_SHELL_BY_VARIANT = {
  default: new URL(/* @vite-ignore */'../renderers/active/tab-shell.svg', import.meta.url).href,
  banner: new URL(/* @vite-ignore */'../renderers/active/hero-plaque-shell.svg', import.meta.url).href,
  ribbon: new URL(/* @vite-ignore */'../renderers/active/hero-ribbon-shell.svg', import.meta.url).href,
} as const

const SHARED_TICKET_SHELL = new URL('./svg/ticket-shell.svg', import.meta.url).href
const FANTASY_TICKET_SHELL = new URL(/* @vite-ignore */'../renderers/active/ticket-shell.svg', import.meta.url).href
const FANTASY_ICON_FRAME_SHELL = new URL(/* @vite-ignore */'../renderers/active/medallion-shell.svg', import.meta.url).href

export function resolveHeaderShellAsset(
  rendererVariantId: UiRendererVariantId,
  variant: 'default' | 'banner' | 'ribbon',
): string | undefined {
  const artProfile = getUiRendererArtProfile(rendererVariantId)

  // All header variants are now pure CSS — no SVG shells
  if (variant === 'ribbon' || variant === 'banner') return undefined

  if (artProfile.headerShells === 'fantasy') {
    return FANTASY_HEADER_SHELL_BY_VARIANT[variant]
  }

  if (artProfile.headerShells === 'none') {
    return undefined
  }

  return variant === 'default' ? undefined : SHARED_HEADER_SHELL_BY_VARIANT[variant]
}

export function resolveTicketShellAsset(rendererVariantId: UiRendererVariantId): string | undefined {
  const artProfile = getUiRendererArtProfile(rendererVariantId)

  if (artProfile.ticketShells === 'fantasy') return FANTASY_TICKET_SHELL
  if (artProfile.ticketShells === 'none') return undefined
  return SHARED_TICKET_SHELL
}

export function resolveIconFrameShellAsset(rendererVariantId: UiRendererVariantId): string | undefined {
  return getUiRendererArtProfile(rendererVariantId).iconFrameShells === 'fantasy' ? FANTASY_ICON_FRAME_SHELL : undefined
}
