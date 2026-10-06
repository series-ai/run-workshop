/**
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
  Object.freeze({ path: 'derive.ts', digest: 'd851f1a95f766bc88df9484a4148498f23b9dff1197988f3b0f273f3bda72ded' }),
  Object.freeze({ path: 'identity.ts', digest: 'a8b88d907eeaaf6b9f545166f23180a810e90db0c8dad0b22df5e5716d79407d' }),
  Object.freeze({ path: 'input.ts', digest: '3aa99191b15c0e7ef9c9be176e1947b434add2c44b351f412be1b926ea3f0d17' }),
  Object.freeze({ path: 'runtime.ts', digest: 'dd7ba63859ab81016ca5894db6ff73cea9cad76db1f491f53d665a57bbe10f0a' }),
  Object.freeze({ path: 'systems.ts', digest: '9939001678327ad9963d9376d2893d3275b3c78d5a9615cda88a7f044b98868d' }),
]);

export const SKYRIVER_RUNTIME_IDENTITY: KinetixRuntimeIdentity = Object.freeze({
  abiVersion: 1,
  tickRate: 30,
  inputSchemaId: 'c85bba6866218cf441ed2fbfeaf7baed178fb1adcbb748a54d3beefb46528c8e',
  stateSchemaId: '1bcfdb69de5d385e0f5d9acfed7139c67319d9a7daa4e186820a5ae50feb1e72',
  deterministicVersion: 'syncplay-6.0.0-rc.33-skyriver-1',
  engineIdentityHash: 'a48b5788935f8adde30394988be8dc89db90e0ed60f3de0977eacce157738e21',
});
