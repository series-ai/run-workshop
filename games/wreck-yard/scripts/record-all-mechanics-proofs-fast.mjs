import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const publicShowcaseDir = path.resolve('public/showcase');
const tempDir = '/tmp/wreck_yard_proofs_fast';

if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

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

const MECHANICS = [
  {
    id: 'proof-01-plasma-torch',
    title: 'Plasma Torch Voxel Precision Slicing',
    durationMs: 4500,
    action: async (page) => {
      // Teleport directly in front of steel gantry crossbar
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__TELEPORT_PLAYER__([2.18, 0.2, 1.8]);
        window.__SET_LOOK_ANGLES__(0, 0.02);
      });
      await sleep(400);
      // Fire plasma torch across the crossbar
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
      // Slice cleanly through the structural beam
      for (let i = 0; i < 22; i++) {
        await sleep(90);
        await page.evaluate((step) => {
          window.__SET_LOOK_ANGLES__(-0.16 + step * 0.015, 0.02);
        }, i);
      }
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ pressed: false });
      });
      await sleep(1500); // Watch severed truss piece fall and hit floor
    },
  },
  {
    id: 'proof-02-gravity-gun',
    title: 'Gravity Gun Kinetic Levitation & Tractor Beam',
    durationMs: 4600,
    action: async (page) => {
      // Teleport in front of the heavy ballast box
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__TELEPORT_PLAYER__([0.62, 0.2, 3.8]);
        window.__SET_LOOK_ANGLES__(0, -0.16);
      });
      await sleep(400);
      // Engage tractor beam
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
      // Wave container in 3D arc
      for (let i = 0; i < 20; i++) {
        await sleep(90);
        await page.evaluate((step) => {
          window.__SET_LOOK_ANGLES__(Math.sin(step * 0.3) * 0.22, -0.16 + Math.cos(step * 0.25) * 0.12);
        }, i);
      }
      // Hurl crate across yard with kinetic punt
      await page.evaluate(() => {
        window.__SET_LOOK_ANGLES__(0.1, -0.05);
        window.__SIMULATE_INPUT__({ secondary: true });
      });
      await sleep(200);
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ secondary: false, pressed: false });
      });
      await sleep(1800);
    },
  },
  {
    id: 'proof-03-jetpack-flight',
    title: 'Jetpack Aerial 3D Flight & Basin Vaulting',
    durationMs: 4600,
    action: async (page) => {
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__TELEPORT_PLAYER__([0, 0.2, 7.0]);
        window.__SET_LOOK_ANGLES__(0, 0.12);
      });
      await sleep(400);
      // High thrust aerial ascent
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ tool: 'orbit', pressed: false, moveX: 0, moveZ: 1, jetpack: true, secondary: false });
      });
      // Soar high over basin and industrial yard
      for (let i = 0; i < 24; i++) {
        await sleep(100);
        await page.evaluate((step) => {
          window.__SET_LOOK_ANGLES__(Math.sin(step * 0.15) * 0.18, 0.12 - step * 0.008);
        }, i);
      }
      // Feather descent and land firmly on plinth
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 });
      });
      await sleep(1400);
    },
  },
  {
    id: 'proof-04-water-buoyancy',
    title: 'Hydrodynamic Fluid Buoyancy & Floating Debris',
    durationMs: 4400,
    action: async (page) => {
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__([15, 6.5, -5], [11, 0, -11]);
        window.__SIMULATE_INPUT__({ pressed: false, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
      // Orbit camera around water basin showing buoyant objects & hydrodynamic ripples
      for (let i = 0; i < 35; i++) {
        await sleep(100);
        await page.evaluate((step) => {
          const p = step / 35;
          const camX = 15 + Math.cos(p * 1.5) * 3.0;
          const camZ = -5 + Math.sin(p * 1.5) * 3.0;
          window.__SET_CAMERA_OVERRIDE__([camX, 6.2 + Math.sin(p * 2) * 0.3, camZ], [11, -0.2, -11]);
        }, i);
      }
      await sleep(500);
    },
  },
  {
    id: 'proof-05-buggy-stunt-drive',
    title: 'Teardown Buggy Driving, Ramp Jump & Slalom Drift',
    durationMs: 5800,
    action: async (page) => {
      // Teleport right next to buggy driver seat
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__TELEPORT_PLAYER__([13.8, -0.86 + 0.5, -11.0]);
        window.__SET_LOOK_ANGLES__(0, 0);
      });
      await sleep(400);
      // Mount the buggy cockpit
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ secondary: true });
      });
      await sleep(200);
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ secondary: false });
      });
      await sleep(300);
      // Full throttle down 45m runway toward launch ramp
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ moveZ: 1, moveX: 0 });
      });
      await sleep(2200); // Accelerating down straightaway & hitting ramp at 14 m/s
      // Airborne flight over stunt gap, smashing through domino barrier
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.05 });
      });
      await sleep(1200); // Crashing crates
      // Responsive tire drift around hairpin curve
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ moveZ: 0.7, moveX: 0.8 });
      });
      await sleep(1200);
      // Firm braking stop with tire traction
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ moveZ: -0.2, moveX: 0 });
      });
      await sleep(300);
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
      });
      await sleep(500);
    },
  },
  {
    id: 'proof-06-structural-collapse',
    title: 'Kinetic Structural Collapse & Multi-Body Rubble Cascade',
    durationMs: 5200,
    action: async (page) => {
      // Teleport in front of the destructible tower base
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__TELEPORT_PLAYER__([-16, 0.2, 3.2]);
        window.__SET_LOOK_ANGLES__(0, -0.3);
      });
      await sleep(400);
      // Torch the foundational support column
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
      for (let i = 0; i < 18; i++) {
        await sleep(80);
        await page.evaluate((step) => {
          window.__SET_LOOK_ANGLES__(-0.12 + step * 0.014, -0.3 + Math.sin(step * 0.2) * 0.04);
        }, i);
      }
      await page.evaluate(() => {
        window.__SIMULATE_INPUT__({ pressed: false });
      });
      // Cinematic dolly pulling back as the tower buckles and cascades down
      for (let i = 0; i < 25; i++) {
        await sleep(100);
        await page.evaluate((step) => {
          const p = step / 25;
          window.__SET_CAMERA_OVERRIDE__(
            [-11 + p * 3, 4.5 + p * 1.5, 7 + p * 4],
            [-16, 2.0 - p * 1.2, 0],
          );
        }, i);
      }
      await sleep(600);
    },
  },
];

