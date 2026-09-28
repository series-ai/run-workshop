import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const publicShowcaseDir = path.resolve('public/showcase');

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

const MECHANIC_DEFINITIONS = [
  {
    id: 'proof-01-plasma-torch',
    title: 'Plasma Torch Voxel Slicing',
    totalFrames: 180, // 3.0s @ 60 FPS
    setup: async (page) => {
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__SET_LOOK_ANGLES__(0.05, -0.22);
        window.__SIMULATE_INPUT__({ tool: 'torch', pressed: false, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        if (frame === 10) {
          window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
        } else if (frame > 10 && frame < 120) {
          // Continuous smooth slice across gantry beam
          const progress = (frame - 10) / 110;
          window.__SET_LOOK_ANGLES__(0.05 + progress * 0.12, -0.22 + Math.sin(progress * Math.PI) * 0.08);
        } else if (frame === 120) {
          // Finish cut - severed body drops with gravity and sparks fade
          window.__SIMULATE_INPUT__({ pressed: false });
        }
      }, f);
    },
  },
  {
    id: 'proof-02-gravity-gun',
    title: 'Gravity Gun Kinetic Levitation & Tractor Beam',
    totalFrames: 210, // 3.5s @ 60 FPS
    setup: async (page) => {
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__SET_LOOK_ANGLES__(-0.35, -0.15);
        window.__SIMULATE_INPUT__({ tool: 'hand', pressed: false, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        if (frame === 10) {
          // Latch tractor beam onto heavy container
          window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
        } else if (frame > 10 && frame < 130) {
          // Levitating and waving container in 3D arc
          const progress = (frame - 10) / 120;
          window.__SET_LOOK_ANGLES__(-0.35 + Math.sin(progress * Math.PI * 2) * 0.18, -0.15 + Math.cos(progress * Math.PI) * 0.12);
        } else if (frame === 130) {
          // High-velocity kinetic throw across the quarry
          window.__SET_LOOK_ANGLES__(-0.15, -0.05);
          window.__SIMULATE_INPUT__({ pressed: false });
        }
      }, f);
    },
  },
  {
    id: 'proof-03-jetpack-flight',
    title: 'Jetpack Aerial 3D Flight & Basin Vaulting',
    totalFrames: 210, // 3.5s @ 60 FPS
    setup: async (page) => {
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__SET_LOOK_ANGLES__(-1.35, -0.18);
        window.__SIMULATE_INPUT__({ tool: 'orbit', pressed: false, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        if (frame === 10) {
          // Engage vertical thrusters and move forward
          window.__SIMULATE_INPUT__({ jetpack: true, moveZ: 1 });
        } else if (frame > 10 && frame < 150) {
          // Soar high above water basin and structures
          const progress = (frame - 10) / 140;
          window.__SET_LOOK_ANGLES__(-1.35 + progress * 0.45, -0.18 + Math.sin(progress * Math.PI) * 0.1);
        } else if (frame === 150) {
          // Cut thrusters and touchdown smoothly
          window.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 });
        }
      }, f);
    },
  },
  {
    id: 'proof-04-water-buoyancy',
    title: 'Hydrodynamic Fluid Buoyancy & Floating Debris',
    totalFrames: 200, // 3.33s @ 60 FPS
    setup: async (page) => {
      await page.evaluate(() => {
        // Dramatic elevated camera looking right down into the water basin
        window.__SET_CAMERA_OVERRIDE__([15, 6.5, -5], [11, 0, -11]);
        window.__SIMULATE_INPUT__({ pressed: false, moveX: 0, moveZ: 0, jetpack: false, secondary: false });
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        // Subtle cinematic orbit around the water basin showing bobbing buoyant objects & ripples
        const progress = frame / 200;
        const camX = 15 + Math.cos(progress * 1.5) * 2.5;
        const camZ = -5 + Math.sin(progress * 1.5) * 2.5;
        window.__SET_CAMERA_OVERRIDE__([camX, 6.2 + Math.sin(progress * 2) * 0.4, camZ], [11, -0.2, -11]);
      }, f);
    },
  },
  {
    id: 'proof-05-buggy-stunt-drive',
    title: 'Teardown Buggy Driving, Ramp Jump & Slalom Drift',
    totalFrames: 270, // 4.5s @ 60 FPS
    setup: async (page) => {
      await page.goto('http://127.0.0.1:4398?record=1', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function');
      await page.evaluate(() => {
        window.__SET_CAMERA_OVERRIDE__(null, null);
        window.__SET_LOOK_ANGLES__(0, 0);
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        if (frame === 5) {
          window.__SIMULATE_INPUT__({ secondary: true }); // Mount cockpit
        } else if (frame === 15) {
          // Full throttle down 45m runway toward stunt launch ramp
          window.__SIMULATE_INPUT__({ secondary: false, moveZ: 1, moveX: 0 });
        } else if (frame === 130) {
          // Ramp jump launch - soaring through air over gap
          window.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.15 });
        } else if (frame === 175) {
          // Impact through domino barrier & hard power slide
          window.__SIMULATE_INPUT__({ moveZ: 0.8, moveX: 0.7 });
        } else if (frame === 245) {
          window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
        }
      }, f);
    },
  },
  {
    id: 'proof-06-structural-collapse',
    title: 'Kinetic Structural Collapse & Domino Demolition',
    totalFrames: 210, // 3.5s @ 60 FPS
    setup: async (page) => {
      await page.evaluate(() => {
        // Dramatic vantage point looking at the structural domino wall and container stacks
        window.__SET_CAMERA_OVERRIDE__([-2, 5.0, 16], [-3.5, 1.2, -2]);
      });
    },
    tick: async (page, f) => {
      await page.evaluate((frame) => {
        // Slow cinematic dolly while structural collapse and debris tumble
        const p = frame / 210;
        window.__SET_CAMERA_OVERRIDE__([-2 - p * 3, 5.0 + Math.sin(p * 2) * 0.3, 16 - p * 4], [-3.5, 1.0, -2]);
      }, f);
    },
  },
];

