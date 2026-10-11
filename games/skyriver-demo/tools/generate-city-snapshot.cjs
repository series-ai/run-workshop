#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const CANONICAL_SEED = 424242;

const DEPENDENCY_INPUTS = [
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'tools/generate-city-snapshot.cjs',
  'node_modules/@series-inc/rundot-syncplay/package.json',
  'node_modules/@series-inc/rundot-syncplay/dist/index.js',
  'node_modules/@series-inc/rundot-syncplay/dist/math.js',
  'node_modules/@series-inc/rundot-syncplay/dist/noise.js',
  'node_modules/@series-inc/rundot-syncplay/dist/random.js',
];

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function fail(message) {
  throw new Error(`GENERATE_CITY_SNAPSHOT:${message}`);
}

function collectSourcePaths(projectDir) {
  const paths = [];
  const srcDir = path.join(projectDir, 'src');

  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          const rel = path.relative(projectDir, full).split(path.sep).join('/');
          paths.push(rel);
        }
      }
    }
  }

  scan(srcDir);
  return paths;
}

function computeSourceManifest(projectDir) {
  const tsPaths = collectSourcePaths(projectDir);
  const allPaths = [...tsPaths, ...DEPENDENCY_INPUTS].sort();
  const records = [];

  for (const relPath of allPaths) {
    const fullPath = path.join(projectDir, relPath);
    if (!fs.existsSync(fullPath)) {
      fail(`missing-source-input:${relPath}`);
    }
    const content = fs.readFileSync(fullPath);
    records.push({
      path: relPath,
      sha256: sha256(content),
      byteLength: content.byteLength,
    });
  }

  const digest = sha256(JSON.stringify(records));
  return { records, digest };
}

function parseCliArgs(argv) {
  const options = {
    runtime: null,
    out: null,
    check: false,
    project: path.resolve(__dirname, '..'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runtime') {
      options.runtime = argv[i + 1];
      i += 1;
    } else if (arg === '--out') {
      options.out = argv[i + 1];
      i += 1;
    } else if (arg === '--project') {
      options.project = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--check') {
      options.check = true;
    } else {
      fail(`unknown-argument:${arg}`);
    }
  }

  if (!options.runtime || (options.runtime !== 'node' && options.runtime !== 'browser')) {
    fail('required-argument:--runtime node|browser');
  }
  if (!options.out) {
    fail('required-argument:--out PATH');
  }

  options.out = path.resolve(options.out);
  return options;
}

