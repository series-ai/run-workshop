#!/usr/bin/env tsx
/**
 * predev hook: kill stale listeners on this project's deterministic dev ports.
 *
 * Why: dev_port and multiplayer_dev_port are deterministic per project, so
 * any process listening on them at predev time is by definition a stale
 * instance of *this* project (a previous `npm run dev` that orphaned). The
 * SDK rooms sidecar throws EADDRINUSE on collision rather than retrying,
 * which turns one zombie process into a hard dev-startup failure.
 *
 * How: lsof + SIGKILL on each resolved port. Best-effort; never blocks dev
 * startup. macOS/Linux only — Windows is a no-op (no lsof).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
  if (process.platform === 'win32') return;

  const cfg = (await import(path.join(PROJECT_ROOT, 'dev-server.config.ts'))) as {
    resolveDevPort?: (dir: string, env: NodeJS.ProcessEnv) => number;
    resolveMultiplayerDevPort?: (dir: string, env: NodeJS.ProcessEnv) => number;
  };

  const ports = new Set<number>();
  if (typeof cfg.resolveDevPort === 'function') {
    ports.add(cfg.resolveDevPort(PROJECT_ROOT, process.env));
  }
  if (typeof cfg.resolveMultiplayerDevPort === 'function') {
    ports.add(cfg.resolveMultiplayerDevPort(PROJECT_ROOT, process.env));
  }

  for (const port of ports) freePort(port);
}

function freePort(port: number): void {
  let pids: number[] = [];
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    pids = out ? out.split('\n').map(Number).filter(Number.isFinite) : [];
  } catch {
    // lsof exits non-zero when nothing matches — treat as "already free".
  }
  if (pids.length === 0) return;

  // Don't suicide if predev itself somehow shows up.
  pids = pids.filter((pid) => pid !== process.pid);
  if (pids.length === 0) return;

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // best-effort: process may have already exited or be owned by another user
    }
  }
  console.log(
    `[predev] freed port ${port} (was held by pid${pids.length > 1 ? 's' : ''} ${pids.join(', ')})`,
  );
}

main().catch((err) => {
  console.warn('[predev] non-fatal:', err instanceof Error ? err.message : String(err));
  process.exit(0);
});