async function recordMechanicProof(browser, mechanic) {
  console.log(`\n============================================================`);
  console.log(`RECORDING: ${mechanic.title} (${mechanic.id})`);
  console.log(`============================================================`);

  const destMp4 = path.join(brainDir, `${mechanic.id}.mp4`);
  const destGif = path.join(brainDir, `${mechanic.id}.gif`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.bringToFront();

  console.log(`Spawning ffmpeg for ${mechanic.id} (60.0 FPS)...`);
  const ffmpeg = spawn(ffmpegBin, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '60',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '18',
    '-b:v', '5M',
    '-maxrate', '8M',
    '-bufsize', '10M',
    '-movflags', '+faststart',
    destMp4,
  ], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  let captured = 0;
  await page.exposeFunction('onFramePipe', (base64Chunk) => {
    const buf = Buffer.from(base64Chunk, 'base64');
    ffmpeg.stdin.write(buf);
    captured++;
    if (captured % 30 === 0) {
      process.stdout.write(`\r[${mechanic.id}] Frame ${captured}/${mechanic.totalFrames} (${(captured / 60).toFixed(1)}s)...`);
    }
  });

  await page.goto('http://127.0.0.1:4398?record=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function' && typeof window.__SIMULATE_INPUT__ === 'function');

  // Let initial scene settle
  await sleep(600);

  if (mechanic.setup) {
    await mechanic.setup(page);
  }

  // Record loop
  for (let f = 0; f < mechanic.totalFrames; f++) {
    await mechanic.tick(page, f);
    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('No canvas');
      await new Promise((r) => requestAnimationFrame(r));
      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      await window.onFramePipe(dataUrl.slice(23));
    });
  }

  console.log(`\nFinalizing ${mechanic.id}...`);
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));

  await page.close();
  await context.close();

  // Generate crisp looping GIF
  console.log(`Generating GIF for ${mechanic.id}...`);
  execSync(`"${ffmpegBin}" -y -i "${destMp4}" -vf "fps=14,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${destGif}"`);

  // Mirror to public/showcase
  fs.copyFileSync(destMp4, path.join(publicShowcaseDir, `${mechanic.id}.mp4`));
  fs.copyFileSync(destGif, path.join(publicShowcaseDir, `${mechanic.id}.gif`));
  console.log(`Saved ${destMp4} (${(fs.statSync(destMp4).size / (1024 * 1024)).toFixed(2)} MB) and ${destGif}`);
}

