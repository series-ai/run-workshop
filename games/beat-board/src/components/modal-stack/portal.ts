/**
 * Self-mounting portal for the modal-stack component.
 *
 * On the first call to `useModalStore.push(...)`, the store invokes
 * `ensureModalStackHostMounted()` which appends `<div data-ui-modal-stack-host>`
 * to `document.body` and mounts the ModalStackRoot React tree inside it.
 *
 * Idempotent, SSR-safe, HMR-safe.
 */

export const MODAL_STACK_HOST_ATTR = 'data-ui-modal-stack-host'

let mounted = false

export function ensureModalStackHostMounted(): void {
  if (mounted) return
  if (typeof document === 'undefined') return
  if (document.querySelector(`[${MODAL_STACK_HOST_ATTR}]`)) {
    mounted = true
    return
  }

  const host = document.createElement('div')
  host.setAttribute(MODAL_STACK_HOST_ATTR, '')
  document.body.appendChild(host)

  void (async () => {
    try {
      const { ModalStackRoot } = await import('./ModalStackRoot')
      const { createRoot } = await import('react-dom/client')
      const { createElement } = await import('react')
      // Guard against a late-arriving DOM teardown (vitest env tearing down
      // after a test already triggered the mount). If document is gone or the
      // host has been detached, skip the render — nothing is looking.
      if (typeof document === 'undefined' || !host.isConnected) return
      createRoot(host).render(createElement(ModalStackRoot))
    } catch {
      // Non-DOM environments (node, SSR, jest without jsdom) cannot mount.
      // The store still mutates state correctly; only the render side-effect
      // is skipped.
    }
  })()

  mounted = true
}

/** Test-only: reset the mounted flag so subsequent mounts re-portal. */
export function resetModalStackHostMountedForTest(): void {
  mounted = false
}
