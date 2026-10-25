// Local test server. adb reverse can expose this loopback port to a connected phone.
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let sdkRoot = fileURLToPath(new URL('../node_modules/@series-inc/rundot-syncplay/', import.meta.url));
let port = 4680;
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index], value = process.argv[index + 1];
  if (!value) throw new Error(`${flag} needs a value.`);
  if (flag === '--sdk') sdkRoot = resolve(value);
  else if (flag === '--port') port = Number(value);
  else throw new Error(`Unknown option: ${flag}`);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port.');
sdkRoot = await realpath(sdkRoot);
const scriptsRoot = fileURLToPath(new URL('./', import.meta.url));
const scriptFiles = new Set(['physics-rate-fixture.mjs', 'physics-rate-browser.mjs']);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wreck Yard physics test</title><style>body{font:16px system-ui;margin:24px;background:#111820;color:#e8eef3}button,select{font:inherit;padding:10px;margin:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#8ed9ff}</style>
<h1>Wreck Yard physics test</h1><p>This test measures native physics and output reads. It does not measure game frame rate.</p>
<label>Setting <select id="arm"></select></label><label>Iterations <input id="iterations" type="number" min="1" max="32" value="6"></label><button id="run">Run test</button><button id="download" disabled>Save report</button>
<pre id="progress">Ready.</pre><pre id="result"></pre>
<script type="importmap">{"imports":{"@series-inc/rundot-syncplay/core/runtime":"/sdk/core/src/runtime.mjs"}}</script>
<script type="module" src="/scripts/physics-rate-browser.mjs"></script></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html); return; }
    let path;
    if (pathname.startsWith('/sdk/')) {
      path = await realpath(resolve(sdkRoot, pathname.slice('/sdk/'.length)));
      if (!path.startsWith(sdkRoot + sep) || !types[extname(path)]) { response.writeHead(404).end(); return; }
    } else if (pathname.startsWith('/scripts/') && scriptFiles.has(pathname.slice('/scripts/'.length))) {
      path = resolve(scriptsRoot, pathname.slice('/scripts/'.length));
    } else { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[extname(path)] }).end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, sdkRoot })));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