async function recordMasterShowcase(browser) {
  console.log(`\n============================================================`);
  console.log(`RECORDING MASTER 60 FPS SHOWCASE: gameplay_recording.mp4`);
  console.log(`============================================================`);

  const destMp4 = path.join(brainDir, 'gameplay_recording.mp4');
  const destWebm = path.join(brainDir, 'gameplay_recording.webm');
  const destGif = path.join(brainDir, 'gameplay_loop_compact.gif');

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.bringToFront();

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
      process.stdout.write(`\r[Master Showcase] Captured ${frameCount}/540 frames (${(frameCount / 60).toFixed(1)}s)...`);
    }
  });

  await page.goto('http://127.0.0.1:4398?record=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => typeof window.__SET_LOOK_ANGLES__ === 'function' && typeof window.__SIMULATE_INPUT__ === 'function');
  await sleep(600);

  const TOTAL_FRAMES = 540; // 9.0s @ 60 FPS
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    if (f === 0) {
      await page.evaluate(() => {
        window.__SET_LOOK_ANGLES__(0.05, -0.2);
        window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
      });
    } else if (f === 70) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
    } else if (f === 85) {
      await page.evaluate(() => {
        window.__SET_LOOK_ANGLES__(-0.35, -0.15);
        window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
      });
    } else if (f === 170) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
    } else if (f === 185) {
      await page.evaluate(() => {
        window.__SET_LOOK_ANGLES__(-1.35, -0.18);
        window.__SIMULATE_INPUT__({ jetpack: true, moveZ: 1 });
      });
    } else if (f === 275) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ jetpack: false, moveZ: 0 }));
    } else if (f === 295) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: true }));
    } else if (f === 310) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: false, moveZ: 1, moveX: 0 }));
    } else if (f === 430) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.2 }));
    } else if (f === 480) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ moveZ: 0.75, moveX: 0.65 }));
    } else if (f === 535) {
      await page.evaluate(() => window.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 }));
    }

    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');
      await new Promise((r) => requestAnimationFrame(r));
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      await window.onFramePipe(dataUrl.slice(23));
    });
  }

  console.log(`\nFinalizing master MP4...`);
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));

  await page.close();
  await context.close();

  console.log('Transcoding master WebM...');
  execSync(`"${ffmpegBin}" -y -i "${destMp4}" -c:v libvpx -b:v 4M -crf 18 -pix_fmt yuv420p "${destWebm}"`);

  console.log('Generating master loop GIF...');
  execSync(`"${ffmpegBin}" -y -ss 00:00:04.500 -t 5.0 -i "${destMp4}" -vf "fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${destGif}"`);

  fs.copyFileSync(destMp4, path.join(publicShowcaseDir, 'gameplay_recording.mp4'));
  fs.copyFileSync(destWebm, path.join(publicShowcaseDir, 'gameplay_recording.webm'));
  fs.copyFileSync(destGif, path.join(publicShowcaseDir, 'gameplay_loop_compact.gif'));
  console.log('Master showcase assets recorded and mirrored successfully.');
}

async function run() {
  try {
    await waitForServer();
    console.log('Preview server ready! Launching Chrome with Metal GPU...');
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
        '--disable-timer-throttling',
        '--force-device-scale-factor=1',
        '--window-size=1280,768',
      ],
    });

    // Record each mechanic proof individually
    for (const mechanic of MECHANIC_DEFINITIONS) {
      await recordMechanicProof(browser, mechanic);
    }

    // Record the master showcase
    await recordMasterShowcase(browser);

    await browser.close();
    console.log('\n============================================================');
    console.log('ALL 6 MECHANICS PROOFS & MASTER SHOWCASE RECORDED SUCCESSFULLY!');
    console.log('============================================================');
  } finally {
    try { preview.kill(); } catch {}
    try { execSync('lsof -ti :4398 | xargs kill -9 2>/dev/null || true'); } catch {}
  }
}

run().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
