// Use --android to attach to one authorized physical phone through ADB.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { parseRateArm } from './physics-rate-fixture.mjs';

const options = { url: 'http://127.0.0.1:4680/', arm: '30x6', iterations: 6, seconds: 16, android: false, serialized: false };
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--android') { options.android = true; continue; }
  if (flag === '--serialized-replay') { options.serialized = true; continue; }
  assert.ok(['--url', '--arm', '--seconds', '--iterations', '--output', '--serial', '--adb'].includes(flag), `Unknown option: ${flag}`);
  const value = process.argv[++index];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a value.`);
  options[flag.slice(2)] = ['--seconds', '--iterations'].includes(flag) ? Number(value) : value;
}
parseRateArm(options.arm);
assert.ok(options.output, '--output is required.');
const url = new URL(options.url);
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Use the local test server URL.');
assert.ok(Number.isInteger(options.seconds) && options.seconds >= 16 && options.seconds <= 120, 'Invalid duration.');
assert.ok(Number.isInteger(options.iterations) && options.iterations >= 1 && options.iterations <= 32, 'Invalid iteration count.');
url.searchParams.set('arm', options.arm); url.searchParams.set('seconds', String(options.seconds)); url.searchParams.set('run', '1');
url.searchParams.set('iterations', String(options.iterations));
if (options.serialized) url.searchParams.set('serialized', '1');
const adbPath = options.adb ?? process.env.ADB_PATH ?? `${process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`}/platform-tools/adb`;
let browser, page, pageAcquisition, forwardPort, reverseCreated = false, serial, cancelledSignal;
const adb = (...args) => execFileSync(adbPath, serial ? ['-s', serial, ...args] : args, { encoding: 'utf8', timeout: 15_000 }).trim();
const deviceSample = () => ({
  date: new Date().toISOString(),
  battery: adb('shell', 'dumpsys', 'battery').split('\n').map(line => line.trim()).filter(line => /^(AC powered|USB powered|Wireless powered|level|temperature|status|plugged):/.test(line)),
  thermal: adb('shell', 'dumpsys', 'thermalservice').split('\n').map(line => line.trim()).filter(line => /thermal status:|Temperature\{/i.test(line)),
});
let device = null, report, browserVersion;
const errors = [], cleanupErrors = [];
const output = resolve(options.output);
await mkdir(dirname(output), { recursive: true });
const outputHandle = await open(output, 'wx');
let cleanupQueue = Promise.resolve();
const cleanup = () => {
  cleanupQueue = cleanupQueue.then(async () => {
    // A created page must have an owned handle before the CDP transport closes.
    try { await pageAcquisition; } catch {}
    const ownedPage = page, ownedBrowser = browser, ownedForward = forwardPort, ownedReverse = reverseCreated;
    page = undefined; browser = undefined; forwardPort = undefined; reverseCreated = false;
    const steps = [
      ['page', () => ownedPage?.close()],
      ['browser transport', () => ownedBrowser?.close()],
      ['forward port', () => { if (ownedForward) adb('forward', '--remove', `tcp:${ownedForward}`); }],
      ['reverse port', () => { if (ownedReverse) adb('reverse', '--remove', `tcp:${url.port || '80'}`); }],
    ];
    for (const [step, action] of steps) {
      try { await action(); }
      catch (error) { cleanupErrors.push({ step, message: error.message }); }
    }
  });
  return cleanupQueue;
};
const signalHandlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => { cancelledSignal = signal; void cleanup(); }]));
for (const [signal, handler] of signalHandlers) process.once(signal, handler);
try {
  if (options.android) {
    const available = adb('devices').split('\n').slice(1).map(line => line.trim().split(/\s+/)).filter(row => row[1] === 'device').map(row => row[0]);
    if (options.serial) { assert.ok(available.includes(options.serial), 'The selected device is not authorized.'); serial = options.serial; }
    else { assert.equal(available.length, 1, 'Connect one authorized phone, or use --serial.'); serial = available[0]; }
    const prop = key => adb('shell', 'getprop', key);
    const qemu = prop('ro.kernel.qemu'), bootQemu = prop('ro.boot.qemu');
    assert.ok(qemu !== '1' && bootQemu !== '1' && !serial.startsWith('emulator-'), 'Physical-device mode rejects an emulator.');
    device = { model: prop('ro.product.model'), product: prop('ro.product.device'), soc: prop('ro.soc.model'),
      androidVersion: prop('ro.build.version.release'), physicalDevice: true, before: deviceSample() };
    const port = url.port || '80', localPort = `tcp:${port}`;
    const existing = adb('reverse', '--list').split('\n').map(line => line.trim().split(/\s+/));
    const same = existing.find(row => row[1] === localPort);
    if (same) assert.equal(same[2], localPort, 'This reverse port has another target.');
    else { adb('reverse', '--no-rebind', localPort, localPort); reverseCreated = true; }
    // Start Chrome without opening an extra tab, changing flags, or stopping the application.
    adb('shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', 'com.android.chrome');
    forwardPort = adb('forward', 'tcp:0', 'localabstract:chrome_devtools_remote');
    assert.match(forwardPort, /^\d+$/);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${forwardPort}`, { timeout: 30_000 });
    if (cancelledSignal) throw new Error(`Cancelled by ${cancelledSignal}.`);
    pageAcquisition = browser.contexts()[0].newPage();
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    if (cancelledSignal) throw new Error(`Cancelled by ${cancelledSignal}.`);
    pageAcquisition = browser.newPage();
  }
  page = await pageAcquisition;
  pageAcquisition = undefined;
  if (cancelledSignal) throw new Error(`Cancelled by ${cancelledSignal}.`);
  browserVersion = browser.version();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__RATE_READY__, null, { timeout: 30_000, polling: 500 });
  await page.waitForFunction(() => window.__RATE_REPORT__ || window.__RATE_ERROR__, null, { timeout: 1_200_000, polling: 1000 });
  const outcome = await page.evaluate(() => ({ report: window.__RATE_REPORT__, error: window.__RATE_ERROR__ }));
  report = outcome.report;
  assert.equal(outcome.error, null, outcome.error ?? undefined);
  assert.deepEqual(errors, []);
  assert.equal(report.arm, options.arm);
  assert.equal(report.definition.velocityIterations, options.iterations);
  assert.equal(report.seconds, options.seconds);
} catch (error) {
  report = { ...report, schema: report?.schema ?? 'syncplay-rate-browser-failure-v1', pass: false,
    failure: { name: error.name, message: error.message, stack: error.stack } };
} finally {
  if (device) {
    try { device.after = deviceSample(); }
    catch (error) { device.afterError = error.message; }
  }
  // A CDP connection closes its transport here. It leaves the phone's Chrome running.
  await cleanup();
  Object.assign(report, { automation: { mode: options.android ? 'physical-android-chrome' : 'desktop-headless-chrome',
    browserVersion, device, errors, cleanupErrors, cancelledSignal } });
  if (cleanupErrors.length || cancelledSignal) report.pass = false;
  try { await outputHandle.writeFile(JSON.stringify(report, null, 2) + '\n'); }
  finally { await outputHandle.close(); }
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
}
console.log(JSON.stringify({ mode: report.automation.mode, model: device?.model, version: report.version, arm: options.arm,
  pass: report.pass, output, failure: report.failure?.message,
  scenes: report.scenes?.map(row => ({ scene: row.scene, pass: row.pass, apiMsPerSimulatedSecond: row.apiMsPerSimulatedSecond })) }));
if (!report.pass) process.exitCode = cancelledSignal === 'SIGINT' ? 130 : cancelledSignal === 'SIGTERM' ? 143 : 1;
