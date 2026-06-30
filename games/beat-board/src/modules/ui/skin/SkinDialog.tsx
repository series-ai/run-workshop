import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { SkinButton } from './SkinButton'
import { SkinPanel } from './SkinPanel'

type SkinDialogVariant = 'modal' | 'confirmation' | 'reward'

const PANEL_VARIANT_BY_DIALOG: Record<SkinDialogVariant, 'modal' | 'dialog-confirmation' | 'dialog-reward'> = {
  modal: 'modal',
  confirmation: 'dialog-confirmation',
  reward: 'dialog-reward',
}

export interface SkinDialogProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  open?: boolean
  variant?: SkinDialogVariant
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  showBackdrop?: boolean
  onBackdropClick?: () => void
  width?: CSSProperties['width']
  contained?: boolean
}

export function SkinDialog({
  open = true,
  variant = 'modal',
  title,
  subtitle,
  actions,
  children,
  showBackdrop = true,
  onBackdropClick,
  width,
  contained = false,
  style,
  ...rest
}: SkinDialogProps) {
  if (!open) {
    return null
  }

  const resolvedWidth =
    width ?? (variant === 'reward' ? 'min(560px, calc(100vw - 32px))' : 'min(520px, calc(100vw - 32px))')

  return (
    <div
      className="ui-dialog-shell"
      data-contained={contained ? 'true' : 'false'}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdropClick?.()
        }
      }}
      style={{
        position: contained ? 'relative' : 'fixed',
        inset: contained ? 'auto' : 0,
        zIndex: contained ? 'auto' : 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: contained ? '0' : '20px',
        paddingBottom: contained ? '0' : 'max(20px, env(safe-area-inset-bottom))',
        background: contained || !showBackdrop ? 'transparent' : 'rgba(6, 12, 24, 0.6)',
      }}
    >
      <SkinPanel
        {...rest}
        role="dialog"
        aria-modal="true"
        subtitle={subtitle}
        title={title}
        variant={PANEL_VARIANT_BY_DIALOG[variant]}
        style={{
          width: resolvedWidth,
          maxWidth: '100%',
          // Cap the panel to the viewport; body scroll is handled by
          // `.ui-panel[data-variant='modal'|'sheet'|'dialog-*']` in theme/base.css
          // so the header + close button remain pinned while content scrolls.
          ...(contained ? {} : { maxHeight: 'calc(100dvh - 40px)' }),
          boxShadow: '0 24px 80px rgba(8, 15, 30, 0.32)',
          ...style,
        }}
      >
        <div className="ui-dialog__body">
          {children}
          {actions ? <div className="ui-dialog__actions">{actions}</div> : null}
        </div>
      </SkinPanel>
    </div>
  )
}

export interface SkinConfirmationDialogProps
  extends Omit<SkinDialogProps, 'actions' | 'children' | 'title' | 'variant'> {
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  description?: ReactNode
  onConfirm?: () => void
  onCancel?: () => void
  title?: ReactNode
}

export function SkinConfirmationDialog({
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  description,
  onConfirm,
  onCancel,
  title = 'Confirmation',
  ...rest
}: SkinConfirmationDialogProps) {
  return (
    <SkinDialog
      {...rest}
      title={title}
      variant="confirmation"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SkinButton onClick={onCancel} variant="ghost">
            {cancelLabel}
          </SkinButton>
          <SkinButton onClick={onConfirm} variant="primary">
            {confirmLabel}
          </SkinButton>
        </div>
      }
    >
      {description ? (
        <div style={{ color: 'var(--ui-text-muted, rgba(255, 255, 255, 0.72))', lineHeight: 1.5 }}>
          {description}
        </div>
      ) : null}
    </SkinDialog>
  )
}

export interface SkinRewardAnnouncementProps
  extends Omit<SkinDialogProps, 'actions' | 'children' | 'title' | 'variant'> {
  title?: ReactNode
  description?: ReactNode
  items?: ReactNode
  actionLabel?: ReactNode
  onClaim?: () => void
}

export function SkinRewardAnnouncement({
  title = 'Rewards Ready',
  description,
  items,
  actionLabel = 'Claim',
  onClaim,
  ...rest
}: SkinRewardAnnouncementProps) {
  return (
    <SkinDialog
      {...rest}
      title={title}
      variant="reward"
      actions={
        <SkinButton onClick={onClaim} variant="primary">
          {actionLabel}
        </SkinButton>
      }
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {description ? (
          <div style={{ color: 'var(--ui-text-muted, rgba(255, 255, 255, 0.72))', lineHeight: 1.5 }}>
            {description}
          </div>
        ) : null}
        {items}
      </div>
    </SkinDialog>
  )
}
