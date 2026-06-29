import { forwardRef, useState, type ButtonHTMLAttributes, type CSSProperties, type FocusEventHandler, type KeyboardEventHandler, type PointerEventHandler, type ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName, UiSkinRole } from './types'

type SkinButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'grid' | 'close' | 'back' | 'tab' | 'pill' | 'segment' | 'toggle'
export type SkinButtonTone = 'yellow' | 'green' | 'blue' | 'red' | 'gray' | 'purple'
export type SkinButtonLayout = 'default' | 'leading-visual' | 'trailing-visual' | 'leading-tile' | 'currency-stack' | 'grid-stack'
export type SkinButtonSize = 'default' | 'compact'

const ROLE_BY_VARIANT: Record<SkinButtonVariant, UiSkinRole> = {
  primary: 'button.primary',
  secondary: 'button.secondary',
  ghost: 'button.ghost',
  icon: 'button.icon',
  grid: 'button.grid',
  close: 'button.close',
  back: 'button.back',
  tab: 'button.tab',
  pill: 'button.pill',
  segment: 'button.segment',
  toggle: 'button.toggle',
}

const DEFAULT_ICON_BY_VARIANT: Partial<Record<SkinButtonVariant, UiSkinIconName>> = {
  close: 'close',
  back: 'back',
}

export type SkinRibbonPlacement = 'corner' | 'banner'

export interface SkinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SkinButtonVariant
  active?: boolean
  highlighted?: boolean
  iconName?: UiSkinIconName
  iconPosition?: 'start' | 'end'
  tone?: SkinButtonTone
  layout?: SkinButtonLayout
  size?: SkinButtonSize
  leadingVisual?: ReactNode
  trailingVisual?: ReactNode
  supportingText?: ReactNode
  floatingBadge?: ReactNode
  ribbon?: string
  ribbonPlacement?: SkinRibbonPlacement
  children?: ReactNode
}

function getBaseStyle(variant: SkinButtonVariant, iconOnly: boolean): CSSProperties {
  if (iconOnly) {
    if (variant === 'back') {
      return {
        minWidth: 'var(--ui-button-back-width, 52px)',
        width: 'var(--ui-button-back-width, 52px)',
        minHeight: 'var(--ui-button-back-height, 52px)',
        height: 'var(--ui-button-back-height, 52px)',
        padding: 0,
      }
    }

    if (variant === 'icon') {
      return {
        padding: 0,
      }
    }

    return {
      minWidth: 52,
      width: 52,
      minHeight: 52,
      height: 52,
      padding: 0,
    }
  }

  switch (variant) {
    case 'tab':
      return {}
    default:
      return {}
  }
}

