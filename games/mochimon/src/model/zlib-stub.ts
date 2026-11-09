// The cat editor runs the sprite code in the browser, where PNG writing (node:zlib) isn't
// needed; vite.config.ts points node:zlib here so bitmap.ts still loads.
export function deflateSync(): never {
  throw new Error('PNG export is node-only')
}
