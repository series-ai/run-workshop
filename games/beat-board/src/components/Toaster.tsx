/**
 * Toaster — canonical template toast mount. DO NOT REPLACE.
 *
 * Mounted once from `App.tsx`. Feature code should only call
 * `useToastStore.getState().show({ message, severity, durationMs })`; this
 * component owns the single rendered toast surface for the app.
 *
 * See `src/modules/ui/toast-notifications/ToastNotifications.ts` for the store
 * API and `src/modules/ui/toast-renderer/ToastRenderer.tsx` for the renderer.
 * Never render a second `<Toast.Stack>` or `<ToastRenderer />` elsewhere in the
 * app, and never hold a parallel `toasts: [...]` slice on a game-local store
 * — the AST lint at `scripts/quality/toasts/check-toast-reimplementation.ts`
 * fails the build if you do.
 */

import { ToastRenderer } from '@modules/ui/toast-renderer/ToastRenderer'

export function Toaster() {
  return <ToastRenderer position="top-center" />
}
