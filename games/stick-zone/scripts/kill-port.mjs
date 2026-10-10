#!/usr/bin/env node
/**
 * @file kill-port.mjs
 * Automatically checks and terminates any lingering processes holding the target port.
 */
import { execSync } from "node:child_process";

const port = process.argv[2] || process.env.PORT || 58392;

try {
  const stdout = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
  if (stdout) {
    const pids = stdout.split("\n").map((p) => p.trim()).filter(Boolean);
    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, "SIGKILL");
          console.log(`[kill-port] Terminated stale process ${pid} occupying port ${port}.`);
        } catch {
          // Process might have already exited
        }
      }
    }
  }
} catch {
  // lsof returns exit code 1 if no process is listening on the port
}
