// Local static server for the viewer and the cover/gallery shots.
//
//   node viewer/serve.mjs [port] [--leaf <library leaf dir>]
//
// Serves run-workshop's tools/ folder at / (so the shots can use the cover
// fonts in run-monster-trucks/pack/fonts), and with --leaf a packaged library
// leaf at /leaf/, so the shots test the shipped helper. Binds to 127.0.0.1.
// Open http://127.0.0.1:8840/run-trainspotter/viewer/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.css': 'text/css' };

export function start(port = 8840, leaf = null) {
  const leafDir = leaf ? path.resolve(leaf) : null;
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const [base, rel] = leafDir && url.startsWith('/leaf/') ? [leafDir, url.slice(6)] : [tools, url.slice(1)];
    let file = path.resolve(base, rel);
    if (file !== base && !file.startsWith(base + path.sep)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--leaf');
  const leaf = at >= 0 ? args.splice(at, 2)[1] : null;
  const port = Number(args[0] ?? 8840);
  await start(port, leaf);
  console.log(`http://127.0.0.1:${port}/run-trainspotter/viewer/`);
}
