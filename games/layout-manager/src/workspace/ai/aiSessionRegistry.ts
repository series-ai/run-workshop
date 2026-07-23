/**
 * Registry of resident AI inference sessions (e.g. background-removal models).
 * Lives in its own tiny module so MemoryMonitor can list/evict sessions
 * without pulling onnxruntime into the main bundle.
 */

interface SessionEntry {
  /** Human label, e.g. "ISNet (quality)" */
  label: string;
  /** Rough resident size, e.g. "~500 MB" */
  sizeHint: string;
  release: () => Promise<void>;
}

const entries = new Map<string, SessionEntry>();

export function registerAiSession(id: string, entry: SessionEntry): void {
  entries.set(id, entry);
}

export function unregisterAiSession(id: string): void {
  entries.delete(id);
}

/** Sessions currently held in memory. */
export function residentAiSessions(): { id: string; label: string; sizeHint: string }[] {
  return Array.from(entries.entries()).map(([id, e]) => ({ id, label: e.label, sizeHint: e.sizeHint }));
}

/** Release every resident session. Returns how many were released. */
export async function releaseAiSessions(): Promise<number> {
  const all = Array.from(entries.entries());
  entries.clear();
  let n = 0;
  for (const [, e] of all) {
    try { await e.release(); n++; } catch { /* already gone */ }
  }
  return n;
}
