/**
 * Self-mounting portal for the bottom-sheet module.
 *
 * On the first call to `useBottomSheetStore.open(...)`, the store invokes
 * `ensureBottomSheetHostMounted()` which appends `<div data-ui-bottom-sheet-host>`
 * to `document.body` and mounts the BottomSheetRoot React tree inside it.
 *
 * This makes the module self-sufficient: consumers do not need to import or
 * mount `BottomSheetRoot` in App.tsx. The structural-lint `missing-store-root`
 * check recognizes this pattern and no longer flags the module.
 *
 * Idempotent — subsequent calls are no-ops. Safe to call from SSR (returns
 * early when `document` is undefined).
 */

export const BOTTOM_SHEET_HOST_ATTR = 'data-ui-bottom-sheet-host'

let mounted = false

export function ensureBottomSheetHostMounted(): void {
  if (mounted) return
  if (typeof document === 'undefined') return
  if (document.querySelector(`[${BOTTOM_SHEET_HOST_ATTR}]`)) {
    // Another instance already mounted the host (e.g. HMR reload).
    mounted = true
    return
  }

  const host = document.createElement('div')
  host.setAttribute(BOTTOM_SHEET_HOST_ATTR, '')
  document.body.appendChild(host)

  // Dynamic import keeps the portal file dependency-free when the store is
  // consumed from a non-DOM context (e.g. Node tests that never call open()).
  void (async () => {
    try {
      const { BottomSheetRoot } = await import('./BottomSheetRoot')
      const { createRoot } = await import('react-dom/client')
      const { createElement } = await import('react')
      // Guard against late-arriving DOM teardown (test env tearing down after
      // mount was triggered). Skip the render if document or host is gone.
      if (typeof document === 'undefined' || !host.isConnected) return
      createRoot(host).render(createElement(BottomSheetRoot))
    } catch {
      // Non-DOM environments cannot mount. Store mutates state normally; only
      // the render side-effect is skipped.
    }
  })()

  mounted = true
}

/** Test-only: reset the mounted flag so subsequent mounts re-portal. */
export function resetBottomSheetHostMountedForTest(): void {
  mounted = false
}
