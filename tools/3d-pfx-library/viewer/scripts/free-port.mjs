// Frees the pinned dev/preview ports before vite starts (predev/prepreview
// hook). A stale vite from a previous session otherwise fails strictPort
// startup with EADDRINUSE. macOS/Linux only; no-op when nothing listens.
import { execSync } from 'node:child_process'

const ports = process.argv
  .slice(2)
  .map(Number)
  .filter((port) => Number.isInteger(port) && port > 0)

for (const port of ports) {
  let pids = []
  try {
    pids = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch {
    // lsof exits non-zero when nothing listens — the port is already free.
    continue
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
      console.log(`free-port: stopped stale process ${pid} listening on :${port}`)
    } catch {
      // Process exited between lsof and kill — nothing to do.
    }
  }
  if (pids.length > 0) {
    // Give the OS a moment to release the socket before vite binds.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
}
