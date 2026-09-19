import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const videosDir = path.join(brainDir, 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

console.log('Starting preview server with npm run preview...');
const preview = spawn('npm', ['run', 'preview'], {
  cwd: path.resolve('.'),
  stdio: ['ignore', 'pipe', 'pipe'],
});

preview.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
preview.stderr.on('data', (d) => process.stderr.write(`[SERVER-ERR] ${d}`));

// Wait for server ready
async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server failed to start at ${url} within ${timeoutMs}ms`);
}

async function captureScreen(page, filename) {
  const outPath = path.join(brainDir, filename);
  // Try full page screenshot first with a 3s timeout
  try {
    await page.screenshot({ path: outPath, timeout: 3000 });
    console.log(`Saved screenshot (full page): ${filename}`);
    return outPath;
  } catch (err) {
    console.warn(`Full page screenshot timed out, falling back to canvas dataURL: ${err.message}`);
  }

  // Fallback to direct canvas capture
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  });
  if (dataUrl) {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    console.log(`Saved screenshot (canvas toDataURL): ${filename}`);
    return outPath;
  }
  throw new Error(`Failed to capture screenshot for ${filename}`);
}

async function main() {
  try {
    await waitForServer('http://127.0.0.1:4398');
    console.log('Preview server ready! Launching Chromium...');

    const browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--no-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: videosDir,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();
    page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));

    console.log('Navigating to http://127.0.0.1:4398 ...');
    await page.goto('http://127.0.0.1:4398', { waitUntil: 'networkidle' });

    console.log('Waiting for live session status...');
    await page.waitForFunction(() => {
      const el = document.querySelector('body');
      return el && el.innerText.includes('Status: live');
    }, { timeout: 15000 });

    console.log('Live session confirmed! Letting simulation warm up for 1.5s...');
    await page.waitForTimeout(1500);

    // 1. Capture Yard Vista Overview
    console.log('Capturing: Vista overview...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__([16, 9, 17], [0, 1.5, -4]);
      }
    });
    await page.waitForTimeout(800);
    await captureScreen(page, 'wreck_yard_vista_playground.png');

    // 2. Clear camera override for First-Person
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__(null, null);
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(0.1, -0.15);
      }
    });
    await page.waitForTimeout(600);

    // 3. First-Person Plasma Torch Firing
    console.log('Capturing: First-Person Plasma Torch cutting...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
      }
    });
    await page.waitForTimeout(1200);
    await captureScreen(page, 'wreck_yard_torch_cutter.png');

    // Release torch
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ pressed: false });
      }
    });
    await page.waitForTimeout(400);

    // 4. First-Person Gravity Gun Levitation
    console.log('Capturing: First-Person Gravity Gun...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(-0.35, -0.2);
      }
    });
    await page.waitForTimeout(1200);
    await captureScreen(page, 'wreck_yard_gravity_gun.png');

    // 5. First-Person Jetpack Boosting & Aerial Flight
    console.log('Capturing: Jetpack boost over playground...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ pressed: false, jetpack: true, moveZ: 1 });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(0.5, -0.35);
      }
    });
    await page.waitForTimeout(1600);
    await captureScreen(page, 'wreck_yard_jetpack_aerial.png');

    // Release jetpack and settle
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 });
      }
    });
    await page.waitForTimeout(1000);

    console.log('Closing page to finalize video recording...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (videoObj) {
      const recordedVideoPath = await videoObj.path();
      const destVideoPath = path.join(brainDir, 'gameplay_recording.webm');
      fs.copyFileSync(recordedVideoPath, destVideoPath);
      console.log(`Saved video recording to: ${destVideoPath}`);
    }

    console.log('All gameplay captures completed successfully!');
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
