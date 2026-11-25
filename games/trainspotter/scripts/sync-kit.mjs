// Copy the kit catalogue (kit.json) from the tool's build into src/kit.json. Run it whenever the
// pack is republished, so the catalogue matches the models the pins load.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const from = process.argv[2] ?? resolve(root, '../../tools/run-trainspotter/out/glb/kit.json');
if (!existsSync(from)) throw new Error(`no kit.json at ${from}: build the kit first (tools/run-trainspotter, kit/build.py)`);
copyFileSync(from, resolve(root, 'src/kit.json'));
console.log('src/kit.json <-', from);
