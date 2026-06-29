import { resolveUiSkinIconComponent } from './icons/registry'
import type { UiSkinResolvedIconProps } from './icons/runtime'
import { useUiTheme } from './theme/useUiTheme'
import type { UiSkinIconName } from './types'

export interface SkinIconProps extends UiSkinResolvedIconProps {
  name: UiSkinIconName
}

export function SkinIcon({ name, ...rest }: SkinIconProps) {
  const { iconAssetId } = useUiTheme()
  const IconComponent = resolveUiSkinIconComponent(name, iconAssetId)
  return <IconComponent {...rest} />
}
