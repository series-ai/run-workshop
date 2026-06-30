import type { ReactNode } from 'react'

/** Priority tiers for modal queue ordering (higher number = shows first) */
export enum ModalPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}

export interface Modal {
  id: string
  /**
   * Legacy discriminator — a string id that a consumer-owned
   * `ModalStackRoot` component maps to a real React component (registry
   * pattern). Kept for backward compatibility.
   */
  component: string
  props?: Record<string, unknown>
  /**
   * New deterministic render path. When set, the module's own
   * `ModalStackRoot` invokes this function to produce the modal body — no
   * consumer-owned root required. If only `component` is set, the module's
   * default root renders nothing and a project root must handle the id.
   */
  render?: () => ReactNode
  /** Priority determines queue ordering. Default: NORMAL */
  priority?: ModalPriority
}

export interface ModalStore {
  /** Currently visible modal stack (rendered top-down) */
  stack: Modal[]
  /** Queued modals waiting for suppression to lift */
  queue: Modal[]
  /** When true, new modals are queued instead of shown */
  suppressed: boolean

  /** Show a modal immediately (or queue it if suppressed) */
  push(modal: Modal): void
  /** Remove the topmost modal */
  pop(): void
  /** Clear all visible modals */
  popAll(): void
  /** Replace the topmost modal */
  replace(modal: Modal): void
  /** Check if a modal is currently visible */
  isOpen(id: string): boolean

  /**
   * Suppress all new modals. Calls to push() while suppressed are queued.
   * Use this when FTUE, loading screens, or other exclusive flows are active.
   */
  suppress(): void
  /**
   * Lift suppression and flush queued modals in priority order.
   * Only the highest-priority modal is shown immediately; the rest stay
   * queued and show as each modal is popped.
   */
  unsuppress(): void
  /** Check if a modal is waiting in the queue */
  isQueued(id: string): boolean
  /** Remove a specific modal from the queue without showing it */
  dequeue(id: string): void
}
