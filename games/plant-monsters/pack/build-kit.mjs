// Bundle the Terra Tots kit (src/pack/terratots.ts) into one ES module for games: pack/dist/terratots.js.
// three.js stays an import ('three' and 'three/examples/jsm/...'), so the game's own copy is used.
//   node pack/build-kit.mjs
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await build({
  root,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: path.join(root, 'pack/dist'),
    emptyOutDir: true,
    minify: false,
    lib: { entry: path.join(root, 'src/pack/terratots.ts'), formats: ['es'], fileName: () => 'terratots.js' },
    rollupOptions: { external: (id) => id === 'three' || id.startsWith('three/') },
  },
});
console.log('wrote pack/dist/terratots.js');
