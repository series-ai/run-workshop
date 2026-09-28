import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const publicShowcaseDir = path.resolve('public/showcase');
const destMp4 = path.join(brainDir, 'gameplay_recording.mp4');
const destWebm = path.join(brainDir, 'gameplay_recording.webm');
const destGif = path.join(brainDir, 'gameplay_loop_compact.gif');

const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const ffprobeBin = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('Clearing port 4398...');
try {
  execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true');
} catch {}

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
        '--window-size=1280,768',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    await page.bringToFront();

    console.log('Spawning ffmpeg image2pipe process for locked 60.0 FPS encode...');
    const ffmpeg = spawn(ffmpegBin, [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', '60',
      '-i', '-',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'medium',
      '-crf', '17',
      '-b:v', '6M',
      '-maxrate', '10M',
      '-bufsize', '12M',
      '-movflags', '+faststart',
      destMp4,
    ], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    let frameCount = 0;
    await page.exposeFunction('onFramePipe', (base64Chunk) => {
      const buf = Buffer.from(base64Chunk, 'base64');
      ffmpeg.stdin.write(buf);
      frameCount++;
      if (frameCount % 60 === 0) {
        process.stdout.write(`\r[Recorder] Captured & encoded ${frameCount}/540 frames (${(frameCount / 60).toFixed(1)}s of locked 60 FPS gameplay)...`);
      }
    });

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

    console.log('\n>>> CAPTURING 540 DETERMINISTIC FRAMES AT LOCKED 60.0 FPS <<<');

    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      const TOTAL_FRAMES = 540; // Exactly 9.000 seconds at locked 60.0 FPS

      for (let f = 0; f < TOTAL_FRAMES; f++) {
        // [1/4] Plasma Torch Slicing (Frames 0 to 70 - 1.16s)
        if (f === 0) {
          window.__SET_LOOK_ANGLES__(0.05, -0.2);
          window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
        } else if (f === 70) {
          window.__SIMULATE_INPUT__({ pressed: false });
        }

        // [2/4] Gravity Gun Levitation (Frames 85 to 170 - 1.4s)
        else if (f === 85) {
          window.__SET_LOOK_ANGLES__(-0.35, -0.15);
          window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
        } else if (f === 170) {
          window.__SIMULATE_INPUT__({ pressed: false });
        }

        // [3/4] Jetpack Aerial Flight (Frames 185 to 275 - 1.5s)
        else if (f === 185) {
          window.__SET_LOOK_ANGLES__(-1.35, -0.18);
          window.__SIMULATE_INPUT__({ jetpack: true, moveZ: 1 });
        } else if (f === 275) {
          window.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 });
        }

        // [4/4] Buggy Mount, 45m Runway Launch, Ramp Jump, Domino Smash, & Drift (Frames 295 to 540)
        else if (f === 295) {
          window.__SIMULATE_INPUT__({ secondary: true }); // Mount buggy cockpit
        } else if (f === 310) {
          // Full throttle down 45m runway toward stunt launch ramp
          window.__SIMULATE_INPUT__({ secondary: false, moveZ: 1, moveX: 0 });
        } else if (f === 430) {
          // Stunt jump flight across water basin and crash landing through domino wall
          window.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.2 });
        } else if (f === 480) {
          // Power drift through southern hairpin curve
          window.__SIMULATE_INPUT__({ moveZ: 0.75, moveX: 0.65 });
        } else if (f === 535) {
          window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
        }

        // Wait for WebGL canvas paint
        await new Promise((r) => requestAnimationFrame(r));

        // Synchronous high-quality JPEG grab
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const base64 = dataUrl.slice(23); // Strip data:image/jpeg;base64,
        await window.onFramePipe(base64);
      }
    });

    console.log(`\n\nAll ${frameCount} frames piped to ffmpeg! Finalizing master MP4...`);
    ffmpeg.stdin.end();

    await new Promise((resolve) => ffmpeg.on('close', resolve));

    await page.close();
    await context.close();
    await browser.close();

    console.log(`Master MP4 saved: ${destMp4} (${(fs.statSync(destMp4).size / (1024 * 1024)).toFixed(2)} MB)`);

    // Transcode Master WebM
    console.log('Transcoding master WebM...');
    execSync(`"${ffmpegBin}" -y -i "${destMp4}" -c:v libvpx -b:v 4M -crf 18 -pix_fmt yuv420p "${destWebm}"`);
    console.log(`Master WebM saved: ${destWebm} (${(fs.statSync(destWebm).size / (1024 * 1024)).toFixed(2)} MB)`);

    // Generate crisp 5.0s showcase loop GIF (Buggy launch & domino smash)
    console.log('Generating crisp 5.0s showcase loop GIF...');
    execSync(`"${ffmpegBin}" -y -ss 00:00:04.500 -t 5.0 -i "${destMp4}" -vf "fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${destGif}"`);
    console.log(`Showcase GIF saved: ${destGif} (${(fs.statSync(destGif).size / (1024 * 1024)).toFixed(2)} MB)`);

    // Mirror to public/showcase
    fs.copyFileSync(destMp4, path.join(publicShowcaseDir, 'gameplay_recording.mp4'));
    fs.copyFileSync(destWebm, path.join(publicShowcaseDir, 'gameplay_recording.webm'));
    fs.copyFileSync(destGif, path.join(publicShowcaseDir, 'gameplay_loop_compact.gif'));
    console.log('Assets mirrored to public/showcase successfully.');

    // Verify with mpdecimate
    console.log('Running verification with mpdecimate...');
    const decimateOutput = execSync(`"${ffmpegBin}" -i "${destMp4}" -vf mpdecimate -loglevel info -f null - 2>&1`).toString();
    console.log('mpdecimate output summary:');
    const matched = decimateOutput.split('\n').filter((l) => l.includes('frame=') || l.includes('Parsed_mpdecimate'));
    console.log(matched.slice(-5).join('\n'));

    console.log('\nSUCCESS! 60 FPS deterministic gameplay recording complete.');
  } finally {
    try { preview.kill(); } catch {}
    try { execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true'); } catch {}
  }
}

record().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
