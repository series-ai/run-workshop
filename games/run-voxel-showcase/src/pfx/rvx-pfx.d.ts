/**
 * Types for `@rvx-pfx` (tools/3d-pfx-library/src/PfxById.tsx). The library
 * compiles non-strict, so the app type-checks against this declaration and
 * Vite bundles the real module through the alias.
 */
declare module '@rvx-pfx' {
  import type { ReactElement } from 'react'
  /** `playKey`: change it to play a one-shot again. */
  /** `preview`: shown on its own, not on a moving model (ribbons may fake a swing). */
  export function PfxById(props: { effectId: string; playKey?: number | string; preview?: boolean }): ReactElement
  export function isPfxOneShot(effectId: string): boolean
  export function hasPfxEffect(effectId: string): boolean
  export const RVX_EFFECT_IDS: readonly string[]
  export function pfxLabel(effectId: string): string
}