async function deriveInNode(projectDir) {
  const esbuild = require(path.join(projectDir, 'node_modules/esbuild'));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'city-snap-node-'));
  const bundlePath = path.join(tempDir, 'entry.cjs');

  const entryCode = [
    `import { pureCitySnapshot } from './src/render/city';`,
    `import { deriveCityLayout } from './src/sim/derive';`,
    `import { presentCityLayout } from './src/render/presentationLayout';`,
    `import { encodeCityGraph } from './src/render/citySnapshotCodec';`,
    `export { pureCitySnapshot, deriveCityLayout, presentCityLayout, encodeCityGraph };`,
  ].join('\n');

  try {
    await esbuild.build({
      stdin: {
        contents: entryCode,
        resolveDir: projectDir,
        sourcefile: 'entry.ts',
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      outfile: bundlePath,
      logLevel: 'silent',
      nodePaths: [path.join(projectDir, 'node_modules')],
    });

    const api = require(bundlePath);
    const rawLayout = api.deriveCityLayout(CANONICAL_SEED);
    const layout = api.presentCityLayout(rawLayout);
    const snapshot = api.pureCitySnapshot(layout);
    const payload = api.encodeCityGraph(snapshot);
    const layoutPayload = api.encodeCityGraph(layout);
    const layoutSignature = layoutPayload.hash;

    return { payload, layoutSignature };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function deriveInBrowser(projectDir) {
  const playwrightPath = process.env.PLAYWRIGHT_MODULE
    || '/Users/pany/.npm/_npx/705bc6b22212b352/node_modules/playwright';

  if (!fs.existsSync(playwrightPath)) {
    fail(`playwright-not-found:${playwrightPath}`);
  }

  const { chromium } = require(playwrightPath);
  const esbuild = require(path.join(projectDir, 'node_modules/esbuild'));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'city-snap-browser-'));
  const bundlePath = path.join(tempDir, 'bundle.js');

  const browserEntryCode = [
    `import { pureCitySnapshot } from './src/render/city';`,
    `import { deriveCityLayout } from './src/sim/derive';`,
    `import { presentCityLayout } from './src/render/presentationLayout';`,
    `import { encodeCityGraph } from './src/render/citySnapshotCodec';`,
    `try {`,
    `  const rawLayout = deriveCityLayout(${CANONICAL_SEED});`,
    `  const layout = presentCityLayout(rawLayout);`,
    `  const snapshot = pureCitySnapshot(layout);`,
    `  const payload = encodeCityGraph(snapshot);`,
    `  const layoutPayload = encodeCityGraph(layout);`,
    `  window.__CITY_SNAPSHOT_RESULT__ = {`,
    `    payload,`,
    `    layoutSignature: layoutPayload.hash,`,
    `  };`,
    `} catch (err) {`,
    `  window.__CITY_SNAPSHOT_ERROR__ = String(err && err.stack ? err.stack : err);`,
    `}`,
  ].join('\n');

  let server;
  let browser;

  try {
    await esbuild.build({
      stdin: {
        contents: browserEntryCode,
        resolveDir: projectDir,
        sourcefile: 'browser-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      minify: true,
      treeShaking: true,
      outfile: bundlePath,
      logLevel: 'silent',
      nodePaths: [path.join(projectDir, 'node_modules')],
    });

    const bundleJs = fs.readFileSync(bundlePath);

    server = http.createServer((req, res) => {
      if (req.url === '/bundle.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(bundleJs);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><head><script type="module" src="/bundle.js"></script></head><body></body></html>');
      }
    });

    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.goto(url);

    await page.waitForFunction(
      () => window.__CITY_SNAPSHOT_RESULT__ !== undefined || window.__CITY_SNAPSHOT_ERROR__ !== undefined,
      null,
      { timeout: 120000 },
    );

    const result = await page.evaluate(() => {
      if (window.__CITY_SNAPSHOT_ERROR__) {
        throw new Error(window.__CITY_SNAPSHOT_ERROR__);
      }
      return window.__CITY_SNAPSHOT_RESULT__;
    });

    return result;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve)).catch(() => {});
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function run() {
  const options = parseCliArgs(process.argv.slice(2));
  const { records: currentManifest, digest: currentSourceDigest } = computeSourceManifest(options.project);

  if (options.check) {
    const bindingPath = path.join(options.out, 'city-snapshot-424242.binding.json');
    const gzipPath = path.join(options.out, 'city-snapshot-424242.json.gz');
    const manifestPath = path.join(options.out, 'source-manifest.json');

    if (!fs.existsSync(bindingPath)) fail(`check-failed:missing-binding:${bindingPath}`);
    if (!fs.existsSync(gzipPath)) fail(`check-failed:missing-gzip:${gzipPath}`);
    if (!fs.existsSync(manifestPath)) fail(`check-failed:missing-manifest:${manifestPath}`);

    const binding = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    if (binding.codecVersion !== 2) fail('check-failed:binding-codecVersion');
    if (binding.runtime !== options.runtime) {
      fail(`check-failed:runtime-mismatch:expected ${binding.runtime}, got ${options.runtime}`);
    }
    if (binding.canonicalSeed !== CANONICAL_SEED) fail('check-failed:binding-canonicalSeed');
    if (binding.sourceManifestDigest !== currentSourceDigest) {
      fail('check-failed:source-digest-stale');
    }

    const committedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (JSON.stringify(committedManifest) !== JSON.stringify(currentManifest)) {
      fail('check-failed:source-manifest-mismatch');
    }

    const gzipBuffer = fs.readFileSync(gzipPath);
    if (gzipBuffer.byteLength !== binding.gzipBytes) {
      fail('check-failed:gzip-byte-length');
    }
    if (sha256(gzipBuffer) !== binding.gzipSha256) {
      fail('check-failed:gzip-sha256');
    }

    const decompressed = zlib.gunzipSync(gzipBuffer);
    if (decompressed.byteLength !== binding.payloadBytes) {
      fail('check-failed:payload-byte-length');
    }
    const computedPayloadSha = sha256(decompressed);
    if (computedPayloadSha !== binding.payloadSha256) {
      fail('check-failed:payload-sha256');
    }

    const parsedEnvelope = JSON.parse(decompressed.toString('utf8'));
    if (parsedEnvelope.version !== 1) fail('check-failed:envelope-version');
    if (parsedEnvelope.runtime !== options.runtime) fail('check-failed:envelope-runtime');
    if (parsedEnvelope.canonicalSeed !== CANONICAL_SEED) fail('check-failed:envelope-seed');
    if (parsedEnvelope.sourceManifestDigest !== currentSourceDigest) fail('check-failed:envelope-source-digest');
    if (parsedEnvelope.layoutSignature !== binding.layoutSignature) fail('check-failed:envelope-layout-signature');
    if (!parsedEnvelope.payload || parsedEnvelope.payload.hash !== binding.payloadHash) {
      fail('check-failed:envelope-payload-hash');
    }
    if (parsedEnvelope.payload.version !== 2) {
      fail('check-failed:envelope-payload-version');
    }

    // Existing committed files are completely valid. Now verify regenerated same-runtime derivation.
    let derivationResult;
    if (options.runtime === 'node') {
      derivationResult = await deriveInNode(options.project);
    } else if (options.runtime === 'browser') {
      derivationResult = await deriveInBrowser(options.project);
    } else {
      fail(`unsupported-runtime:${options.runtime}`);
    }

    if (derivationResult.layoutSignature !== binding.layoutSignature) {
      fail('check-failed:regenerated-layout-signature-mismatch');
    }
    if (derivationResult.payload.hash !== binding.payloadHash) {
      fail('check-failed:regenerated-payload-hash-mismatch');
    }

    const regenEnvelope = {
      version: 1,
      runtime: options.runtime,
      canonicalSeed: CANONICAL_SEED,
      sourceManifestDigest: currentSourceDigest,
      layoutSignature: derivationResult.layoutSignature,
      payload: derivationResult.payload,
    };
    const regenJsonBuffer = Buffer.from(JSON.stringify(regenEnvelope), 'utf8');
    if (regenJsonBuffer.byteLength !== binding.payloadBytes) {
      fail('check-failed:regenerated-payload-bytes-mismatch');
    }
    if (sha256(regenJsonBuffer) !== binding.payloadSha256) {
      fail('check-failed:regenerated-payload-sha-mismatch');
    }

    const receipt = {
      check: 'PASS',
      runtime: options.runtime,
      canonicalSeed: CANONICAL_SEED,
      committedFilesValid: true,
      regeneratedPayloadMatches: true,
      payloadHash: binding.payloadHash,
      sourceManifestDigest: currentSourceDigest,
    };
    console.log(JSON.stringify(receipt, null, 2));
    return receipt;
  }

  // Not check mode: derive and generate files
  let derivationResult;
  if (options.runtime === 'node') {
    derivationResult = await deriveInNode(options.project);
  } else if (options.runtime === 'browser') {
    derivationResult = await deriveInBrowser(options.project);
  } else {
    fail(`unsupported-runtime:${options.runtime}`);
  }

  const { payload, layoutSignature } = derivationResult;

  const envelope = {
    version: 1,
    runtime: options.runtime,
    canonicalSeed: CANONICAL_SEED,
    sourceManifestDigest: currentSourceDigest,
    layoutSignature,
    payload,
  };

  const payloadJson = JSON.stringify(envelope);
  const jsonBuffer = Buffer.from(payloadJson, 'utf8');
  const payloadBytes = jsonBuffer.byteLength;
  const payloadSha = sha256(jsonBuffer);

  const gzipBuffer = zlib.gzipSync(jsonBuffer, {
    level: 9,
    mtime: 0,
  });
  const gzipBytes = gzipBuffer.byteLength;
  const gzipSha = sha256(gzipBuffer);

  const binding = {
    codecVersion: 2,
    runtime: options.runtime,
    canonicalSeed: CANONICAL_SEED,
    sourceManifestDigest: currentSourceDigest,
    layoutSignature,
    payloadHash: payload.hash,
    payloadBytes,
    payloadSha256: payloadSha,
    gzipBytes,
    gzipSha256: gzipSha,
  };

  fs.mkdirSync(options.out, { recursive: true });

  const stagedDir = fs.mkdtempSync(options.out + '.staged-');
  try {
    fs.writeFileSync(path.join(stagedDir, 'city-snapshot-424242.json.gz'), gzipBuffer);
    fs.writeFileSync(path.join(stagedDir, 'source-manifest.json'), JSON.stringify(currentManifest, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(stagedDir, 'city-snapshot-424242.binding.json'), JSON.stringify(binding, null, 2) + '\n', 'utf8');

    fs.copyFileSync(
      path.join(stagedDir, 'city-snapshot-424242.json.gz'),
      path.join(options.out, 'city-snapshot-424242.json.gz'),
    );
    fs.copyFileSync(
      path.join(stagedDir, 'source-manifest.json'),
      path.join(options.out, 'source-manifest.json'),
    );
    // Copy binding LAST
    fs.copyFileSync(
      path.join(stagedDir, 'city-snapshot-424242.binding.json'),
      path.join(options.out, 'city-snapshot-424242.binding.json'),
    );
  } finally {
    fs.rmSync(stagedDir, { recursive: true, force: true });
  }

  const receipt = {
    generator: 'generate-city-snapshot.cjs',
    runtime: options.runtime,
    canonicalSeed: CANONICAL_SEED,
    out: options.out,
    binding,
    sourceInputCount: currentManifest.length,
    status: 'generated',
  };

  console.log(JSON.stringify(receipt, null, 2));
  return receipt;
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  CANONICAL_SEED,
  DEPENDENCY_INPUTS,
  collectSourcePaths,
  computeSourceManifest,
  deriveInNode,
  deriveInBrowser,
  run,
};
