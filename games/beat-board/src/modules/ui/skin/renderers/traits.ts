import { DEFAULT_UI_RENDERER_VARIANT_ID, type UiRendererVariantId } from '../types'
import { UI_RENDERER_LOCKED_GEOMETRY_TOKENS } from '../theme/geometry-contract'
import { BUILTIN_UI_RENDERER_CATALOG, type BuiltInUiRendererCatalogEntry } from './catalog'
import type { UiRendererArtProfile } from './types'

export const UI_RENDERER_OWNED_STYLE_DOMAINS = [
  'paint',
  'typography-family',
  'ornament',
  'shadow',
  'border',
  'art-assets',
] as const

export const UI_RENDERER_GEOMETRY_LOCKED_TOKENS = UI_RENDERER_LOCKED_GEOMETRY_TOKENS

const BUILTIN_UI_RENDERER_CATALOG_BY_ID: Readonly<Record<string, BuiltInUiRendererCatalogEntry>> = Object.freeze(
  Object.fromEntries(BUILTIN_UI_RENDERER_CATALOG.map((entry) => [entry.manifest.variantId, entry])),
)

function getDefaultUiRendererCatalogEntry(): BuiltInUiRendererCatalogEntry {
  const entry = BUILTIN_UI_RENDERER_CATALOG_BY_ID[DEFAULT_UI_RENDERER_VARIANT_ID]

  if (!entry) {
    throw new Error(`Missing built-in renderer catalog entry for ${DEFAULT_UI_RENDERER_VARIANT_ID}.`)
  }

  return entry
}

const DEFAULT_UI_RENDERER_CATALOG_ENTRY = getDefaultUiRendererCatalogEntry()

export function getBuiltInUiRendererCatalogEntryOrDefault(
  variantId: UiRendererVariantId | string,
): BuiltInUiRendererCatalogEntry {
  return BUILTIN_UI_RENDERER_CATALOG_BY_ID[variantId] ?? DEFAULT_UI_RENDERER_CATALOG_ENTRY
}

export function getUiRendererArtProfile(variantId: UiRendererVariantId | string): UiRendererArtProfile {
  return getBuiltInUiRendererCatalogEntryOrDefault(variantId).artProfile
}

export function usesFantasyRendererShells(variantId: UiRendererVariantId | string): boolean {
  return getUiRendererArtProfile(variantId).componentShells === 'fantasy'
}
