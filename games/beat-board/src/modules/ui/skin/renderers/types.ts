import type { BuiltInUiRendererVariantId, UiRendererVariantId, UiSkinIconAssetId } from '../types'

export interface UiRendererFontContract {
  body: string
  display: string
}

export type UiRendererDesignFamilyId = 'baseline' | 'casual' | 'fantasy' | 'sci-fi'
export type UiRendererComponentShellProfile = 'standard' | 'fantasy'
export type UiRendererHeaderShellProfile = 'shared' | 'fantasy' | 'none'
export type UiRendererTicketShellProfile = 'shared' | 'fantasy' | 'none'
export type UiRendererIconFrameShellProfile = 'none' | 'fantasy'
export type UiRendererInspectorTone = 'light' | 'dark'

export interface UiRendererArtProfile {
  componentShells: UiRendererComponentShellProfile
  headerShells: UiRendererHeaderShellProfile
  ticketShells: UiRendererTicketShellProfile
  iconFrameShells: UiRendererIconFrameShellProfile
  inspectorTone: UiRendererInspectorTone
}

export interface UiRendererSelectionProfile {
  designFamilyId: UiRendererDesignFamilyId
  designFamilyLabel: string
  selectionSummary: string
  bestFor: readonly string[]
  avoidFor: readonly string[]
  keywords: readonly string[]
  avoidKeywords: readonly string[]
}

export interface UiRendererManifest {
  variantId: UiRendererVariantId
  label: string
  summary: string
  themeId: BuiltInUiRendererVariantId
  defaultIconAssetId: UiSkinIconAssetId
  extendsVariantId: BuiltInUiRendererVariantId | null
  fontFamily: UiRendererFontContract
  fontUrls: string[]
  semanticCoverage: 'full'
}

export interface UiThemeDefinition extends UiRendererManifest {
  variantId: BuiltInUiRendererVariantId
  extendsVariantId: null
}

export type UiRendererDefinition = UiRendererManifest
export type UiRendererRegistry = Readonly<Record<string, UiRendererManifest>>
