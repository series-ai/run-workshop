/**
 * Self-mounting portal for the confirmation-dialog module.
 *
 * On the first call to `useConfirmDialogStore.show(...)`, the store invokes
 * `ensureConfirmDialogHostMounted()` which appends a host node to
 * `document.body` and mounts the ConfirmDialogRoot React tree inside it.
 *
 * This makes the module self-sufficient: consumers do not need to import or
 * mount `ConfirmDialogRoot` in App.tsx. The structural-lint `missing-store-root`
 * check recognizes this pattern and no longer flags the module.
 *
 * Idempotent — subsequent calls are no-ops. Safe to call from SSR (returns
 * early when `document` is undefined).
 */

export const CONFIRM_DIALOG_HOST_ATTR = 'data-ui-confirm-dialog-host'

let mounted = false

export function ensureConfirmDialogHostMounted(): void {
  if (mounted) return
  if (typeof document === 'undefined') return
  if (document.querySelector(`[${CONFIRM_DIALOG_HOST_ATTR}]`)) {
    mounted = true
    return
  }

  const host = document.createElement('div')
  host.setAttribute(CONFIRM_DIALOG_HOST_ATTR, '')
  document.body.appendChild(host)

  void (async () => {
    try {
      const { ConfirmDialogRoot } = await import('./ConfirmDialogRoot')
      const { createRoot } = await import('react-dom/client')
      const { createElement } = await import('react')
      if (typeof document === 'undefined' || !host.isConnected) return
      createRoot(host).render(createElement(ConfirmDialogRoot))
    } catch {
      // Non-DOM environments cannot mount. Store mutates state normally; only
      // the render side-effect is skipped.
    }
  })()

  mounted = true
}

export function resetConfirmDialogHostMountedForTest(): void {
  mounted = false
}
