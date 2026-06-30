import { DEFAULT_UI_ICON_PACK_ID, type UiSkinIconName, type UiSkinIconAssetId } from '../types'
import { heroiconsUiSkinIconPack } from './heroiconsPack'
import { lucideUiSkinIconPack } from './lucidePack'
import { phosphorUiSkinIconPack } from './phosphorPack'
import { projectUiSkinIconOverrides, projectUiSkinIconPacks } from './projectOverrides'
import { createUiSkinSvgIcon, type UiSkinIconPack, type UiSkinResolvedIconComponent } from './runtime'
import { tablerUiSkinIconPack } from './tablerPack'

const BUILTIN_UI_SKIN_ICON_PACKS: readonly UiSkinIconPack[] = [
  lucideUiSkinIconPack,
  phosphorUiSkinIconPack,
  heroiconsUiSkinIconPack,
  tablerUiSkinIconPack,
]

const missingUiSkinIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6" />
    <path d="M15 9 9 15" />
  </>,
)

function buildRegisteredUiSkinIconPackMap(): ReadonlyMap<string, UiSkinIconPack> {
  const packs = new Map<string, UiSkinIconPack>()

  for (const pack of projectUiSkinIconPacks) {
    packs.set(pack.id, pack)
  }

  for (const pack of BUILTIN_UI_SKIN_ICON_PACKS) {
    if (!packs.has(pack.id)) {
      packs.set(pack.id, pack)
    }
  }

  return packs
}

export function getRegisteredUiSkinIconPacks(): readonly UiSkinIconPack[] {
  return Array.from(buildRegisteredUiSkinIconPackMap().values())
}

export function isUiSkinIconPackRegistered(iconAssetId: string): boolean {
  return buildRegisteredUiSkinIconPackMap().has(iconAssetId)
}

export function resolveUiSkinIconPack(
  requestedIconAssetId?: UiSkinIconAssetId | null,
  fallbackIconAssetId: UiSkinIconAssetId = DEFAULT_UI_ICON_PACK_ID,
): UiSkinIconPack {
  const registeredPacks = buildRegisteredUiSkinIconPackMap()

  if (requestedIconAssetId) {
    const matchedPack = registeredPacks.get(requestedIconAssetId)
    if (matchedPack) {
      return matchedPack
    }
  }

  const fallbackPack = registeredPacks.get(fallbackIconAssetId)
  if (fallbackPack) {
    return fallbackPack
  }

  const defaultPack = registeredPacks.get(DEFAULT_UI_ICON_PACK_ID)
  if (!defaultPack) {
    throw new Error(`Missing default UI icon pack "${DEFAULT_UI_ICON_PACK_ID}".`)
  }

  return defaultPack
}

export function getUiSkinIconPackLabel(iconAssetId: string): string {
  const registeredPacks = buildRegisteredUiSkinIconPackMap()
  return registeredPacks.get(iconAssetId)?.label ?? iconAssetId
}

export function resolveUiSkinIconComponent(
  iconName: UiSkinIconName,
  requestedIconAssetId?: UiSkinIconAssetId | null,
): UiSkinResolvedIconComponent {
  const overriddenIcon = projectUiSkinIconOverrides[iconName]
  if (overriddenIcon) {
    return overriddenIcon
  }

  const selectedPack = resolveUiSkinIconPack(requestedIconAssetId)
  return selectedPack.icons[iconName] ?? lucideUiSkinIconPack.icons[iconName] ?? missingUiSkinIcon
}
