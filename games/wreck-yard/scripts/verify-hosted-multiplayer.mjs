import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const usage = `AUDIT_URL=<RUN host URL> node scripts/verify-hosted-multiplayer.mjs [--probe] [--local-artifact] [--out DIR]
Optional: AUDIT_STATE_A/B=<Playwright storage state>, AUDIT_PROFILE_A/B=<dedicated Chrome profile>,
AUDIT_CHANNEL=chrome, AUDIT_EXPECT_BUNDLE=index-....js, AUDIT_EXPECT_VERSION=1.8.1, AUDIT_TIMEOUT_MS=90000.
Use two different RUN players. This script does not sign in or replace an SDK API.`;
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(usage); process.exit(0); }
let auditUrl = process.env.AUDIT_URL;
let out = process.env.AUDIT_OUT;
let probeOnly = false;
let localArtifact = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--probe') probeOnly = true;
  else if (args[i] === '--local-artifact') localArtifact = true;
  else if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--url') auditUrl = args[++i];
  else throw new Error(`Unknown option: ${args[i]}`);
}
if (!auditUrl) throw new Error(usage);
const target = new URL(auditUrl);
const targetParts = target.pathname.split('/').filter(Boolean);
const gamePart = targetParts.indexOf('game');
const targetGameId = process.env.AUDIT_GAME_ID ?? (targetParts[0] === 'u' ? targetParts[1] : gamePart >= 0 ? targetParts[gamePart + 1] : undefined);
for (const kind of ['STATE', 'PROFILE']) {
  const a = process.env[`AUDIT_${kind}_A`], b = process.env[`AUDIT_${kind}_B`];
  if (a && b && resolve(a) === resolve(b)) throw new Error(`AUDIT_${kind}_A and AUDIT_${kind}_B must identify different RUN players.`);
}
if (!['https:', 'http:'].includes(target.protocol)) throw new Error('AUDIT_URL must use HTTP or HTTPS.');
if (localArtifact && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname)) throw new Error('--local-artifact requires a loopback URL.');
const timeout = Number(process.env.AUDIT_TIMEOUT_MS ?? 90_000);
if (!Number.isSafeInteger(timeout) || timeout < 5000 || timeout > 180_000) throw new Error('AUDIT_TIMEOUT_MS must be 5000..180000.');
const output = resolve(out ?? `test-results/hosted-multiplayer/${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function safeUrl(value) {
  try { const url = new URL(value); url.search = ''; url.hash = ''; url.username = ''; url.password = ''; return url.href; }
  catch { return String(value); }
}
function safeText(value) {
  let text = String(value);
  for (const [name, secret] of target.searchParams) {
    if (/^(k|key|token|access_token|signature|sig|auth)$/i.test(name) && secret.length > 3) text = text.split(secret).join('[redacted]');
  }
  return text.replace(/https?:\/\/[^\s"'<>]+/g, safeUrl)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted token]')
    .replace(/(Bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]').slice(0, 6000);
}
class AccessBlock extends Error {}
const report = {
  startedAt: new Date().toISOString(), url: safeUrl(auditUrl), probeOnly,
  scope: localArtifact ? 'local built artifact with real local SDK authority; not hosted proof' : 'actual RUN host',
  expectedBundle: process.env.AUDIT_EXPECT_BUNDLE ?? null, expectedVersion: process.env.AUDIT_EXPECT_VERSION ?? null,
  browser: null, checks: [], peers: [],
  limits: [
    'No SDK, HTTP, room transport, or physics API is replaced.',
    'Read-only game observations use the existing controller snapshot and render.',
    'Crew and pose checks do not prove canonical ownership cleanup or state checksum parity.',
    'Current config has four fixed slots and no explicit seat policy. New-owner seat reuse is not promised.',
  ],
};
const peers = [];
const browsers = [];
async function save() {
  const json = JSON.stringify(report, (key, value) => {
    if (/token|cookie|password|secret|authorization|credential|signature|email/i.test(key)) return '[redacted]';
    return typeof value === 'string' ? safeText(value) : value;
  }, 2);
  await writeFile(resolve(output, 'results.json'), json + '\n');
}
async function screenshot(peer, name) {
  await peer.page.screenshot({ path: resolve(output, `${name}-${peer.id}.png`), fullPage: true }).catch(() => {});
}
async function check(name, task, dependencies = []) {
  const missing = dependencies.filter(dependency => !report.checks.some(check => check.name === dependency && check.status === 'passed'));
  if (missing.length) { report.checks.push({ name, status: 'blocked', reason: `Required checks did not pass: ${missing.join(', ')}` }); await save(); return null; }
  const start = Date.now();
  try {
    const observations = await task();
    report.checks.push({ name, status: 'passed', durationMs: Date.now() - start, observations });
    console.log(`PASS ${name}`); await save(); return observations;
  } catch (error) {
    report.checks.push({ name, status: error instanceof AccessBlock ? 'blocked' : 'failed', durationMs: Date.now() - start, error: safeText(error.stack ?? error) });
    console.log(`${error instanceof AccessBlock ? 'BLOCKED' : 'FAIL'} ${name}: ${safeText(error.message)}`);
    await Promise.all(peers.map(peer => screenshot(peer, `failed-${report.checks.length}`)));
    await save(); return null;
  }
}
const launchOptions = {
  headless: true, ...(process.env.AUDIT_CHANNEL ? { channel: process.env.AUDIT_CHANNEL } : {}),
  args: ['--no-sandbox', '--enable-webgl', ...(process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : [])],
};
async function openPeer(id) {
  const profile = process.env[`AUDIT_PROFILE_${id}`];
  const storageState = process.env[`AUDIT_STATE_${id}`];
  if (profile && storageState) throw new Error(`Use a profile or storage state for player ${id}, not both.`);
  let context;
  if (profile) {
    context = await chromium.launchPersistentContext(resolve(profile), { ...launchOptions, viewport: { width: 1440, height: 900 } });
  } else {
    const browser = browsers[0] ?? await chromium.launch(launchOptions);
    if (!browsers.length) browsers.push(browser);
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(storageState ? { storageState: resolve(storageState) } : {}) });
  }
  const page = await context.newPage();
  const peer = { id, context, page, frame: null, errors: [], console: [], network: [], bundles: new Set(), releases: [], metadataPending: [] };
  peers.push(peer);
  if (!report.browser) report.browser = context.browser()?.version() ?? 'persistent Chromium';
  page.on('pageerror', error => peer.errors.push(safeText(error)));
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && peer.console.length < 100) peer.console.push(safeText(message.text())); });
  page.on('response', response => {
    const url = safeUrl(response.url());
    if (/\/assets\/.*\.js$/.test(new URL(url).pathname)) peer.bundles.add(url);
    if (response.status() >= 400 && peer.network.length < 100) peer.network.push({ status: response.status(), url });
    if (response.headers()['content-type']?.includes('json') && /\/games?\//.test(new URL(url).pathname) && (!targetGameId || new URL(url).pathname.split('/').includes(targetGameId))) {
      peer.metadataPending.push((async () => {
        try {
          const body = await response.json();
          function findVersions(value, path = '', depth = 0) {
            if (depth > 10 || value === null) return;
            if (typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value)) peer.releases.push({ url, path, version: value });
            else if (typeof value === 'object') for (const [key, item] of Object.entries(value)) findVersions(item, `${path}/${key}`, depth + 1);
          }
          findVersions(body);
        } catch { /* A body can be unavailable after host navigation. */ }
      })());
    }
  });
  await page.goto(auditUrl, { waitUntil: 'domcontentloaded', timeout });
  return peer;
}
async function gameFrame(peer) {
  const until = Date.now() + timeout;
  let clickedHostPlay = false;
  while (Date.now() < until) {
    for (const frame of peer.page.frames()) {
      if (frame.isDetached()) continue;
      if (await frame.locator('.yard-app').count().catch(() => 0)) {
        if (!frame.parentFrame() && !localArtifact) throw new AccessBlock('The URL opened a direct game page. A RUN host game iframe is required.');
        peer.frame = frame;
        return frame;
      }
    }
    if (!clickedHostPlay) {
      const play = peer.page.getByRole('button', { name: /^(play|play game|start game|launch game)$/i });
      if (await play.count() === 1 && await play.isVisible()) { await play.click(); clickedHostPlay = true; }
    }
    await pause(250);
  }
  const body = safeText(await peer.page.locator('body').innerText());
  peer.hostControls = (await peer.page.locator('button, a').allTextContents()).map(value => safeText(value.trim())).filter(Boolean).slice(0, 30);
  if (localArtifact) throw new Error(`The local built app did not mount. Visible text: ${body}`);
  throw new AccessBlock(`No Wreck Yard iframe appeared. Host text: ${body}. Supply separate authenticated AUDIT_STATE_A/B files (include IndexedDB) or dedicated AUDIT_PROFILE_A/B directories if this host needs sign-in.`);
}
async function read(peer) {
  if (!peer.frame || peer.frame.isDetached()) return null;
  return peer.frame.evaluate(() => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    if (!controller) return null;
    const snapshot = controller.snapshot();
    const render = controller.getRender();
    return {
      status: snapshot.status, error: snapshot.error, errorDetails: snapshot.errorDetails,
      roomCode: snapshot.roomCode, crew: snapshot.crew, localSlot: snapshot.localSlot,
      frame: render?.frame ?? null,
      players: render?.players.map(player => ({ slot: player.slot, position: [...player.position], ridingVehicle: player.ridingVehicle, grabbing: player.grabbing })) ?? [],
    };
  });
}
async function waitFor(peer, predicate, description, duration = timeout) {
  const until = Date.now() + duration;
  let last;
  while (Date.now() < until) {
    last = await read(peer);
    if (!localArtifact && await peer.page.getByText('This game uses features that need a RUN account. Log in to continue.', { exact: true }).isVisible().catch(() => false)) {
      peer.authBoundary = 'RUN shows a sign-in modal. Two different signed-in RUN player states or dedicated profiles are required.';
      throw new AccessBlock(peer.authBoundary);
    }
    if (predicate(last)) return last;
    await pause(100);
  }
  throw new Error(`${description}. Last observation: ${safeText(JSON.stringify(last))}`);
}
async function live(peer, code) {
  return waitFor(peer, state => {
    if (state?.status === 'error') throw new Error(`Real room error: ${JSON.stringify(state)}`);
    return state?.status === 'live' && state.frame > 5 && (!code || state.roomCode === code);
  }, `Player ${peer.id} did not reach a live room`);
}
async function advance(peer, minimum = 8) {
  const before = await read(peer);
  const after = await waitFor(peer, state => state?.status === 'live' && state.frame > before.frame + minimum, `Player ${peer.id} frames did not advance`, 20_000);
  return { before: before.frame, after: after.frame };
}
async function openPause(peer) {
  const menu = peer.frame.getByRole('region', { name: 'Paused', exact: true });
  if (await menu.isVisible().catch(() => false)) return menu;
  await peer.frame.getByRole('button', { name: 'Pause', exact: true }).click();
  await menu.waitFor({ state: 'visible', timeout: 10_000 });
  return menu;
}
async function resume(peer) {
  const start = peer.frame.getByRole('button', { name: 'Click to play', exact: true });
  const resume = peer.frame.getByRole('button', { name: /^Resume(?: fullscreen)?$/ });
  if (await start.isVisible().catch(() => false)) await start.click();
  else if (await resume.isVisible().catch(() => false)) await resume.click();
  const fallback = peer.frame.getByRole('button', { name: 'Play in a window (drag to look)', exact: true });
  if (await fallback.isVisible().catch(() => false)) await fallback.click();
}
async function join(peer, code) {
  const current = await read(peer);
  if (current?.status === 'live') await openPause(peer);
  const input = peer.frame.getByRole('textbox', { name: /^Join (?:another room|a room)$/ });
  await input.fill(code);
  await input.locator('..').getByRole('button', { name: 'Join', exact: true }).click();
  return live(peer, code);
}
async function leave(peer) {
  await openPause(peer);
  await peer.frame.getByRole('button', { name: 'Leave match', exact: true }).click();
  return waitFor(peer, state => state?.status === 'idle', `Player ${peer.id} did not leave`);
}

try {
  const a = await openPeer('A');
  const first = await check('host-and-create-A', async () => {
    await gameFrame(a);
    const state = await live(a);
    assert.equal(state.crew.capacity, 4);
    assert.equal(state.crew.occupied, 1);
    if (report.expectedBundle) assert([...a.bundles].some(url => url.endsWith(`/${report.expectedBundle}`)), 'Expected deployed bundle was not requested.');
    await screenshot(a, 'initial');
    return { frameUrl: safeUrl(a.frame.url()), state, bundles: [...a.bundles] };
  });
  if (a.frame && report.expectedVersion) await check('release-version', async () => {
    await Promise.allSettled(a.metadataPending);
    assert(a.releases.some(release => release.version === report.expectedVersion && /\/(?:tag|release)\/(?:versionId|version\/versionNumber)$/.test(release.path)), 'The expected release version was not found in the real host game API responses.');
    return a.releases;
  });
  if (!probeOnly && first) {
    const b = await openPeer('B');
    const initialB = await check('host-and-create-B', async () => {
      await gameFrame(b); const state = await live(b);
      assert.equal(state.crew.capacity, 4); assert.equal(state.crew.occupied, 1);
      if (report.expectedBundle) assert([...b.bundles].some(url => url.endsWith(`/${report.expectedBundle}`)), 'B did not request the expected built bundle.');
      assert.notEqual(state.roomCode, first.state.roomCode, 'Independent startup must create a separate room.');
      return { frameUrl: safeUrl(b.frame.url()), state, bundles: [...b.bundles] };
    });
    const pair = await check('copy-and-join', async () => {
      await openPause(a);
      const code = await a.frame.getByRole('textbox', { name: 'Your room code', exact: true }).inputValue();
      assert.equal(code, first.state.roomCode);
      await a.frame.getByRole('button', { name: 'Copy code', exact: true }).click();
      await a.frame.getByRole('button', { name: 'Copied', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
      await join(b, code);
      const stateA = await waitFor(a, state => state?.crew.occupied === 2, 'A did not confirm two humans');
      const stateB = await waitFor(b, state => state?.crew.occupied === 2, 'B did not confirm two humans');
      assert.equal(stateA.roomCode, stateB.roomCode); assert.notEqual(stateA.localSlot, stateB.localSlot);
      assert.equal(stateA.players.length, 4); assert.equal(stateB.players.length, 4);
      await screenshot(a, 'joined'); await screenshot(b, 'joined');
      return { code, stateA, stateB, advanceA: await advance(a), advanceB: await advance(b) };
    }, ['host-and-create-B']);
    await check('remote-movement', async () => {
      await resume(b);
      const slot = pair.stateB.localSlot;
      const before = await read(b);
      const beforePosition = before.players.find(player => player.slot === slot).position;
      const canvas = b.frame.locator('canvas').first();
      await canvas.click({ position: { x: 200, y: 200 } });
      await b.page.keyboard.down('KeyW');
      let after;
      try { after = await waitFor(b, state => state.frame > before.frame + 20, 'Moving peer frames stopped', 15_000); }
      finally { await b.page.keyboard.up('KeyW'); }
      const position = after.players.find(player => player.slot === slot).position;
      assert(Math.hypot(...position.map((value, index) => value - beforePosition[index])) > .3, 'Keyboard input did not move the native player.');
      const seen = await waitFor(a, state => {
        const peer = state?.players.find(player => player.slot === slot);
        return peer && Math.hypot(...peer.position.map((value, index) => value - beforePosition[index])) > .3;
      }, 'A did not observe B movement', 20_000);
      await screenshot(a, 'remote-movement');
      return { slot, beforePosition, localAfter: position, remoteAfter: seen.players.find(player => player.slot === slot).position, localFrame: after.frame, remoteFrame: seen.frame };
    }, ['copy-and-join']);
    await check('leave-and-remaining-progress', async () => {
      const departed = await leave(b);
      const remaining = await waitFor(a, state => state?.crew.occupied === 1, 'A did not confirm B departure');
      return { departed, remaining, frames: await advance(a) };
    }, ['copy-and-join']);
    await check('same-player-rejoin', async () => {
      const returned = await join(b, pair.code);
      const owner = await waitFor(a, state => state?.crew.occupied === 2, 'A did not confirm returning player');
      assert.equal(returned.localSlot, pair.stateB.localSlot, 'Same player did not reclaim the prior slot.');
      return { returned, owner, frames: await advance(b) };
    }, ['leave-and-remaining-progress']);
    await check('invalid-code-and-recovery', async () => {
      await openPause(b);
      const input = b.frame.getByRole('textbox', { name: /^Join (?:another room|a room)$/ });
      await input.fill('ZZZZZZ');
      await input.locator('..').getByRole('button', { name: 'Join', exact: true }).click();
      const error = await waitFor(b, state => state?.status === 'error', 'Invalid code did not produce an error');
      const dialog = b.frame.getByRole('alertdialog');
      await dialog.waitFor({ state: 'visible', timeout: 10_000 });
      await screenshot(b, 'invalid-code');
      await dialog.getByRole('button', { name: 'New room', exact: true }).click();
      const recovered = await live(b);
      assert.notEqual(recovered.roomCode, pair.code);
      return { error, recovered, frames: await advance(b) };
    }, ['same-player-rejoin']);
    await check('switch-room', async () => {
      const before = await read(b);
      const switched = await join(b, pair.code);
      assert.notEqual(before.roomCode, switched.roomCode);
      const owner = await waitFor(a, state => state?.crew.occupied === 2, 'A did not confirm room switch');
      return { before, switched, owner, frames: await advance(a) };
    }, ['invalid-code-and-recovery']);
  }
} catch (error) {
  report.fatal = safeText(error.stack ?? error);
  console.log(`FAIL audit setup: ${safeText(error.message)}`);
} finally {
  for (const peer of peers) {
    const state = await read(peer).catch(() => null);
    report.peers.push({ id: peer.id, topUrl: safeUrl(peer.page.url()), frameUrl: peer.frame ? safeUrl(peer.frame.url()) : null, authBoundary: peer.authBoundary ?? null, hostControls: peer.hostControls ?? null, state, errors: peer.errors, console: peer.console, network: peer.network, bundles: [...peer.bundles], releases: peer.releases });
    if (state?.status === 'live') await leave(peer).catch(() => {});
    await peer.context.close().catch(() => {});
  }
  for (const browser of browsers) await browser.close().catch(() => {});
  if (!probeOnly) {
    for (const name of ['host-and-create-A', 'host-and-create-B', 'copy-and-join', 'remote-movement', 'leave-and-remaining-progress', 'same-player-rejoin', 'invalid-code-and-recovery', 'switch-room']) {
      if (!report.checks.some(check => check.name === name)) report.checks.push({ name, status: 'blocked', reason: 'A required room startup check did not pass.' });
    }
  }
  report.finishedAt = new Date().toISOString();
  report.passed = !report.fatal && report.checks.length > 0 && report.checks.every(check => check.status === 'passed') && report.peers.every(peer => peer.errors.length === 0);
  await save();
  console.log(`Evidence: ${output}`);
  if (!report.passed) process.exitCode = 1;
}