export const SkinButton = forwardRef<HTMLButtonElement, SkinButtonProps>(function SkinButton({
  variant = 'primary',
  active = false,
  highlighted = false,
  iconName,
  iconPosition = 'start',
  tone,
  layout = 'default',
  size = 'default',
  leadingVisual,
  trailingVisual,
  supportingText,
  floatingBadge,
  ribbon,
  ribbonPlacement = 'corner',
  children,
  className,
  disabled = false,
  onBlur,
  onKeyDown,
  onKeyUp,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
  style,
  type = 'button',
  ...rest
}: SkinButtonProps, ref) {
  const [pressedByInput, setPressedByInput] = useState(false)
  const resolvedIcon = iconName ?? DEFAULT_ICON_BY_VARIANT[variant]
  const iconOnly = (variant === 'icon' || variant === 'close' || variant === 'back')
    && !children
    && !leadingVisual
    && !trailingVisual
    && !supportingText
  const surfaceState = disabled ? 'disabled' : active || pressedByInput ? 'active' : 'default'
  const role = ROLE_BY_VARIANT[variant]

  const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    onPointerDown?.(event)
    if (event.defaultPrevented || disabled || event.button !== 0) {
      return
    }
    setPressedByInput(true)
  }

  const handlePointerUp: PointerEventHandler<HTMLButtonElement> = (event) => {
    onPointerUp?.(event)
    setPressedByInput(false)
  }

  const handlePointerLeave: PointerEventHandler<HTMLButtonElement> = (event) => {
    onPointerLeave?.(event)
    setPressedByInput(false)
  }

  const handlePointerCancel: PointerEventHandler<HTMLButtonElement> = (event) => {
    onPointerCancel?.(event)
    setPressedByInput(false)
  }

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || disabled) {
      return
    }
    if (event.key === ' ' || event.key === 'Enter') {
      setPressedByInput(true)
    }
  }

  const handleKeyUp: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    onKeyUp?.(event)
    setPressedByInput(false)
  }

  const handleBlur: FocusEventHandler<HTMLButtonElement> = (event) => {
    onBlur?.(event)
    setPressedByInput(false)
  }

  const resolvedCurrencyVisual = leadingVisual ? (
    <span className="ui-button__currency-icon">
      {leadingVisual}
    </span>
  ) : resolvedIcon ? (
    <span className="ui-button__currency-icon">
      <SkinIcon name={resolvedIcon} size={20} />
    </span>
  ) : null

  const resolvedGridVisual = leadingVisual ? (
    <span className="ui-button__grid-icon">
      {leadingVisual}
    </span>
  ) : resolvedIcon ? (
    <span className="ui-button__grid-icon">
      <SkinIcon name={resolvedIcon} size={30} />
    </span>
  ) : null

  return (
    <button
      {...rest}
      className={joinClassName('ui-surface', 'ui-button', className)}
      data-icon-only={iconOnly ? 'true' : 'false'}
      data-state={surfaceState}
      data-ui-button-state={surfaceState}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role={role}
      data-variant={variant}
      data-highlighted={highlighted && !disabled ? 'true' : undefined}
      data-tone={tone}
      data-layout={layout}
      data-size={size}
      data-ribbon={ribbon ? ribbonPlacement : undefined}
      data-ribbon-text={ribbon || undefined}
      disabled={disabled}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      ref={ref}
      style={{
        ...getBaseStyle(variant, iconOnly),
        ...style,
      }}
      type={type}
    >
      <span className="ui-button__content" data-ui-slot="content">
        {layout === 'currency-stack' ? (
          <span className="ui-button__currency-stack">
            {children ? <span className="ui-button__currency-title" data-ui-slot="label">{children}</span> : null}
            {supportingText || resolvedCurrencyVisual ? (
              <span className="ui-button__currency-row">
                {resolvedCurrencyVisual}
                {supportingText ? <span className="ui-button__currency-amount" data-ui-slot="supporting">{supportingText}</span> : null}
              </span>
            ) : null}
          </span>
        ) : layout === 'grid-stack' ? (
          <span className="ui-button__grid-stack">
            {resolvedGridVisual}
            {children ? <span className="ui-button__grid-label" data-ui-slot="label">{children}</span> : null}
            {supportingText ? <span className="ui-button__grid-footnote" data-ui-slot="supporting">{supportingText}</span> : null}
          </span>
        ) : (
          <>
            {leadingVisual ? (
              <span className="ui-button__visual" data-slot="leading" data-ui-slot="leading">
                {leadingVisual}
              </span>
            ) : resolvedIcon && iconPosition === 'start' ? (
              <span className="ui-button__icon">
                <SkinIcon
                  color={variant === 'icon' || variant === 'close' || variant === 'back' ? 'currentColor' : undefined}
                  name={resolvedIcon}
                  size={variant === 'pill' ? 20 : 18}
                />
              </span>
            ) : null}
            {children ? (
              <span className="ui-button__copy" data-stack={supportingText ? 'true' : 'false'}>
                <span className="ui-button__label" data-ui-slot="label">{children}</span>
                {supportingText ? <span className="ui-button__supporting" data-ui-slot="supporting">{supportingText}</span> : null}
              </span>
            ) : null}
            {trailingVisual ? (
              <span className="ui-button__visual" data-slot="trailing" data-ui-slot="trailing">
                {trailingVisual}
              </span>
            ) : null}
            {resolvedIcon && iconPosition === 'end' ? (
              <span className="ui-button__icon">
                <SkinIcon name={resolvedIcon} size={variant === 'pill' ? 20 : 18} />
              </span>
            ) : null}
          </>
        )}
      </span>
      {floatingBadge}
      {ribbon ? <span className="ui-button__ribbon" data-placement={ribbonPlacement}>{ribbon}</span> : null}
    </button>
  )
})
