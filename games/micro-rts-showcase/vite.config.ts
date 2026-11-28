import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, normalize, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'
import { PINS, REQUIRED_LEAVES } from './src/pins'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
}

function localJamAssets(): Plugin {
  const roots = [process.env.VITE_JAM_ASSETS_DIR ?? join(homedir(), 'dev/jam-ready-assets')]
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
    const match = /^\/jam\/(.+)$/.exec(url)
    if (!match?.[1]) return next()
    const rel = normalize(match[1])
    if (
      rel.startsWith('..') ||
      !/^run-micro-rts\//.test(rel) ||
      !MIME[extname(rel)] ||
      rel.split(sep).some((s) => s.startsWith('.'))
    ) {
      res.statusCode = 404
      return res.end('not a run-micro-rts asset path')
    }
    for (const root of roots) {
      if (!existsSync(root)) continue
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
    name: 'micro-rts-local-jam-assets',
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  }
}

/** Production builds must resolve every leaf through a published jam-ready-assets pin. */
function requirePins(): Plugin {
  return {
    name: 'micro-rts-require-pins',
    buildStart() {
      const missing = REQUIRED_LEAVES.filter((id) => !PINS[id])
      if (missing.length > 0) {
        throw new Error(
          `Production build needs published jam-ready-assets pins for: ${missing.join(', ')}. Use \`npm run build:local\` until they are in src/pins.ts.`,
        )
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rundotGameLibrariesPlugin(), ...(mode === 'production' ? [requirePins()] : [localJamAssets()])],
  base: './',
  define: { __MICRO_RTS_ASSET_MODE__: JSON.stringify(mode === 'production' ? 'pinned' : 'local') },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' }, exclude: ['@series-inc/rundot-game-sdk'] },
  server: { host: true, port: 5198, strictPort: true },
  preview: { port: 4198, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' },
}))
