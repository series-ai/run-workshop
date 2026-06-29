import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { SkinSurface } from './SkinSurface'

export interface SkinSettingsRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  control?: ReactNode
  controlPlacement?: 'inline' | 'stacked'
}

export function SkinSettingsRow({
  title,
  description,
  control,
  controlPlacement = 'inline',
  children,
  style,
  ...rest
}: SkinSettingsRowProps) {
  return (
    <SkinSurface
      {...rest}
      as="section"
      skinRole="settings.row"
      className="ui-panel ui-settings-row"
      data-ui-settings-control-placement={controlPlacement}
      data-variant="section"
      style={{
        width: '100%',
        '--ui-panel-content-padding': '4px 6px',
        '--ui-panel-radius': '8px',
        '--ui-panel-body-padding': '0',
        '--ui-panel-body-radius': '0',
        '--ui-panel-body-fill': 'transparent',
        '--ui-panel-body-border-width': '0',
        '--ui-panel-body-shadow': 'none',
        ...style,
      } as CSSProperties}
    >
      <div className="ui-panel__content">
        <div className="ui-panel__body ui-settings-row__body">
          <div className="ui-settings-row__copy">
            <div className="ui-panel__title ui-settings-row__title">{title}</div>
            {description ? (
              <div className="ui-panel__subtitle ui-settings-row__description">
                {description}
              </div>
            ) : null}
            {children}
          </div>
          {control ? <div className="ui-settings-row__control">{control}</div> : null}
        </div>
      </div>
    </SkinSurface>
  )
}

export interface SkinSettingsSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

export function SkinSettingsSection({
  title,
  subtitle,
  actions,
  children,
  style,
  ...rest
}: SkinSettingsSectionProps) {
  const headerVisible = title || subtitle || actions

  return (
    <SkinSurface
      {...rest}
      as="section"
      skinRole="settings.section"
      className="ui-panel ui-settings-section"
      data-variant="card"
      style={{
        width: '100%',
        '--ui-panel-content-padding': '6px',
        '--ui-panel-body-padding': '0',
        '--ui-panel-body-radius': '0',
        '--ui-panel-body-fill': 'transparent',
        '--ui-panel-body-border-width': '0',
        '--ui-panel-body-shadow': 'none',
        ...style,
      } as CSSProperties}
    >
      <div className="ui-panel__content">
        {headerVisible ? (
          <div className="ui-panel__header ui-settings-section__header">
            <div className="ui-panel__titles">
              {title ? <div className="ui-panel__title">{title}</div> : null}
              {subtitle ? <div className="ui-panel__subtitle">{subtitle}</div> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </div>
        ) : null}
        {children ? <div className="ui-panel__body ui-settings-section__body">{children}</div> : null}
      </div>
    </SkinSurface>
  )
}
