/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Generated via `npm --prefix ../../tools/micro-rts run sync-pins -- --target ~/dev/jam-ready-assets`
 * (manifest commit: f74f37c748f2b7ddb74c91642259dc3b59c3a140).
 */
export const LEAF_2D = 'run-micro-rts/2D/space-scifi' as const
export const LEAF_UI = 'run-micro-rts/ui' as const

export const REQUIRED_LEAVES = [LEAF_2D, LEAF_UI] as const

export const PINS: Readonly<Record<string, string>> = {
  'run-micro-rts/2D/space-scifi': '769ee856ee10',
  'run-micro-rts/ui': '9a46097abccc',
}
