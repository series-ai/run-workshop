import { DEFAULT_UI_RENDERER_VARIANT_ID, type BuiltInUiRendererVariantId, type UiRendererVariantId } from '../types'
import { BUILTIN_UI_RENDERER_CATALOG } from './catalog'
import type { UiRendererDefinition, UiRendererRegistry, UiThemeDefinition } from './types'

export const BUILTIN_UI_RENDERERS: readonly UiThemeDefinition[] = [
  ...BUILTIN_UI_RENDERER_CATALOG.map((entry) => entry.manifest),
] as const

export const UI_THEME_REGISTRY: Readonly<Record<BuiltInUiRendererVariantId, UiThemeDefinition>> = Object.freeze(
  Object.fromEntries(BUILTIN_UI_RENDERERS.map((manifest) => [manifest.variantId, manifest])) as Record<
    BuiltInUiRendererVariantId,
    UiThemeDefinition
  >,
)

function labelFromVariantId(variantId: string): string {
  return variantId
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function createFallbackRendererDefinition(uiRendererVariantId: UiRendererVariantId): UiRendererDefinition {
  const baseTheme = UI_THEME_REGISTRY[DEFAULT_UI_RENDERER_VARIANT_ID]

  return {
    ...baseTheme,
    variantId: uiRendererVariantId,
    label: labelFromVariantId(uiRendererVariantId),
    summary: `Unregistered renderer ${uiRendererVariantId}; ${DEFAULT_UI_RENDERER_VARIANT_ID} fallback applied.`,
    themeId: DEFAULT_UI_RENDERER_VARIANT_ID,
    extendsVariantId: DEFAULT_UI_RENDERER_VARIANT_ID,
  }
}

export function createUiRendererRegistry(): UiRendererRegistry {
  return Object.freeze({ ...UI_THEME_REGISTRY })
}

export const UI_RENDERER_REGISTRY: UiRendererRegistry = createUiRendererRegistry()

export function getUiRendererDefinition(
  uiRendererVariantId: UiRendererVariantId,
  registry: UiRendererRegistry = UI_RENDERER_REGISTRY,
): UiRendererDefinition {
  return registry[uiRendererVariantId] ?? createFallbackRendererDefinition(uiRendererVariantId)
}

export function getUiThemeDefinition(themeId: BuiltInUiRendererVariantId): UiThemeDefinition {
  return UI_THEME_REGISTRY[themeId]
}

export function resolveUiThemeId(
  uiRendererVariantId: UiRendererVariantId,
  registry: UiRendererRegistry = UI_RENDERER_REGISTRY,
): BuiltInUiRendererVariantId {
  return getUiRendererDefinition(uiRendererVariantId, registry).themeId
}
