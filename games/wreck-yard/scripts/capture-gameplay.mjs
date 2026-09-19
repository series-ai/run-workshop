import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
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
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  });
  if (dataUrl) {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
    return outPath;
  }
  await page.screenshot({ path: outPath, timeout: 2000 });
  console.log(`Saved fallback screenshot: ${filename}`);
  return outPath;
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
    page.on('pageerror', (err) => console.error('[BROWSER-PAGE-ERROR]', err));

    console.log('Navigating to http://127.0.0.1:4398 ...');
    await page.goto('http://127.0.0.1:4398', { waitUntil: 'networkidle' });

    console.log('Checking live session status...');
    let isLive = false;
    for (let i = 0; i < 30; i++) {
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      if (text.includes('Status: live')) {
        isLive = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!isLive) throw new Error('Live session did not become active within 15s');

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
    await page.waitForTimeout(600);

    // 5b. Navigate to Buggy and Mount
    console.log('Navigating player towards Buggy staging pad...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveX: 1, moveZ: 0.15, jetpack: true });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(-1.42, -0.15);
      }
    });
    await page.waitForTimeout(2400);

    // Mount buggy with interaction key (secondary)
    console.log('Mounting Buggy with interaction key...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveX: 0, moveZ: 0, jetpack: false, secondary: true });
      }
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ secondary: false });
      }
    });
    await page.waitForTimeout(600);

    // Capture Cockpit View when Seated
    console.log('Capturing: Buggy Cockpit view while driving...');
    await captureScreen(page, 'wreck_yard_buggy_cockpit.png');

    // Drive forward and steer!
    console.log('Driving buggy forward with throttle and steering...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.4 });
      }
    });
    await page.waitForTimeout(1400);

    // Stop buggy driving
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
      }
    });
    await page.waitForTimeout(500);

    // 6. Focus Shot: Buggy Vehicle & Tire Barriers (Player-Sized Scale)
    console.log('Capturing: Buggy vehicle & tire barrier sector...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__([16.0, 3.2, 7.0], [11.8, 1.0, 12.2]);
      }
    });
    await page.waitForTimeout(800);
    await captureScreen(page, 'wreck_yard_buggy_sector.png');

    // 7. Focus Shot: Destructible Tower & Shipping Containers
    console.log('Capturing: Tower & shipping containers...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__([-8, 4.2, -6], [-14, 2.5, -14]);
      }
    });
    await page.waitForTimeout(800);
    await captureScreen(page, 'wreck_yard_tower_containers.png');

    // Reset camera
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__(null, null);
      }
    });
    await page.waitForTimeout(600);

    console.log('Closing page to finalize video recording...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

    if (videoObj) {
      const recordedVideoPath = await videoObj.path();
      const destVideoPath = path.join(brainDir, 'gameplay_recording.webm');
      fs.copyFileSync(recordedVideoPath, destVideoPath);
      console.log(`Saved video recording to: ${destVideoPath}`);

      console.log('Transcoding MP4 video...');
      const mp4Path = path.join(brainDir, 'gameplay_recording.mp4');
      execSync(`"${ffmpegBin}" -y -i "${destVideoPath}" -c:v libx264 -pix_fmt yuv420p -crf 23 "${mp4Path}"`);
      console.log(`Saved MP4 to: ${mp4Path}`);

      console.log('Generating compact GIF loop...');
      const gifCompact = path.join(brainDir, 'gameplay_loop_compact.gif');
      execSync(`"${ffmpegBin}" -y -ss 00:00:01 -t 6 -i "${destVideoPath}" -vf "fps=10,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse=dither=bayer" "${gifCompact}"`);
      console.log(`Saved compact GIF to: ${gifCompact}`);
    }

    const pngs = [
      'wreck_yard_vista_playground.png',
      'wreck_yard_torch_cutter.png',
      'wreck_yard_gravity_gun.png',
      'wreck_yard_jetpack_aerial.png',
      'wreck_yard_buggy_cockpit.png',
      'wreck_yard_buggy_sector.png',
      'wreck_yard_tower_containers.png',
    ];
    for (const png of pngs) {
      const inPng = path.join(brainDir, png);
      const outJpg = inPng.replace('.png', '.jpg');
      if (fs.existsSync(inPng)) {
        execSync(`"${ffmpegBin}" -y -i "${inPng}" -q:v 2 "${outJpg}"`);
        console.log(`Transcoded ${png} -> ${path.basename(outJpg)}`);
      }
    }

    console.log('Building updated modular showcase HTML pages...');
    execSync('node scripts/build-modular-showcase.mjs', { stdio: 'inherit' });

    console.log('All gameplay captures and showcase build completed successfully!');
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
