import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const tempDir = '/tmp/wreck_yard_playthroughs';
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const ffprobeBin = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';

async function waitForServer(url = 'http://127.0.0.1:4398') {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server not responding at ' + url);
}

async function recordScenario({ id, title, outputName, execute }) {
  console.log(`\n========================================`);
  console.log(`RECORDING: ${title} (${outputName})`);
  console.log(`========================================`);

  const runDir = path.join(tempDir, id);
  fs.mkdirSync(runDir, { recursive: true });

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
    recordVideo: {
      dir: runDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4398', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1200);

  console.log(`Executing actions for ${title}...`);
  await execute(page);

  await page.waitForTimeout(500);

  console.log(`Finalizing video capture...`);
  const videoObj = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const webmPath = await videoObj.path();
  console.log(`WebM capture ready: ${webmPath} (${(fs.statSync(webmPath).size / 1024).toFixed(1)} KB)`);

  const outMp4 = path.join(brainDir, outputName);
  execSync(`"${ffmpegBin}" -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -r 24 -preset fast -crf 20 "${outMp4}"`);

  const probe = execSync(`"${ffprobeBin}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration,nb_read_packets -count_packets -of default=noprint_wrappers=1 "${outMp4}"`).toString().trim();
  console.log(`Verified ${outputName}:\n${probe}`);
  return outMp4;
}

async function main() {
  await waitForServer();
  console.log('Server verified live on :4398. Beginning 24 FPS captures...\n');

  // 1. Torch Slicing Playthrough
  const torchMp4 = await recordScenario({
    id: 'torch',
    title: 'Plasma Torch Beam Slicing',
    outputName: 'playthrough_torch_slicing.mp4',
    execute: async (page) => {
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
          win.__SET_LOOK_ANGLES__(0.05, -0.2);
        }
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ tool: 'torch', pressed: true });
        }
      });
      await page.waitForTimeout(4000);
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ pressed: false });
        }
      });
    },
  });

  // 2. Gravity Gun Levitation & Punt Playthrough
  const gravityMp4 = await recordScenario({
    id: 'gravity',
    title: 'Gravity Gun Levitation & Punt',
    outputName: 'playthrough_gravity_gun.mp4',
    execute: async (page) => {
      // Look at container and levitate
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
          win.__SET_LOOK_ANGLES__(-0.35, -0.12);
        }
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
        }
      });
      await page.waitForTimeout(3000);
      // Secondary punt
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ secondary: true });
        }
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ pressed: false, secondary: false });
        }
      });
      await page.waitForTimeout(1500);
    },
  });

  // 3. Cockpit Buggy High-Speed Drive Playthrough
  const buggyMp4 = await recordScenario({
    id: 'buggy',
    title: 'Cockpit Buggy High-Speed Driving',
    outputName: 'playthrough_buggy_drive.mp4',
    execute: async (page) => {
      // Direct jump into buggy cockpit
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ pressed: false, jetpack: true, moveZ: 1 });
        }
        if (typeof win.__SET_LOOK_ANGLES__ === 'function') {
          win.__SET_LOOK_ANGLES__(-1.4, -0.2);
        }
      });
      await page.waitForTimeout(1900);
      // Mount buggy
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
      await page.waitForTimeout(500);
      // Drive buggy forward with turning arc
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ moveZ: 1, moveX: -0.3 });
        }
      });
      await page.waitForTimeout(4000);
      // Stop buggy
      await page.evaluate(() => {
        const win = window;
        if (typeof win.__SIMULATE_INPUT__ === 'function') {
          win.__SIMULATE_INPUT__({ moveZ: 0, moveX: 0 });
        }
      });
    },
  });

  // 4. Concatenate into Master gameplay_recording.mp4
  console.log(`\n========================================`);
  console.log(`CONCATENATING MASTER: gameplay_recording.mp4`);
  console.log(`========================================`);

  const concatList = path.join(tempDir, 'concat_list.txt');
  fs.writeFileSync(concatList, `file '${torchMp4}'\nfile '${gravityMp4}'\nfile '${buggyMp4}'\n`);

  const masterMp4 = path.join(brainDir, 'gameplay_recording.mp4');
  execSync(`"${ffmpegBin}" -y -f concat -safe 0 -i "${concatList}" -c copy "${masterMp4}"`);
  console.log(`Master MP4 generated: ${masterMp4} (${(fs.statSync(masterMp4).size / 1024).toFixed(1)} KB)`);

  const masterProbe = execSync(`"${ffprobeBin}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration,nb_read_packets -count_packets -of default=noprint_wrappers=1 "${masterMp4}"`).toString().trim();
  console.log(`Master Video Verified:\n${masterProbe}`);

  // 5. Generate Compact GIF (< 1.0 MB)
  console.log(`\n========================================`);
  console.log(`GENERATING COMPACT GIF: gameplay_loop_compact.gif`);
  console.log(`========================================`);

  const compactGif = path.join(brainDir, 'gameplay_loop_compact.gif');
  execSync(`"${ffmpegBin}" -y -ss 00:00:01 -t 5 -i "${torchMp4}" -vf "fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=32[p];[s1][p]paletteuse=dither=bayer" "${compactGif}"`);
  console.log(`Compact GIF generated: ${compactGif} (${(fs.statSync(compactGif).size / 1024).toFixed(1)} KB)`);

  console.log('\n>>> ALL PLAYTHROUGH RECORDINGS & MASTER ASSETS GENERATED SUCCESSFULLY! <<<');
}

main().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
