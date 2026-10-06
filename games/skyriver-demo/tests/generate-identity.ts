/**
 * @file generate-identity.ts — regenerates src/sim/module-manifest.ts.
 *
 *   npx vite-node tests/generate-identity.ts
 *
 * Run this after any change to a sim source listed in SKYRIVER_SIM_MODULE_PATHS. The identity is
 * source-bound, so editing the sim must change the identity; tests/determinism.test.ts fails until
 * this file has been re-run, which is what stops a build from silently claiming compatibility with a
 * peer that simulates differently.
 *
 * This is a build tool, not a test: the filename is outside vitest's include glob
 * (**\/*.{test,spec}.?(c|m)[jt]s?(x)), so `npm test` never collects it.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   core/index.d.ts:165-168   — kinetixRuntimeModuleManifest(sourceRoot, relativePaths) (node-only).
 *   core/index.d.ts:223-225   — deriveCustomRuntimeIdentity(options) (node-only: uses node:crypto).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { deriveCustomRuntimeIdentity, kinetixRuntimeModuleManifest } from '@series-inc/rundot-syncplay/core';

import {
  SKYRIVER_SIM_MODULE_PATHS,
  SKYRIVER_SIM_SOURCE_ROOT,
  skyriverIdentityOptions,
} from '../src/sim/identity';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const simRoot = resolve(projectRoot, SKYRIVER_SIM_SOURCE_ROOT);

const manifest = kinetixRuntimeModuleManifest(simRoot, [...SKYRIVER_SIM_MODULE_PATHS]);
const identity = deriveCustomRuntimeIdentity(skyriverIdentityOptions(manifest));

const source = `/**
 * @file module-manifest.ts — GENERATED. Do not edit by hand.
 *
 * Regenerate with:
 *   npx vite-node tests/generate-identity.ts
 *
 * Holds the build-time identity artifact for the Skyriver sim: the sha256 digests of the sim sources
 * and the KinetixRuntimeIdentity derived from them. Both are produced by node-only helpers
 * (kinetixRuntimeModuleManifest reads files; deriveCustomRuntimeIdentity uses node:crypto), so they
 * are committed as plain data and read from here at runtime, which keeps the browser bundle free of
 * node builtins. See the long comment in ./identity.ts for the full reasoning.
 *
 * tests/determinism.test.ts re-derives both on every run and fails if this file has drifted, so the
 * identity stays genuinely bound to the sim sources.
 */
import type { KinetixRuntimeIdentity } from '@series-inc/rundot-syncplay/core/runtime';

export interface SkyriverModuleDigest {
  readonly path: string;
  readonly digest: string;
}

export const SKYRIVER_SIM_MODULE_MANIFEST: readonly SkyriverModuleDigest[] = Object.freeze([
${manifest.map((entry) => `  Object.freeze({ path: '${entry.path}', digest: '${entry.digest}' }),`).join('\n')}
]);

export const SKYRIVER_RUNTIME_IDENTITY: KinetixRuntimeIdentity = Object.freeze({
  abiVersion: ${identity.abiVersion},
  tickRate: ${identity.tickRate},
  inputSchemaId: '${identity.inputSchemaId}',
  stateSchemaId: '${identity.stateSchemaId}',
  deterministicVersion: '${identity.deterministicVersion}',
  engineIdentityHash: '${identity.engineIdentityHash}',
});
`;

const target = resolve(simRoot, 'module-manifest.ts');
writeFileSync(target, source, 'utf8');
process.stdout.write(`wrote ${target}\n  engineIdentityHash ${identity.engineIdentityHash}\n`);
