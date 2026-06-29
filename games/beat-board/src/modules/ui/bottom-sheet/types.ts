import type { ReactNode } from 'react'

export type SnapPoint = 'closed' | 'half' | 'full'

/**
 * Content carried by the bottom-sheet store.
 *
 * - `string` — legacy discriminator: consumers own their own root component
 *   that branches on this id. Kept for backward compatibility with projects
 *   that pre-date the self-mounting portal (e.g. chessgram's
 *   src/components/BottomSheetRoot.tsx). The portal in BottomSheet.tsx
 *   renders nothing for string content — the custom root takes precedence.
 * - `ReactNode` — new deterministic path: the portal in BottomSheet.tsx
 *   renders the node directly. No custom root required.
 * - `null` — sheet is closed.
 */
export type BottomSheetContent = ReactNode | string | null

export interface BottomSheetStore {
  isOpen: boolean
  snapPoint: SnapPoint
  content: BottomSheetContent
  open(content: BottomSheetContent, initialSnap?: SnapPoint): void
  close(): void
  setSnap(point: SnapPoint): void
}
