import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'
import type { UiSkinRole } from './types'

type SkinPanelVariant =
  | 'card'
  | 'section'
  | 'modal'
  | 'sheet'
  | 'dialog-confirmation'
  | 'dialog-reward'
  | 'tab-bar'

const ROLE_BY_VARIANT: Record<SkinPanelVariant, UiSkinRole> = {
  card: 'panel.card',
  section: 'panel.section',
  modal: 'panel.modal',
  sheet: 'panel.sheet',
  'dialog-confirmation': 'dialog.confirmation',
  'dialog-reward': 'dialog.reward',
  'tab-bar': 'nav.tabBar',
}

export type SkinPanelRibbonPlacement = 'corner' | 'banner'

export interface SkinPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  variant?: SkinPanelVariant
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  ribbon?: string
  ribbonPlacement?: SkinPanelRibbonPlacement
  children?: ReactNode
}

export function SkinPanel({
  variant = 'card',
  title,
  subtitle,
  actions,
  ribbon,
  ribbonPlacement = 'corner',
  children,
  className,
  style,
  ...rest
}: SkinPanelProps) {
  const role = ROLE_BY_VARIANT[variant]

  return (
    <section
      {...rest}
      className={joinClassName('ui-surface', 'ui-panel', className)}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role={role}
      data-variant={variant}
      data-ribbon={ribbon ? ribbonPlacement : undefined}
      data-ribbon-text={ribbon || undefined}
      style={style}
    >
      <span aria-hidden className="ui-panel__chrome" />
      <div className="ui-panel__content" data-ui-slot="content">
        {title || subtitle || actions ? (
          <div className="ui-panel__header" data-ui-slot="header">
            <div className="ui-panel__titles" data-ui-slot="titles">
              {title ? <div className="ui-panel__title" data-ui-slot="title">{title}</div> : null}
              {subtitle ? <div className="ui-panel__subtitle" data-ui-slot="subtitle">{subtitle}</div> : null}
            </div>
            {actions ? <div className="ui-panel__actions" data-ui-slot="actions">{actions}</div> : null}
          </div>
        ) : null}
        {children ? <div className="ui-panel__body" data-ui-slot="body">{children}</div> : null}
      </div>
    </section>
  )
}
