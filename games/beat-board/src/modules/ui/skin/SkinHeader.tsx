import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'
import { resolveHeaderShellAsset } from './theme/rendererArt'
import { useUiTheme } from './theme/useUiTheme'

type SkinHeaderVariant = 'default' | 'banner' | 'ribbon'

export interface SkinHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  targetHeight?: number
  variant?: SkinHeaderVariant
}

export function SkinHeader({
  title,
  eyebrow,
  subtitle,
  targetHeight = 58,
  variant = 'default',
  className,
  style,
  ...rest
}: SkinHeaderProps) {
  const { rendererVariantId } = useUiTheme()
  const shellImage = resolveHeaderShellAsset(rendererVariantId, variant)
  const usesInlineSubtitle = variant !== 'default'
  const resolvedTargetHeight = variant === 'banner'
    ? 76
    : variant === 'ribbon'
      ? undefined
      : shellImage
        ? Math.max(targetHeight, 72)
        : targetHeight
  const rendererBacked = Boolean(shellImage)

  return (
    <header
      {...rest}
      className={joinClassName('ui-header', className)}
      data-variant={variant}
      data-ui-renderer-backed={rendererBacked ? 'true' : 'false'}
      data-ui-renderer-mode={rendererBacked ? 'renderer-art' : 'css-theme'}
      data-ui-skin-role="frame.header"
      style={style}
    >
      <div className="ui-header__ribbon">
        {shellImage ? (
          <span className="ui-header__art" aria-hidden="true">
            <img alt="" src={shellImage} />
          </span>
        ) : null}
        <div className="ui-header__content" style={{ minHeight: resolvedTargetHeight }}>
          {eyebrow ? <div className="ui-header__eyebrow">{eyebrow}</div> : null}
          <div className="ui-header__title">{title}</div>
          {usesInlineSubtitle && subtitle ? <div className="ui-header__subtitle ui-header__subtitle--inline">{subtitle}</div> : null}
        </div>
      </div>
      {!usesInlineSubtitle && subtitle ? <div className="ui-header__subtitle">{subtitle}</div> : null}
    </header>
  )
}
