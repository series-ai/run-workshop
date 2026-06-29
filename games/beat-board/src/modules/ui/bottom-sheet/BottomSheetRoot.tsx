import { isValidElement, type ReactNode } from 'react'
import { useBottomSheetStore } from './BottomSheet'

/**
 * Generic BottomSheetRoot — the default renderer for
 * `useBottomSheetStore.content`.
 *
 * Rules:
 * - Renders nothing when the sheet is closed or `content` is null.
 * - Renders the node directly when `content` is a ReactNode. This is the
 *   deterministic path that auto-mount uses — any consumer that calls
 *   `open(<MyComponent />)` gets visible DOM with no additional wiring.
 * - Renders nothing when `content` is a string. String content is a legacy
 *   discriminator; a consumer-owned root (e.g. projects/chessgram/src/
 *   components/BottomSheetRoot.tsx) is expected to branch on the id and
 *   render the matching component. This root does not guess — rendering the
 *   raw string would produce garbage DOM.
 *
 * If both the generic root (via auto-mount) and a consumer-owned root are
 * mounted, the consumer-owned root wins for string ids because the generic
 * root renders nothing for them. For ReactNode content, both roots render —
 * but consumers that mix string + ReactNode content in the same project are
 * expected to disable one of the two paths.
 */
export function BottomSheetRoot(): ReactNode {
  const isOpen = useBottomSheetStore((s) => s.isOpen)
  const snapPoint = useBottomSheetStore((s) => s.snapPoint)
  const content = useBottomSheetStore((s) => s.content)
  const close = useBottomSheetStore((s) => s.close)

  if (!isOpen || content === null) return null
  // Render only ReactNode content — string discriminators are owned by
  // project-specific roots. `isValidElement` matches JSX only; strings and
  // arrays of children are passed through unchanged. We treat anything that
  // is not a valid element as "not ours".
  if (typeof content === 'string') return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ui-bottom-sheet"
      data-sheet-snap={snapPoint}
    >
      <div
        className="ui-bottom-sheet__scrim"
        data-testid="ui-bottom-sheet-scrim"
        onClick={close}
      />
      <div className="ui-bottom-sheet__panel" data-skin-role="sheet.panel">
        {isValidElement(content) || Array.isArray(content) ? content : null}
      </div>
    </div>
  )
}
