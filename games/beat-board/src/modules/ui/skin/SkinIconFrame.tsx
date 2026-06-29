import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import { resolveIconFrameShellAsset } from './theme/rendererArt'
import { useUiTheme } from './theme/useUiTheme'
import type { UiSkinIconName } from './types'

export interface SkinIconFrameProps extends HTMLAttributes<HTMLElement> {
  iconName?: UiSkinIconName
  size?: number
  children?: ReactNode
}

export function SkinIconFrame({
  iconName,
  size = 56,
  children,
  className,
  style,
  ...rest
}: SkinIconFrameProps) {
  const { rendererVariantId } = useUiTheme()
  const content = children ?? (iconName ? <SkinIcon name={iconName} size={Math.max(18, Math.round(size * 0.36))} /> : null)
  const shellImage = resolveIconFrameShellAsset(rendererVariantId)
  const rendererBacked = Boolean(shellImage)

  return (
    <span
      {...rest}
      className={joinClassName('ui-surface', 'ui-icon-frame', className)}
      data-ui-renderer-backed={rendererBacked ? 'true' : 'false'}
      data-ui-renderer-mode={rendererBacked ? 'renderer-art' : 'css-theme'}
      data-ui-skin-role="frame.icon"
      style={{
        '--ui-icon-frame-size': `${size}px`,
        ...style,
      } as CSSProperties}
    >
      {shellImage ? (
        <span className="ui-icon-frame__art" aria-hidden="true">
          <img alt="" src={shellImage} />
        </span>
      ) : null}
      <span className="ui-icon-frame__content">{content}</span>
    </span>
  )
}
