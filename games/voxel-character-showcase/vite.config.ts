import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join, posix, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'
import { PINS } from './src/pins'

const ROOT = import.meta.dirname
const CONTRACTS = resolve(ROOT, '../../tools/run-voxel-characters/contracts')
const MIME: Record<string, string> = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

function localJamAssets(): Plugin {
  const roots = [
    process.env.VITE_VOXCHAR_STAGE_DIR ?? resolve(ROOT, '../../tools/run-voxel-characters/out/jam-stage'),
    process.env.VITE_JAM_ASSETS_DIR ?? join(homedir(), 'dev/jam-ready-assets'),
  ]
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
    const match = /^\/jam\/(.+)$/.exec(url)
    if (!match?.[1]) return next()
    const rel = posix.normalize(match[1])
    const contentType = rel.endsWith('/level-kit/demo.voxels.json') ? 'application/json' : MIME[posix.extname(rel)]
    if (!/^run-cubix-[a-z0-9-]+\//.test(rel) || !contentType || rel.includes('\\') || rel.split('/').some((s) => s.startsWith('.'))) {
      res.statusCode = 404
      return res.end('not a run-cubix asset path')
    }
    for (const root of roots) {
      const file = join(root, rel)
      if (!existsSync(file)) continue
      const real = realpathSync(file)
      if (!real.startsWith(realpathSync(root) + sep)) continue
      if (statSync(real).isFile()) {
        res.setHeader('Content-Type', contentType)
        createReadStream(real).pipe(res)
        return
      }
    }
    res.statusCode = 404
    res.end(`not found in local jam roots: ${rel}`)
  }
  return {
    name: 'cubix-local-jam-assets',
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  }
}

/** Production builds must resolve every pack leaf through a published pin in src/pins.ts. */
function requirePins(): Plugin {
  return {
    name: 'cubix-require-pins',
    buildStart() {
      const packsJson = JSON.parse(readFileSync(join(CONTRACTS, 'data/packs.json'), 'utf8')) as {
        packs: Record<string, { dir: string; worldTheme?: string; hasWorldLeaf: boolean }>
      }
      const leaves: string[] = []
      for (const def of Object.values(packsJson.packs)) {
        leaves.push(`${def.dir}/3D/characters`)
        if (def.hasWorldLeaf && def.worldTheme) {
          leaves.push(`${def.dir}/3D/${def.worldTheme}`)
        }
      }
      const missing = leaves.filter((id) => !PINS[id])
      if (missing.length > 0) {
        throw new Error(
          `production build needs published pins in src/pins.ts for: ${missing.join(', ')}. Use \`npm run build:local\` until they are published in jam-ready-assets.`,
        )
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rundotGameLibrariesPlugin(), ...(mode === 'production' ? [requirePins()] : [localJamAssets()])],
  base: './',
  define: { __POLY_ASSET_MODE__: JSON.stringify(mode === 'production' ? 'pinned' : 'local') },
  resolve: {
    alias: { '@voxchar/contracts': CONTRACTS },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', 'zod'],
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' }, exclude: ['@series-inc/rundot-game-sdk'] },
  server: { port: 5195, strictPort: true, fs: { allow: [ROOT, CONTRACTS] } },
  preview: { port: 4195, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
}))
