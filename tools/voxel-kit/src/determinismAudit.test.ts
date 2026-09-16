import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));

const BANNED = /Math\.(sin|cos|tan|atan2?|exp|pow|log|random|hypot|cbrt)\b|Date\.now|new Date|performance\.now/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const ROOTS = [
  resolve(here),
  resolve(here, '../../../games/wreck-yard/src/sim'),
];

describe('determinism audit', () => {
  it('finds no engine-dependent math in kit or simulation sources', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      let files: string[] = [];
      try { files = sources(root); } catch { continue; }
      for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (BANNED.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