async function recordMechanic(mechanic) {
  console.log(`\n============================================================`);
  console.log(`RECORDING MECHANIC: ${mechanic.title} (${mechanic.id})`);
  console.log(`============================================================`);

  const runDir = path.join(tempDir, mechanic.id);
  fs.mkdirSync(runDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--force-device-scale-factor=1',
      '--window-size=1280,720',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: runDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4398', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function' && typeof window.__SIMULATE_INPUT__ === 'function');
  await sleep(1000); // Let world load & settle

  console.log(`Executing scripted actions for ${mechanic.id}...`);
  await mechanic.action(page);

  console.log(`Finalizing video capture for ${mechanic.id}...`);
  const videoObj = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const webmPath = await videoObj.path();
  const destMp4 = path.join(brainDir, `${mechanic.id}.mp4`);
  const destGif = path.join(brainDir, `${mechanic.id}.gif`);

  console.log(`Transcoding ${mechanic.id} to 60 FPS MP4 & looping GIF...`);
  // Transcode to clean MP4 without leading black/blank loading frames
  execSync(`"${ffmpegBin}" -y -ss 0.8 -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -r 60 -preset fast -crf 19 -movflags +faststart "${destMp4}"`);

  // Generate crisp looping GIF with smooth error-diffusion dithering
  execSync(`"${ffmpegBin}" -y -i "${destMp4}" -vf "fps=16,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=sierra2_4a" "${destGif}"`);

  // Mirror to public/showcase
  fs.copyFileSync(destMp4, path.join(publicShowcaseDir, `${mechanic.id}.mp4`));
  fs.copyFileSync(destGif, path.join(publicShowcaseDir, `${mechanic.id}.gif`));

  console.log(`SUCCESS: Saved ${destMp4} (${(fs.statSync(destMp4).size / (1024 * 1024)).toFixed(2)} MB) and ${destGif}`);
}

