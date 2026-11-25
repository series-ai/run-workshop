import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { join, posix, resolve, sep } from 'node:path';
import { defineConfig } from 'vite';
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite';
import { PINS, KIT_LEAF, AUDIO_LEAF } from './src/pins.js';

const ROOT = import.meta.dirname;
const TOOL = resolve(ROOT, '../../tools/run-trainspotter');
const MIME = { '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.png': 'image/png', '.jpg': 'image/jpeg' };

/**
 * Local builds: /jam/<leaf>/<file> from a jam-ready-assets checkout (VITE_JAM_ASSETS_DIR, or a
 * sibling of this repo), else from the tool's own build output (out/glb, out/sounds/ogg).
 */
function localJamAssets() {
  const jra = process.env.VITE_JAM_ASSETS_DIR ?? resolve(ROOT, '../../../jam-ready-assets');
  const roots = {
    [KIT_LEAF]: [join(jra, KIT_LEAF), join(TOOL, 'out/glb')],
    [AUDIO_LEAF]: [join(jra, AUDIO_LEAF), join(TOOL, 'out/sounds/ogg')],
  };
  const serve = (req, res, next) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0]);
    const m = /^\/jam\/(.+)$/.exec(url);
    if (!m) return next();
    const rel = posix.normalize(m[1]);
    const leaf = Object.keys(roots).find((l) => rel.startsWith(`${l}/`));
    const type = MIME[posix.extname(rel)];
    if (!leaf || !type || rel.includes('\\') || rel.split('/').some((s) => s.startsWith('.'))) {
      res.statusCode = 404;
      return res.end('not a Trainspotter asset path');
    }
    const file = rel.slice(leaf.length + 1);
    for (const dir of roots[leaf]) {
      const abs = join(dir, file);
      if (!existsSync(abs) || !realpathSync(abs).startsWith(realpathSync(dir) + sep) || !statSync(abs).isFile()) continue;
      res.setHeader('Content-Type', type);
      createReadStream(abs).pipe(res);
      return;
    }
    res.statusCode = 404;
    res.end(`not found locally: ${rel}`);
  };
  return {
    name: 'trainspotter-local-jam-assets',
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  };
}

/** Production builds must load the pack through published pins (src/pins.js). */
function requirePins() {
  return {
    name: 'trainspotter-require-pins',
    buildStart() {
      const missing = [KIT_LEAF, AUDIO_LEAF].filter((leaf) => !PINS[leaf]);
      if (missing.length) {
        throw new Error(`production build needs published pins in src/pins.js for: ${missing.join(', ')}. `
          + 'Use `npm run build:local` until the pack is published in jam-ready-assets.');
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [rundotGameLibrariesPlugin(), ...(mode === 'production' ? [requirePins()] : [localJamAssets()])],
  base: './',
  define: { __TS_ASSET_MODE__: JSON.stringify(mode === 'production' ? 'pinned' : 'local') },
  // the viewer modules live in tools/run-trainspotter/viewer; one copy of three for all of them
  resolve: { dedupe: ['three'] },
  optimizeDeps: { exclude: ['@series-inc/rundot-game-sdk'] },
  server: { port: 5197, strictPort: true, fs: { allow: [ROOT, join(TOOL, 'viewer')] } },
  preview: { port: 4197, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  esbuild: { target: 'es2022' },
}));
