import { build } from 'vite'

const entry = process.argv[2]
if (entry !== 'audit' && entry !== 'capture') throw new Error('Choose audit or capture.')
await build({
  configFile: false,
  base: './',
  build: {
    target: 'es2022',
    outDir: entry === 'audit' ? 'dist-audit' : '.cache/capture-build',
    rollupOptions: { input: `${entry}.html` },
  },
})
