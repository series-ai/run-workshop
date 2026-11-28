/**
 * Syncs published run-micro-rts leaf hashes from `<target>/manifest/v2/index.json`
 * into `games/micro-rts-showcase/src/pins.ts`.
 *
 * Usage:
 *   cd tools/micro-rts && npm run sync-pins -- --target ~/dev/jam-ready-assets
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PINS_FILE = resolve(HERE, '../../../games/micro-rts-showcase/src/pins.ts');

const LEAVES = ['run-micro-rts/2D/space-scifi', 'run-micro-rts/ui'] as const;

const t = process.argv.indexOf('--target');
const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '');
const indexPath = join(target, 'manifest/v2/index.json');
if (!target || !existsSync(indexPath)) {
  throw new Error('--target must point to a jam-ready-assets checkout with manifest/v2/index.json built');
}

const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
  commit: string;
  packs: Array<{ id: string; version: string }>;
};
const versions = new Map(index.packs.map((p) => [p.id, p.version]));
const missing = LEAVES.filter((id) => !versions.has(id));
if (missing.length > 0) {
  throw new Error(`Missing leaves in ${indexPath}: ${missing.join(', ')}`);
}

const entries = LEAVES.map((id) => `  '${id}': '${versions.get(id)}',`).join('\n');
const source = `/**
 * Published jam-ready-assets pack versions per leaf ID.
 * Generated via \`npm --prefix ../../tools/micro-rts run sync-pins -- --target ~/dev/jam-ready-assets\`
 * (manifest commit: ${index.commit}).
 */
export const LEAF_2D = 'run-micro-rts/2D/space-scifi' as const
export const LEAF_UI = 'run-micro-rts/ui' as const

export const REQUIRED_LEAVES = [LEAF_2D, LEAF_UI] as const

export const PINS: Readonly<Record<string, string>> = {
${entries}
}
`;

writeFileSync(PINS_FILE, source, 'utf8');
console.log(`Synced ${LEAVES.length} pins -> ${PINS_FILE} (commit ${index.commit.slice(0, 9)})`);
