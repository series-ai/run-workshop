import type { ReactNode } from 'react'
import { useModalStore } from './ModalStack'

/**
 * Generic ModalStackRoot — the default renderer for `useModalStore.stack`.
 *
 * Renders the topmost modal whose `render()` function returns a ReactNode.
 * Legacy modals that only carry a string `component` id are skipped — their
 * consumer-owned root takes responsibility for mapping the id to a component.
 */
export function ModalStackRoot(): ReactNode {
  const stack = useModalStore((s) => s.stack)
  const pop = useModalStore((s) => s.pop)
  if (stack.length === 0) return null

  const top = stack[stack.length - 1]
  if (!top || !top.render) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ui-modal-stack"
      data-modal-id={top.id}
    >
      <div
        className="ui-modal-stack__scrim"
        data-testid="ui-modal-stack-scrim"
        onClick={pop}
      />
      <div className="ui-modal-stack__panel" data-skin-role="modal.panel">
        {top.render()}
      </div>
    </div>
  )
}
