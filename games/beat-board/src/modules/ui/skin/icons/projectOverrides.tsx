import type { UiSkinIconName } from '../types'
import type { UiSkinIconPack, UiSkinResolvedIconComponent } from './runtime'

// Projects can register alternate icon packs or override individual semantic
// icons with custom SVG components here without changing semantic call sites.
export const projectUiSkinIconPacks: readonly UiSkinIconPack[] = []

export const projectUiSkinIconOverrides: Readonly<Partial<Record<UiSkinIconName, UiSkinResolvedIconComponent>>> = {}
