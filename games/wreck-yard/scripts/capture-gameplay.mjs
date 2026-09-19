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
  throw new Error(`Failed to capture screenshot for ${filename}`);
}

async function main() {
  try {
    await waitForServer('http://127.0.0.1:4398');
    console.log('Preview server ready! Launching Google Chrome (channel: chrome)...');

    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: [
        '--enable-webgl',
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--force-device-scale-factor=1',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
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

    console.log('Live session confirmed! Letting WebGL & physics warm up for 1.5s...');
    await page.waitForTimeout(1500);

    // ==========================================
    // PHASE 1: HIGH-RES SCREENSHOT CAPTURES
    // ==========================================
    console.log('--- PHASE 1: CAPTURING HIGH-RES SCREENSHOTS ---');

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

    // Reset camera for Buggy Mount
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__(null, null);
      }
    });
    await page.waitForTimeout(400);

    // Navigate to Buggy and Mount for Cockpit Shot
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
    await page.waitForTimeout(2200);

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

    // Dismount Buggy before starting recorded gameplay loop
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ secondary: true });
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

    // ==========================================
    // PHASE 2: 24 FPS CONTINUOUS GAMEPLAY LOOP RECORDING
    // ==========================================
    console.log('--- PHASE 2: STARTING 24 FPS CONTINUOUS GAMEPLAY RECORDING ---');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas element not found for recording');
      const stream = canvas.captureStream(24);
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';
      }
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      window._recordedChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) window._recordedChunks.push(e.data);
      };
      recorder.start(100);
      window._mediaRecorder = recorder;
    });

    console.log('Recording: Plasma torch slice action...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(0.05, -0.2);
      }
    });
    await page.waitForTimeout(2000);

    console.log('Recording: Gravity Gun tractor levitation...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(-0.35, -0.1);
      }
    });
    await page.waitForTimeout(2200);

    console.log('Recording: Jetpack flight towards buggy...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ pressed: false, jetpack: true, moveZ: 1 });
      }
      if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
        win.__SET_LOOK_ANGLES__(-1.4, -0.2);
      }
    });
    await page.waitForTimeout(2000);

    console.log('Recording: Mounting Buggy...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveZ: 0, jetpack: false, secondary: true });
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

    console.log('Recording: Driving Buggy at speed with steering...');
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.3 });
      }
    });
    await page.waitForTimeout(3000);

    // Stop buggy
    await page.evaluate(() => {
      const win = window;
      if (typeof win.__SIMULATE_INPUT__ === 'function') {
        win.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
      }
    });
    await page.waitForTimeout(500);

    console.log('Stopping 24 FPS canvas stream recorder...');
    const webmBase64 = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const recorder = window._mediaRecorder;
        if (!recorder || recorder.state === 'inactive') return resolve(null);
        recorder.onstop = () => {
          const blob = new Blob(window._recordedChunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            if (typeof res === 'string') {
              resolve(res.replace(/^data:video\/webm;base64,/, ''));
            } else {
              resolve(null);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        };
        recorder.stop();
      });
    });

    console.log('Closing page...');
    await page.close();
    await context.close();
    await browser.close();

    const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

    if (webmBase64) {
      const destVideoPath = path.join(brainDir, 'gameplay_recording.webm');
      fs.writeFileSync(destVideoPath, Buffer.from(webmBase64, 'base64'));
      console.log(`Saved 24 FPS direct GPU canvas recording to: ${destVideoPath}`);

      console.log('Transcoding 24 FPS MP4 video with libx264...');
      const mp4Path = path.join(brainDir, 'gameplay_recording.mp4');
      execSync(`"${ffmpegBin}" -y -i "${destVideoPath}" -vf "setpts=N/(24*TB)" -r 24 -c:v libx264 -pix_fmt yuv420p -preset fast -crf 20 "${mp4Path}"`);
      console.log(`Saved 24 FPS MP4 to: ${mp4Path}`);

      console.log('Generating 12 FPS compact GIF loop...');
      const gifCompact = path.join(brainDir, 'gameplay_loop_compact.gif');
      execSync(`"${ffmpegBin}" -y -ss 00:00:01 -t 6 -i "${mp4Path}" -vf "fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse=dither=bayer" "${gifCompact}"`);
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
    try {
      preview.kill('SIGKILL');
      execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true');
    } catch {}
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error running capture:', err);
  try {
    execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true');
  } catch {}
  process.exit(1);
});
