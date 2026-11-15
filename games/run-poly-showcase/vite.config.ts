import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

const ROOT = import.meta.dirname
const CONTRACTS = resolve(ROOT, '../../tools/run-poly-packs/contracts')
const MIME: Record<string, string> = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

function localJamAssets(): Plugin {
  const roots = [
    process.env.VITE_POLY_STAGE_DIR ?? resolve(ROOT, '../../tools/run-poly-packs/out/jam-stage'),
    process.env.VITE_JAM_ASSETS_DIR ?? join(homedir(), 'dev/jam-ready-assets'),
  ]
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
    const match = /^\/jam\/(.+)$/.exec(url)
    if (!match?.[1]) return next()
    const rel = normalize(match[1])
    if (rel.startsWith('..') || !/^run-poly-[a-z0-9-]+\//.test(rel) || !MIME[extname(rel)] || rel.split(sep).some((s) => s.startsWith('.'))) {
      res.statusCode = 404
      return res.end('not a run-poly asset path')
    }
    for (const root of roots) {
      const file = join(root, rel)
      if (!existsSync(file)) continue
      const real = realpathSync(file)
      if (!real.startsWith(realpathSync(root) + sep)) continue
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
    name: 'poly-local-jam-assets',
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rundotGameLibrariesPlugin(), ...(mode === 'production' ? [] : [localJamAssets()])],
  base: './',
  define: { __POLY_ASSET_MODE__: JSON.stringify(mode === 'production' ? 'pinned' : 'local') },
  resolve: {
    alias: { '@poly/contracts': CONTRACTS },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', 'zod'],
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' }, exclude: ['@series-inc/rundot-game-sdk'] },
  server: { port: 5194, strictPort: true, fs: { allow: [ROOT, CONTRACTS] } },
  preview: { port: 4194, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
}))