async function recordMasterShowcase() {
  console.log(`\n============================================================`);
  console.log(`RECORDING MASTER SHOWCASE: gameplay_recording.mp4`);
  console.log(`============================================================`);

  const runDir = path.join(tempDir, 'master');
  fs.mkdirSync(runDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--force-device-scale-factor=1',
      '--window-size=1280,720',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: runDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4398', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function' && typeof window.__SIMULATE_INPUT__ === 'function');
  await sleep(1000);

  // 1. Torch slice at gantry
  await page.evaluate(() => {
    window.__SET_CAMERA_OVERRIDE__(null, null);
    window.__TELEPORT_PLAYER__([2.18, 0.2, 1.8]);
    window.__SET_LOOK_ANGLES__(0, 0.02);
    window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
  });
  await sleep(1600);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
  await sleep(400);

  // 2. Teleport to ballast box & gravity gun lift
  await page.evaluate(() => {
    window.__TELEPORT_PLAYER__([0.62, 0.2, 3.8]);
    window.__SET_LOOK_ANGLES__(0, -0.16);
    window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
  });
  await sleep(1600);
  // Punt box
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ secondary: true });
  });
  await sleep(200);
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ secondary: false, pressed: false });
  });
  await sleep(600);

  // 3. Teleport to buggy driver seat & mount
  await page.evaluate(() => {
    window.__TELEPORT_PLAYER__([13.8, -0.86 + 0.5, -11.0]);
    window.__SET_LOOK_ANGLES__(0, 0);
  });
  await sleep(300);
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ secondary: true });
  });
  await sleep(200);
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ secondary: false });
  });
  await sleep(300);

  // 4. Full throttle down straightaway, ramp jump & drift
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ moveZ: 1, moveX: 0 });
  });
  await sleep(2400); // Soar airborne over gap & smash domino wall
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ moveZ: 0.8, moveX: 0.7 }); // Drift around hairpin curve
  });
  await sleep(1400);
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ moveZ: -0.2, moveX: 0 }); // Braking
  });
  await sleep(300);
  await page.evaluate(() => {
    window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
  });
  await sleep(500);

  const videoObj = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const webmPath = await videoObj.path();
  const destMp4 = path.join(brainDir, 'gameplay_recording.mp4');
  const destWebm = path.join(brainDir, 'gameplay_recording.webm');
  const destGif = path.join(brainDir, 'gameplay_loop_compact.gif');

  console.log('Transcoding master showcase MP4, WebM, and compact GIF...');
  execSync(`"${ffmpegBin}" -y -ss 0.8 -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -r 60 -preset fast -crf 18 -movflags +faststart "${destMp4}"`);
  execSync(`"${ffmpegBin}" -y -i "${destMp4}" -c:v libvpx -b:v 4M -crf 18 -pix_fmt yuv420p "${destWebm}"`);
  execSync(`"${ffmpegBin}" -y -ss 00:00:05.000 -t 5.5 -i "${destMp4}" -vf "fps=14,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=sierra2_4a" "${destGif}"`);

  fs.copyFileSync(destMp4, path.join(publicShowcaseDir, 'gameplay_recording.mp4'));
  fs.copyFileSync(destWebm, path.join(publicShowcaseDir, 'gameplay_recording.webm'));
  fs.copyFileSync(destGif, path.join(publicShowcaseDir, 'gameplay_loop_compact.gif'));

  console.log(`Master showcase completed: ${destMp4} (${(fs.statSync(destMp4).size / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  try {
    await waitForServer();
    console.log('Server verified live on :4398. Starting fast proofs recording suite...\n');

    for (const mechanic of MECHANICS) {
      await recordMechanic(mechanic);
    }

    await recordMasterShowcase();

    console.log('\n============================================================');
    console.log('ALL 6 MECHANICS PROOFS & MASTER SHOWCASE RECORDED SUCCESSFULLY!');
    console.log('============================================================');
  } finally {
    try { preview.kill(); } catch {}
    try { execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true'); } catch {}
  }
}

main().catch((err) => {
  console.error('Recording failure:', err);
  process.exit(1);
});
