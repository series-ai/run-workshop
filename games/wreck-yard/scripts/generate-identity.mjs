import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveCustomRuntimeIdentity, kinetixRuntimeModuleManifest } from '@series-inc/rundot-syncplay/core';

const appRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(appRoot, '../..');
const outputPath = resolve(appRoot, 'src/sim/identity.generated.json');
const pkg = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'));
const syncplayVersion = pkg.dependencies['@series-inc/rundot-syncplay'];
if (!syncplayVersion) throw new Error('WRECK_YARD_IDENTITY_VERSION_MISSING: pin @series-inc/rundot-syncplay');

function sources(dirRelativeToRepo) {
  return readdirSync(resolve(repoRoot, dirRelativeToRepo))
    .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
    .sort()
    .map((name) => `${dirRelativeToRepo}/${name}`);
}

// voxelAcceleration.ts feeds the renderer only; it is not simulation-reachable.
const modules = [
  ...sources('games/wreck-yard/src/sim'),
  ...sources('tools/voxel-kit/src').filter((path) => !path.endsWith('/voxelAcceleration.ts')),
];

const runtimeIdentity = deriveCustomRuntimeIdentity({
  tickRate: 30,
  inputSchema: { id: 'wreck-yard.input.v1' },
  stateSchema: { id: 'wreck-yard.state.v1' },
  runtimeModules: kinetixRuntimeModuleManifest(repoRoot, modules),
  deterministicVersion: `wreck-yard@1+syncplay@${syncplayVersion}`,
  sessionConfigSchema: {
    id: 'wreck-yard.session.v1',
    version: 1,
    maxBytes: 64,
    fields: { playerCount: { type: 'integer', min: 1, max: 4 } },
  },
});

const output = `${JSON.stringify({ format: 'wreck-yard.identity.v1', runtimeIdentity }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(outputPath, 'utf8'); } catch { current = ''; }
  if (current !== output) {
    console.error('WRECK_YARD_IDENTITY_DRIFT: run npm run identity:generate');
    process.exit(1);
  }
} else {
  writeFileSync(outputPath, output);
  console.log(`wrote ${outputPath}`);
}
