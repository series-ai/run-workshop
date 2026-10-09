#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const dest = path.join(projectRoot, 'public', 'run-inkline');
const candidates = [
  '/Users/pany/dev/jam-ready-assets-rvx/run-inkline',
  '/Users/pany/dev/jam-ready-assets-inkline/run-inkline',
];
const canonicalSource = candidates.find((p) => fs.existsSync(p)) || candidates[0];

const isOffline = process.env.INKLINE_FORCE_OFFLINE === '1' || !fs.existsSync(canonicalSource);

if (isOffline) {
  // Offline / Clean CI checkout: Remove symlink and stage lightweight stub
  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dest);
    } else {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  } catch (err) {
    // Doesn't exist
  }

  const manifestDir = path.join(dest, '3D', 'characters', 'Source');
  const effectsDir = path.join(dest, '2D', 'misc');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(effectsDir, { recursive: true });

  const manifestFile = path.join(manifestDir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    fs.writeFileSync(
      manifestFile,
      JSON.stringify({ characters: [], animations: [], weapons: [] }, null, 2),
      'utf-8',
    );
  }

  const effectsFile = path.join(effectsDir, 'effects.json');
  if (!fs.existsSync(effectsFile)) {
    fs.writeFileSync(
      effectsFile,
      JSON.stringify({ version: '1.0.0', effects: [] }, null, 2),
      'utf-8',
    );
  }

  console.log('[stage-inkline-assets] Offline mode: Staged stub assets at public/run-inkline');
} else {
  // Canonical development repo available: Stage directory symlink
  let needsLink = true;
  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(dest);
      if (currentTarget === canonicalSource) {
        needsLink = false;
      } else {
        fs.unlinkSync(dest);
      }
    } else {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  } catch (err) {
    // Doesn't exist
  }

  if (needsLink) {
    fs.symlinkSync(canonicalSource, dest, 'dir');
    console.log(`[stage-inkline-assets] Symlinked public/run-inkline -> ${canonicalSource}`);
  } else {
    console.log('[stage-inkline-assets] Symlink already up to date.');
  }
}
