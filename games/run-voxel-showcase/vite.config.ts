import { createReadStream, existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'
import { PINS } from './src/pins'
import { leafId } from './src/leaves'
import type { LeafKind, PackKey } from '../../tools/run-voxel-packs/contracts/packs'

// Ports are pinned per sub-project: pirate-nation-showcase owns 5190/4190.
const ROOT = import.meta.dirname
const CONTRACTS = resolve(ROOT, '../../tools/run-voxel-packs/contracts')
const PFX = resolve(ROOT, '../../tools/3d-pfx-library')

const MIME: Record<string, string> = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

/**
 * Local asset source: `/jam/<leaf id>/<path>` from the RUN voxel stage dir,
 * then from a jam-ready-assets checkout. Dev and `--mode local-preview` only.
 */
function localJamAssets(): Plugin {
  const roots = [
    process.env.VITE_RVX_STAGE_DIR ?? resolve(ROOT, '../../tools/run-voxel-packs/out/jam-stage'),
    process.env.VITE_JAM_ASSETS_DIR ?? join(homedir(), 'dev/jam-ready-assets'),
  ]
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
    const match = /^\/jam\/(.+)$/.exec(url)
    if (!match?.[1]) return next()
    const rel = normalize(match[1])
    // Only pack leaves and asset files: never repo metadata such as .git.
    if (rel.startsWith('..') || !/^(run-voxel-[a-z-]+|proofofplay-pirate-nation)\//.test(rel) || !MIME[extname(rel)] || rel.split(sep).some((s) => s.startsWith('.'))) {
      res.statusCode = 404
      return res.end('not an asset path')
    }
    for (const root of roots) {
      const file = join(root, rel)
      if (!existsSync(file)) continue
      const real = realpathSync(file)
      if (!real.startsWith(realpathSync(root) + sep)) continue // symlink escaping the root
      if (statSync(real).isFile()) {
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
        createReadStream(real).pipe(res)
        return
      }
    }
    res.statusCode = 404
    res.end(`not found in local jam roots: ${rel}`)
  }
  return {
    name: 'rvx-local-jam-assets',
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  }
}

/** Production builds must resolve every catalogued leaf through a pin. */
function requirePins(): Plugin {
  return {
    name: 'rvx-require-pins',
    buildStart() {
      const catalogDir = join(ROOT, 'public/catalog')
      const leaves = new Set<string>()
      for (const pack of existsSync(catalogDir) ? readdirSync(catalogDir) : []) {
        const file = join(catalogDir, pack, 'catalog.json')
        if (!existsSync(file)) continue
        const catalog = JSON.parse(readFileSync(file, 'utf8')) as { pack: string; models: { leaf: string }[]; sprites: { leaf: string }[] }
        for (const item of [...catalog.models, ...catalog.sprites]) leaves.add(`${catalog.pack}:${item.leaf}`)
      }
      const missing = [...new Set([...leaves].map((key) => {
        const [pack, leaf] = key.split(':') as [PackKey, LeafKind]
        return leafId(pack, leaf)
      }))].filter((id) => !PINS[id])
      if (missing.length > 0) {
        throw new Error(`production build needs published pins for: ${missing.join(', ')}. Use \`npm run build:local\` until they are in src/pins.ts.`)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rundotGameLibrariesPlugin(), ...(mode === 'production' ? [requirePins()] : [localJamAssets()])],
  base: './',
  define: { __RVX_ASSET_MODE__: JSON.stringify(mode === 'production' ? 'pinned' : 'local') },
  resolve: {
    alias: { '@rvx/contracts': CONTRACTS, '@rvx-pfx': resolve(PFX, 'src/PfxById.tsx') },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', 'zod'],
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' }, exclude: ['@series-inc/rundot-game-sdk'] },
  server: { port: 5192, strictPort: true, fs: { allow: [ROOT, CONTRACTS, PFX] } },
  preview: { port: 4192, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
}))
