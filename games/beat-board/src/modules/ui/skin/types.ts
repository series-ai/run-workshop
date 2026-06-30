export const SYSTEM_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"

export const BUILTIN_UI_RENDERER_VARIANT_IDS = [
  'neutral-base',
  'editorial-narrative',
  'cozy-casual',
  'arcade-casual',
  'evergrove',
  'ornate-fantasy',
  'neon-scifi',
  'industrial-scifi',
] as const

export const DEFAULT_UI_RENDERER_VARIANT_ID = 'neutral-base'
export const DEFAULT_UI_THEME_ID = DEFAULT_UI_RENDERER_VARIANT_ID
export const BUILTIN_UI_ICON_PACK_IDS = ['lucide', 'phosphor', 'heroicons', 'tabler'] as const
export const DEFAULT_UI_ICON_PACK_ID = 'lucide'

export type BuiltInUiRendererVariantId = (typeof BUILTIN_UI_RENDERER_VARIANT_IDS)[number]
export type BuiltInUiSkinIconAssetId = (typeof BUILTIN_UI_ICON_PACK_IDS)[number]
export type UiRendererVariantId = BuiltInUiRendererVariantId
export type UiThemeId = BuiltInUiRendererVariantId
export type UiSkinIconAssetId = BuiltInUiSkinIconAssetId | (string & {})
export type UiSkinState = 'default' | 'active' | 'disabled'
export type UiSkinToastSeverity = 'info' | 'success' | 'warning' | 'error'

const BUILTIN_UI_RENDERER_VARIANT_SET = new Set<string>(BUILTIN_UI_RENDERER_VARIANT_IDS)
const BUILTIN_UI_ICON_PACK_SET = new Set<string>(BUILTIN_UI_ICON_PACK_IDS)

export interface UiRendererFontContract {
  body: string
  display: string
}

export interface GeneratedRendererConfig {
  variantId: UiRendererVariantId
  themeId: UiThemeId
  label: string
  iconAssetId: UiSkinIconAssetId
  defaultIconAssetId: UiSkinIconAssetId
  fontFamily: UiRendererFontContract
  fontUrls: string[]
}

export interface ThemeLike {
  fontFamily: UiRendererFontContract
  fontUrls: string[]
}

export function isBuiltInUiRendererVariantId(value: unknown): value is BuiltInUiRendererVariantId {
  return typeof value === 'string' && BUILTIN_UI_RENDERER_VARIANT_SET.has(value)
}

export function normalizeUiRendererVariantId(value: unknown): UiRendererVariantId | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }

  if (isBuiltInUiRendererVariantId(value)) {
    return value
  }

  return null
}

export function isBuiltInUiSkinIconAssetId(value: unknown): value is BuiltInUiSkinIconAssetId {
  return typeof value === 'string' && BUILTIN_UI_ICON_PACK_SET.has(value)
}

export function normalizeUiSkinIconAssetId(value: unknown): UiSkinIconAssetId | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized as UiSkinIconAssetId : null
}

export const UI_SKIN_ICON_NAMES = [
  // Currency & rewards
  'coin',
  'gem',
  'heart',
  'star',
  'sparkles',
  'flame',
  'trophy',
  'gift',
  'crown',
  // Actions
  'play',
  'plus',
  'check',
  'close',
  'back',
  'share',
  'copy',
  'undo',
  'redo',
  'pencil',
  'eraser',
  // Objects
  'shield',
  'sword',
  'skull',
  'bag',
  'shop',
  'cards',
  'package',
  'lock',
  'unlock',
  'link',
  // People & social
  'user',
  'users',
  // Status & feedback
  'info',
  'question',
  'help',
  'warning',
  'alert',
  'success',
  'error',
  // Navigation & system
  'home',
  'mail',
  'chat',
  'search',
  'megaphone',
  'settings',
  'gamepad',
  'clock',
  // Ranking
  'rank-1',
  'rank-2',
  'rank-3',
] as const

export type UiSkinIconName = (typeof UI_SKIN_ICON_NAMES)[number]

export type { UiSkinRole } from './roles'
