import type { ReactNode } from 'react'
import { useConfirmDialogStore } from './ConfirmationDialog'
import './ConfirmDialog.css'

export function ConfirmDialogRoot(): ReactNode {
  const isOpen = useConfirmDialogStore((s) => s.isOpen)
  const options = useConfirmDialogStore((s) => s.options)
  const confirm = useConfirmDialogStore((s) => s.confirm)
  const cancel = useConfirmDialogStore((s) => s.cancel)

  if (!isOpen || !options) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ui-confirm-dialog"
      data-testid="ui-confirm-dialog"
    >
      <div
        className="ui-confirm-dialog__scrim"
        data-testid="ui-confirm-dialog-scrim"
        onClick={cancel}
      />
      <div className="ui-confirm-dialog__panel" data-skin-role="dialog.panel">
        <div className="ui-confirm-dialog__title">{options.title}</div>
        <div className="ui-confirm-dialog__message">{options.message}</div>
        <div className="ui-confirm-dialog__actions">
          <button
            type="button"
            className="ui-confirm-dialog__cancel"
            data-testid="ui-confirm-dialog-cancel"
            onClick={cancel}
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            className="ui-confirm-dialog__confirm"
            data-testid="ui-confirm-dialog-confirm"
            data-destructive={options.destructive ? '' : undefined}
            onClick={confirm}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
