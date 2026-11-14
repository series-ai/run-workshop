#!/usr/bin/env node
/**
 * Stage the run-inkline asset pack into public/run-inkline for local dev.
 *
 * At runtime the game resolves models local-first (see src/useAssetUrl.ts):
 * it HEADs /run-inkline/<pack>/<file> before it falls back to the hosted
 * asset-library CDN. Without the real pack staged here, a plain Vite run
 * has no models.
 *
 * Pack location, in order (same convention as games/inkline-showcase):
 *   1. INKLINE_PACK_DIR environment variable
 *   2. <primary clone>/../jam-ready-assets/run-inkline, found through the
 *      git common dir so worktrees of run-workshop also resolve it
 *   3. <repo>/../jam-ready-assets/run-inkline (sibling checkout)
 *
 * A candidate counts only if it contains 3D/characters/Source/manifest.json.
 *
 * If no pack is found this script exits 1 with install instructions. Set
 * INKLINE_FORCE_OFFLINE=1 to stage empty stub manifests instead; that build
 * compiles and its tests pass, but it renders no models locally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const dest = path.join(projectRoot, 'public', 'run-inkline');
const MANIFEST_REL = path.join('3D', 'characters', 'Source', 'manifest.json');

function packCandidates() {
  const candidates = [];
  if (process.env.INKLINE_PACK_DIR) candidates.push(process.env.INKLINE_PACK_DIR);
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();
    candidates.push(path.resolve(projectRoot, commonDir, '..', '..', 'jam-ready-assets', 'run-inkline'));
  } catch {
    // Not a git checkout; the sibling candidate below still applies.
  }
  candidates.push(path.resolve(repoRoot, '..', 'jam-ready-assets', 'run-inkline'));
  return [...new Set(candidates)];
}

function removeDest() {
  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) fs.unlinkSync(dest);
    else fs.rmSync(dest, { recursive: true, force: true });
  } catch {
    // Does not exist.
  }
}

function stageStubs() {
  removeDest();
  const manifestDir = path.join(dest, '3D', 'characters', 'Source');
  const effectsDir = path.join(dest, '2D', 'misc');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(effectsDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify({ characters: [], animations: [], weapons: [] }, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(effectsDir, 'effects.json'),
    JSON.stringify({ version: '1.0.0', effects: [] }, null, 2),
    'utf-8',
  );
  console.warn(
    '[stage-inkline-assets] INKLINE_FORCE_OFFLINE=1: staged EMPTY stub assets at public/run-inkline. This build renders no models locally.',
  );
}

const candidates = packCandidates();
const packDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, MANIFEST_REL)));

if (packDir) {
  let needsLink = true;
  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink() && fs.readlinkSync(dest) === packDir) needsLink = false;
  } catch {
    // Does not exist; link below.
  }
  if (needsLink) {
    removeDest();
    fs.symlinkSync(packDir, dest, 'dir');
    console.log(`[stage-inkline-assets] Symlinked public/run-inkline -> ${packDir}`);
  } else {
    console.log('[stage-inkline-assets] Symlink already up to date.');
  }
} else if (process.env.INKLINE_FORCE_OFFLINE === '1') {
  stageStubs();
} else {
  console.error(
    [
      '[stage-inkline-assets] INKLINE pack not found. Local model loading reads',
      'public/run-inkline first (src/useAssetUrl.ts); without the pack a local',
      'run renders no models, so this build stops instead of staging stubs.',
      '',
      'Install the pack next to the run-workshop checkout, on its main branch:',
      '',
      '  git clone https://github.com/series-ai/jam-ready-assets.git',
      '',
      'or point INKLINE_PACK_DIR at an existing run-inkline directory, or set',
      'INKLINE_FORCE_OFFLINE=1 for a stub build with no local models (CI).',
      '',
      'Searched:',
      ...candidates.map((candidate) => `  ${candidate}`),
    ].join('\n'),
  );
  process.exit(1);
}
