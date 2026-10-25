import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Clocks and random numbers differ between peers on every engine. */
const NONDETERMINISTIC = /Math\.random\b|Date\.now|new Date|performance\.now/;
/** Transcendentals differ bitwise between engines unless a deterministic shim replaces them. */
const TRANSCENDENTAL = /Math\.(sin|cos|tan|atan2?|exp|pow|log|hypot|cbrt)\b/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const WRECK_YARD = resolve(here, '../../../games/wreck-yard');

/**
 * The kit runs in games that may not install a math shim, so it bans both.
 * Wreck Yard installs the Syncplay deterministic math shim before any sim module
 * loads (checked below), so its simulation may use Math transcendentals.
 */
const ROOTS = [
  { root: resolve(here), banned: [NONDETERMINISTIC, TRANSCENDENTAL] },
  { root: join(WRECK_YARD, 'src/sim'), banned: [NONDETERMINISTIC] },
];

describe('determinism audit', () => {
  it('finds no engine-dependent math in kit or simulation sources', () => {
    const offenders: string[] = [];
    for (const { root, banned } of ROOTS) {
      let files: string[] = [];
      try { files = sources(root); } catch { continue; }
      for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (banned.some((pattern) => pattern.test(line))) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has Wreck Yard install the deterministic math shim before any sim module loads', () => {
    let main: string;
    try { main = readFileSync(join(WRECK_YARD, 'src/main.tsx'), 'utf8'); } catch { return; }
    const firstImport = main.split('\n').find((line) => line.startsWith('import '));
    expect(firstImport).toBe("import './deterministicMath';");
    expect(readFileSync(join(WRECK_YARD, 'src/deterministicMath.ts'), 'utf8')).toMatch(/^installDeterministicMath\(\);$/m);
    expect(readFileSync(join(WRECK_YARD, 'vitest.config.ts'), 'utf8')).toContain("setupFiles: ['src/deterministicMath.ts']");
  });
});
