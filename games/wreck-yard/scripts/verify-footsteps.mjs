// Uses native input, the real simulation, and the real AudioContext output.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const out = fileURLToPath(new URL('../test-results/footsteps/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const receipt = { errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', error => receipt.errors.push(error.message));
try {
  await page.addInitScript(() => {
    const audit = window.__FOOTSTEP_AUDIT__ = { starts: [], phase: 'boot' };
    const fingerprint = buffer => [buffer.length, buffer.sampleRate, ...[0.1, 0.25, 0.5, 0.75].map(f => buffer.getChannelData(0)[Math.floor(buffer.length * f)])].join(':');
    audit.fingerprint = fingerprint;
    const createCompressor = BaseAudioContext.prototype.createDynamicsCompressor;
    BaseAudioContext.prototype.createDynamicsCompressor = function (...args) {
      const node = createCompressor.apply(this, args);
      // Add a capture output. Keep the existing speaker output and real nodes.
      if (!audit.context && this.createMediaStreamDestination) {
        audit.context = this;
        audit.capture = this.createMediaStreamDestination();
        node.connect(audit.capture);
      }
      return node;
    };
    const createSource = BaseAudioContext.prototype.createBufferSource;
    BaseAudioContext.prototype.createBufferSource = function (...args) {
      const source = createSource.apply(this, args);
      const start = source.start;
      source.start = function (...startArgs) {
        const render = window.__WRECK_YARD_CONTROLLER__?.getRender();
        const player = render?.players.find(p => p.slot === render.localSlot);
        audit.starts.push({ phase: audit.phase, time: this.context.currentTime, frame: render?.frame, duration: this.buffer?.duration, fingerprint: this.buffer && fingerprint(this.buffer), player });
        return start.apply(this, startArgs);
      };
      return source;
    };
  });
  await page.goto(`${base}/?capture=off&quality=low`);
  await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame > 30, null, { timeout: 60000 });
  const audio = () => page.evaluate(() => window.__DEBUG_AUDIO__());
  const local = () => page.evaluate(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find(p => p.slot === r.localSlot); });
  const frames = async count => {
    const start = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().frame);
    await page.waitForFunction(target => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= target, start + count, { timeout: 15000 });
  };
  const phase = value => page.evaluate(v => { window.__FOOTSTEP_AUDIT__.phase = v; }, value);
  const steps = () => page.evaluate(() => { const a = window.__FOOTSTEP_AUDIT__; return a.starts.filter(s => s.fingerprint === a.stepFingerprint); });
  const engage = async () => {
    const button = page.getByRole('button', { name: /^Click to play$|^Resume$|Play in a window/ }).first();
    if (await button.count() && await button.isVisible()) await button.click();
    else await page.locator('canvas').first().click();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__?.().active && window.__DEBUG_AUDIO__().status === 'ready', null, { timeout: 45000 });
  };
  await engage();
  receipt.asset = await page.evaluate(async () => {
    const a = window.__FOOTSTEP_AUDIT__;
    const response = await fetch('/audio/robot-step.mp3');
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
    const byteLength = bytes.byteLength;
    const buffer = await a.context.decodeAudioData(bytes);
    a.stepFingerprint = a.fingerprint(buffer);
    const data = buffer.getChannelData(0);
    let peak = 0, squares = 0, maxJump = 0;
    for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); squares += data[i] ** 2; if (i) maxJump = Math.max(maxJump, Math.abs(data[i] - data[i - 1])); }
    return { status: response.status, bytes: byteLength, sha256: hash, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, peak, rms: Math.sqrt(squares / data.length), maxAdjacentJump: maxJump };
  });
  assert.equal(receipt.asset.status, 200);
  assert.ok(receipt.asset.duration > 0 && receipt.asset.duration <= 0.2);
  assert.ok(receipt.asset.duration / 0.92 < 7 / 30, 'The slowest step overlaps the minimum cue interval.');
  await frames(15);
  await phase('idle');
  const idleStart = (await steps()).length;
  await frames(30);
  assert.equal((await steps()).length, idleStart, 'Standing still played a step.');
  await page.evaluate(() => {
    const a = window.__FOOTSTEP_AUDIT__;
    a.chunks = [];
    a.recorder = new MediaRecorder(a.capture.stream, { mimeType: 'audio/webm;codecs=opus' });
    a.recorder.ondataavailable = event => a.chunks.push(event.data);
    a.recorder.start();
    a.phase = 'walk';
    window.__SET_LOOK_ANGLES__(0, 0);
  });
  receipt.walkStart = await local();
  for (const key of ['KeyS', 'KeyW', 'KeyS', 'KeyW']) {
    await page.keyboard.down(key);
    await frames(40);
    await page.keyboard.up(key);
    await frames(3);
  }
  receipt.walkEnd = await local();
  await frames(4);
  await phase('stopped');
  const stoppedStart = (await steps()).length;
  await frames(25);
  assert.equal((await steps()).length, stoppedStart, 'Steps continued after walking stopped.');
  const recording = await page.evaluate(async () => {
    const a = window.__FOOTSTEP_AUDIT__;
    await new Promise(resolve => { a.recorder.onstop = resolve; a.recorder.stop(); });
    const data = await new Blob(a.chunks, { type: a.recorder.mimeType }).arrayBuffer();
    let binary = '';
    for (const value of new Uint8Array(data)) binary += String.fromCharCode(value);
    return btoa(binary);
  });
  await fs.writeFile(`${out}/walking-runtime.webm`, Buffer.from(recording, 'base64'));
  receipt.walkSteps = (await steps()).filter(s => s.phase === 'walk');
  assert.ok(receipt.walkSteps.length >= 8, 'Native walking did not produce enough steps.');
  assert.ok(receipt.walkSteps.every(s => s.player.grounded && !s.player.jetpackActive && !s.player.ridingVehicle), 'A walk sample came from flight or driving.');
  receipt.cadence = receipt.walkSteps.slice(1).map((s, i) => ({ seconds: s.time - receipt.walkSteps[i].time, ticks: s.frame - receipt.walkSteps[i].frame }));
  assert.ok(receipt.cadence.every(gap => gap.ticks >= 7), 'Step cues exceeded their cadence limit.');
  assert.ok(receipt.cadence.every(gap => gap.seconds > receipt.asset.duration / 0.92), 'Walking sounds overlapped.');
  receipt.walkShots = (await audio()).played.filter(shot => Number(shot.id.split('@')[1]) >= receipt.walkSteps[0].frame);
  assert.ok(!receipt.walkShots.some(shot => shot.id.includes(':land@')), 'Flat walking produced a landing sound.');
  await page.screenshot({ path: `${out}/flat-ground.png` });
  await phase('jet');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find(p => p.slot === r.localSlot).jetpackActive; });
  const jetStart = (await steps()).length;
  await frames(25);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('Space');
  assert.equal((await steps()).length, jetStart, 'Jet flight played walking steps.');
  receipt.jet = true;
  await page.waitForFunction(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find(p => p.slot === r.localSlot).grounded; });
  await page.keyboard.press('Escape');
  await page.getByRole('region', { name: 'Paused', exact: true }).waitFor();
  await page.waitForTimeout(250);
  receipt.paused = await audio();
  assert.equal(receipt.paused.outputRms, 0);
  assert.equal(receipt.paused.voices, 0);
  await page.getByRole('checkbox', { name: 'Mute sound', exact: true }).check();
  await engage();
  await page.keyboard.down('KeyS');
  await frames(20);
  await page.keyboard.up('KeyS');
  receipt.muted = await audio();
  assert.equal(receipt.muted.outputRms, 0);
  assert.equal(receipt.muted.voices, 0);
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Mute sound', exact: true }).uncheck();
  await engage();

  assert.deepEqual(receipt.errors, []);
  receipt.pass = true;
  console.log(`PASS: ${receipt.walkSteps.length} native walking steps, real output capture, no steps at rest or in flight.`);
} finally {
  receipt.lastAudio = await page.evaluate(() => window.__DEBUG_AUDIO__?.()).catch(() => null);
  await page.screenshot({ path: `${out}/last-page.png` }).catch(() => {});
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close();
}
