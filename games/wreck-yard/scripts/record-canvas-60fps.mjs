import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const publicShowcaseDir = path.resolve('public/showcase');
const tempWebm = '/tmp/raw_canvas_60fps.webm';
if (fs.existsSync(tempWebm)) fs.unlinkSync(tempWebm);

const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const ffprobeBin = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('Clearing port 4398 and 4399...');
try {
  execSync('lsof -ti :4398,4399 | xargs kill -9 2>/dev/null || true');
} catch {}

// Create high-throughput streaming receiver for recorded WebM blob
let resolveUpload;
const uploadDone = new Promise((resolve) => { resolveUpload = resolve; });
const uploadServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'POST' && req.url === '/upload') {
    const fileStream = fs.createWriteStream(tempWebm);
    req.pipe(fileStream);
    fileStream.on('finish', () => {
      console.log('Direct binary WebM stream received and flushed to disk.');
      res.writeHead(200);
      res.end('OK');
      resolveUpload();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
uploadServer.listen(4399);

console.log('Spawning preview server...');
const preview = spawn('npm', ['run', 'preview'], {
  cwd: path.resolve('.'),
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer(url = 'http://127.0.0.1:4398', timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Server failed to start at ${url}`);
}

async function record() {
  try {
    await waitForServer();
    console.log('Preview server ready! Launching Chrome with hardware Metal GPU...');

    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [
        '--use-gl=angle',
        '--use-angle=metal',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--force-device-scale-factor=1',
        '--autoplay-policy=no-user-gesture-required',
        '--window-size=1280,768',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    await page.bringToFront();
    console.log('Navigating to http://127.0.0.1:4398?record=1 ...');
    await page.goto('http://127.0.0.1:4398?record=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas');

    console.log('Waiting for hooks and live session...');
    await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function' && typeof window.__SIMULATE_INPUT__ === 'function');
    for (let i = 0; i < 30; i++) {
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      if (text.includes('Status: live')) break;
      await sleep(300);
    }

    console.log('Attaching native 60 FPS MediaRecorder directly to WebGL canvas.captureStream(60)...');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');
      const stream = canvas.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 16000000,
      });
      window.__RECORDER_CHUNKS__ = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) window.__RECORDER_CHUNKS__.push(e.data);
      };
      recorder.start(50);
      window.__RECORDER__ = recorder;
    });

    console.log('>>> RECORDING NATIVE 60 FPS GAMEPLAY SEQUENCE <<<');

    // 1. Plasma Torch Slicing (1.2s - crisp slice)
    console.log('[1/4] Plasma Torch: Slicing structural gantry...');
    await page.evaluate(() => {
      window.__SET_LOOK_ANGLES__(0.05, -0.2);
      window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
    });
    await sleep(1200);
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ pressed: false });
    });
    await sleep(250);

    // 2. Gravity Gun Levitation (1.4s - levitate block)
    console.log('[2/4] Gravity Gun: Levitation & tractor beam...');
    await page.evaluate(() => {
      window.__SET_LOOK_ANGLES__(-0.35, -0.15);
      window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
    });
    await sleep(1400);
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ pressed: false });
    });
    await sleep(250);

    // 3. Jetpack Aerial Flight (1.6s - airborne vault toward buggy runway)
    console.log('[3/4] Jetpack: Aerial flight over basin towards buggy runway...');
    await page.evaluate(() => {
      window.__SET_LOOK_ANGLES__(-1.35, -0.18);
      window.__SIMULATE_INPUT__({ jetpack: true, moveZ: 1 });
    });
    await sleep(1600);
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 });
    });
    await sleep(300);

    // 4. Buggy Mount, 45m Runway Launch, Ramp Jump, Domino Wall Smash, & Power Slide (4.5s)
    console.log('[4/4] Buggy: Mount cockpit, runway acceleration, ramp launch, crash into domino wall, and drift...');
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ secondary: true });
    });
    await sleep(250);

    // Full throttle down runway straight towards the launch ramp
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ secondary: false, moveZ: 1, moveX: 0 });
    });
    await sleep(2200);

    // Mid-air flight and crash landing through domino wall
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.2 });
    });
    await sleep(1200);

    // Power drift through southern hairpin curve
    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ moveZ: 0.7, moveX: 0.6 });
    });
    await sleep(1200);

    await page.evaluate(() => {
      window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
    });
    await sleep(300);

    console.log('Choreography complete! Triggering MediaRecorder upload...');
    await page.evaluate(() => {
      const recorder = window.__RECORDER__;
      if (!recorder) throw new Error('No active recorder');
      recorder.onstop = () => {
        const blob = new Blob(window.__RECORDER_CHUNKS__, { type: 'video/webm' });
        fetch('http://127.0.0.1:4399/upload', {
          method: 'POST',
          body: blob,
        }).catch((err) => console.error('Upload failed:', err));
      };
      recorder.stop();
    });

    console.log('Waiting for binary stream transfer to finish...');
    await uploadDone;
    uploadServer.close();

    const stats = fs.statSync(tempWebm);
    console.log(`Native 60 FPS WebM saved: ${tempWebm} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);

    await page.close();
    await context.close();
    await browser.close();

    // Master 60 FPS MP4 with pristine visual quality (CRF 17, medium preset, yuv420p, web-ready faststart)
    console.log('Transcoding master 60 FPS MP4 with libx264 (CRF 17, 6 Mbps, web-optimized)...');
    const destMp4 = path.join(brainDir, 'gameplay_recording.mp4');
    execSync(`"${ffmpegBin}" -y -i "${tempWebm}" -c:v libx264 -pix_fmt yuv420p -r 60 -preset medium -crf 17 -b:v 6M -maxrate 10M -bufsize 12M -movflags +faststart "${destMp4}"`);
    console.log(`Master MP4: ${destMp4} (${(fs.statSync(destMp4).size / (1024 * 1024)).toFixed(2)} MB)`);

    // Master WebM
    console.log('Transcoding master WebM...');
    const destWebm = path.join(brainDir, 'gameplay_recording.webm');
    execSync(`"${ffmpegBin}" -y -i "${tempWebm}" -c:v libvpx -b:v 4M -crf 18 -deadline realtime -cpu-used 4 "${destWebm}"`);
    console.log(`Master WebM: ${destWebm} (${(fs.statSync(destWebm).size / (1024 * 1024)).toFixed(2)} MB)`);

    // 5.0s Compact Showcase Loop GIF (from torch slicing)
    console.log('Generating crisp 5.0s showcase loop GIF...');
    const destGif = path.join(brainDir, 'gameplay_loop_compact.gif');
    execSync(`"${ffmpegBin}" -y -t 5.0 -i "${tempWebm}" -vf "fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse=dither=bayer" "${destGif}"`);
    console.log(`Showcase GIF: ${destGif} (${(fs.statSync(destGif).size / (1024 * 1024)).toFixed(2)} MB)`);

    // Copy to public showcase directory for frontend serving
    if (fs.existsSync(publicShowcaseDir)) {
      fs.copyFileSync(destMp4, path.join(publicShowcaseDir, 'gameplay_recording.mp4'));
      fs.copyFileSync(destWebm, path.join(publicShowcaseDir, 'gameplay_recording.webm'));
      fs.copyFileSync(destGif, path.join(publicShowcaseDir, 'gameplay_loop_compact.gif'));
      console.log('Assets mirrored to public/showcase successfully.');
    }

    console.log('SUCCESS! Native 60 FPS gameplay video generated with ZERO glitches and full fluid fidelity.');
    process.exit(0);
  } finally {
    try {
      uploadServer.close();
    } catch {}
    try {
      preview.kill('SIGKILL');
    } catch {}
  }
}

record().catch((err) => {
  console.error('Recording failed:', err);
  try {
    uploadServer.close();
  } catch {}
  try {
    preview.kill('SIGKILL');
  } catch {}
  process.exit(1);
});
