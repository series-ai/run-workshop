/**
 * UUID v4 that works in insecure contexts.
 *
 * `crypto.randomUUID` is a secure-context-only API — it simply doesn't exist
 * when Layout Manager is opened over the LAN via plain http (e.g.
 * http://192.168.x.x:5173), which made every image import throw. This uses
 * `crypto.getRandomValues`, which is available on any origin.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
