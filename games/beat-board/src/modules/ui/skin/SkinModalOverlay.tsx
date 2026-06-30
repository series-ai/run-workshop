import { useEffect, type HTMLAttributes, type ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinModalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClose' | 'children'> {
  /**
   * Whether the overlay is mounted. When false, returns null. Callers that
   * control mount/unmount externally (e.g. a modal queue) can pass true
   * unconditionally and skip the internal guard.
   */
  open?: boolean
  /**
   * Fires when the user dismisses the overlay by clicking the backdrop or
   * pressing Escape (when `dismissible` is not false).
   */
  onClose?: () => void
  /**
   * When false, backdrop clicks and Escape are ignored. Default: true.
   */
  dismissible?: boolean
  /**
   * Width preset for the overlay inner stack. Consumers may still pass
   * `className` to further customise. Presets map to `--ui-modal-overlay-width`.
   */
  width?: 'compact' | 'default' | 'wide' | 'full'
  children?: ReactNode
}

/**
 * Canonical modal overlay surface. Owns the fixed-positioning, backdrop,
 * centering, z-index, Escape-to-dismiss, and click-outside dismiss concerns
 * that every product previously re-implemented. Feature code composes a
 * `<Panel.Modal>` (or `ModalFormShell` / `ConfirmDialogShell`) as children.
 *
 * The overlay intentionally does NOT paint chrome — background, border,
 * radius, padding all live on the child `<Panel.Modal>`. Wrapping the child
 * in another `<div>` with `background` or `border` CSS produces double chrome
 * and is flagged by `check-semantic-screen-lint --rule redundant-modal-shell`.
 */
export function SkinModalOverlay({
  open = true,
  onClose,
  dismissible = true,
  width = 'default',
  className,
  children,
  ...rest
}: SkinModalOverlayProps) {
  useEffect(() => {
    if (!open || !dismissible || !onClose) return undefined
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, dismissible, onClose])

  if (!open) return null

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dismissible) return
    // Only dismiss when the click lands directly on the backdrop (not bubbled
    // up from a child). This mirrors native <dialog> semantics.
    if (event.target === event.currentTarget && onClose) onClose()
  }

  return (
    <div
      {...rest}
      className={joinClassName('ui-modal-overlay', className)}
      data-ui-skin-role="modal.overlay"
      data-width={width}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div className="ui-modal-overlay__inner" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}
