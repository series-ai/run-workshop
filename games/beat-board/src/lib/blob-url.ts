/**
 * blob-url — sanctioned helper for `URL.createObjectURL` / `URL.revokeObjectURL`.
 *
 * Direct `URL.createObjectURL()` is forbidden by the
 * `raw-object-url` structural-lint rule everywhere except the runtime asset
 * client (which only handles CDN-fetched blobs). Game features that need to
 * preview a freshly-produced local blob — for example a recording mp4 from
 * `recordingStore.blob` — must route the call through this helper.
 *
 * The helper centralizes:
 *   - error swallowing (jsdom and other DOM-free contexts return null)
 *   - revoke parity (revoke is a noop when create returned null)
 *   - the structural-lint allowlist entry (this file is the single
 *     non-runtime-asset place in the project where the raw call is
 *     permitted)
 */

/**
 * Create an object URL for a Blob. Returns null if the runtime does not
 * provide `URL.createObjectURL` (jsdom test environments, SSR).
 */
export function createBlobUrl(blob: Blob): string | null {
  try {
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Revoke a previously-created object URL. Safe to call with `null` (noop) or
 * in environments where `URL.revokeObjectURL` is unavailable.
 */
export function revokeBlobUrl(url: string | null): void {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // jsdom or no DOM context — ignore.
  }
}
