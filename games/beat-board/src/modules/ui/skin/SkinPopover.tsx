import type { HTMLAttributes, ReactNode } from 'react'
import { SkinSurface } from './SkinSurface'

export interface SkinPopoverProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

export function SkinPopover({
  title,
  subtitle,
  actions,
  children,
  style,
  ...rest
}: SkinPopoverProps) {
  const headerVisible = title || subtitle || actions

  return (
    <SkinSurface
      {...rest}
      as="section"
      skinRole="panel.popover"
      className="ui-panel"
      data-variant="popover"
      style={{
        width: 'min(360px, 100%)',
        maxWidth: '100%',
        ...style,
      }}
    >
      <div className="ui-panel__content">
        {headerVisible ? (
          <div className="ui-panel__header">
            <div className="ui-panel__titles">
              {title ? <div className="ui-panel__title">{title}</div> : null}
              {subtitle ? <div className="ui-panel__subtitle">{subtitle}</div> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </div>
        ) : null}
        {children ? <div className="ui-panel__body">{children}</div> : null}
      </div>
    </SkinSurface>
  )
}

export interface SkinTooltipProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label?: ReactNode
  title?: ReactNode
  children?: ReactNode
}

export function SkinTooltip({
  label,
  title,
  children,
  style,
  ...rest
}: SkinTooltipProps) {
  const body = children ?? label

  return (
    <SkinSurface
      {...rest}
      as="div"
      role="tooltip"
      skinRole="panel.tooltip"
      className="ui-panel"
      data-variant="section"
      style={{
        width: 'min(320px, 100%)',
        maxWidth: '100%',
        ...style,
      }}
    >
      <div className="ui-panel__content">
        <div className="ui-panel__body" style={{ display: 'grid', gap: '0.4rem' }}>
          {title ? (
            <div style={{ fontFamily: 'var(--ui-font-display, inherit)', fontSize: '13px' }}>
              {title}
            </div>
          ) : null}
          {body ? <div style={{ fontSize: '13px', lineHeight: 1.45 }}>{body}</div> : null}
        </div>
      </div>
    </SkinSurface>
  )
}
