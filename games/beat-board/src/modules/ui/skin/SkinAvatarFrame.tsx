import type { HTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinAvatarFrameProps extends HTMLAttributes<HTMLDivElement> {
  color?: string
  iconName?: UiSkinIconName
}

export function SkinAvatarFrame({ color, iconName = 'shield', className, style, ...rest }: SkinAvatarFrameProps) {
  return (
    <div
      {...rest}
      className={joinClassName('ui-avatar-frame', className)}
      data-ui-skin-role="frame.avatar"
      style={{ '--ui-avatar-color': color ?? 'var(--ui-text-muted)', ...style } as React.CSSProperties}
    >
      <SkinIcon className="ui-avatar-frame__icon" name={iconName} size={24} />
    </div>
  )
}
