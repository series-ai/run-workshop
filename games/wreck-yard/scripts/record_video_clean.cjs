const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('--- STARTING CLEAN 60FPS AAA GAMEPLAY RECORDING ---');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-webgl2',
    ]
  });

  const videoDir = '/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/';
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    }
  });

  const page = await context.newPage();
  console.log('Navigating to http://localhost:4318/ ...');
  await page.goto('http://localhost:4318/');
  await page.waitForTimeout(2000);

  // Focus canvas
  const canvas = page.locator('canvas');
  await canvas.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);

  const simInput = (action) => page.evaluate((a) => window.__SIMULATE_INPUT__?.(a), action);
  const setAim = (yaw, pitch) => page.evaluate(({ y, p }) => window.__SET_LOOK_ANGLES__?.(y, p), { y: yaw, p: pitch });

  // 1. INTRO: High-fidelity Gravity Gun with animated magnetic rings & CRT display
  console.log('1. Displaying AAA Gravity Gun with spinning magnetic rings...');
  await setAim(0, -0.05);
  await page.waitForTimeout(1600);

  // 2. TORCH GUN: Equip Oxy-Acetylene Demolition Torch with brass gauges
  console.log('2. Switching to AAA Oxy-Acetylene Cutting Torch...');
  await simInput({ tool: 'torch' });
  await page.waitForTimeout(1200);

  // Walk forward to destructible column
  console.log('Advancing toward structural column...');
  await setAim(-0.35, -0.02);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1400);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Aim and ignite cutting flame with sparks shower
  console.log('Igniting supersonic cutting flame and slicing structural column...');
  await setAim(-0.45, 0.04);
  await simInput({ pressed: true });
  for (let i = 0; i < 12; i++) {
    const yaw = -0.40 - i * 0.012;
    await setAim(yaw, 0.04);
    await page.waitForTimeout(150);
  }
  await simInput({ pressed: false });
  console.log('Column cut! Physics fracture triggered.');
  await page.waitForTimeout(1500);

  // 3. GRAVITY GUN: Levitating Ballast Box and High-Speed Punt
  console.log('3. Equipping AAA Gravity Gun & Levitating Ballast Box...');
  await simInput({ tool: 'hand' });
  await page.waitForTimeout(500);

  // Look down at ballast box
  await setAim(-0.15, -0.22);
  await page.waitForTimeout(600);

  // Engage magnetic tractor beam
  console.log('Engaging magnetic tractor beam...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1400);

  // Aim across yard at bowling alley pins
  console.log('Aiming across yard at bowling pins...');
  await setAim(0.55, 0.08);
  await page.waitForTimeout(1000);

  // SECONDARY FIRE: 30 m/s PUNT!
  console.log('FIRING 30 m/s PUNT IMPULSE!');
  await simInput({ secondary: true });
  await page.waitForTimeout(120);
  await simInput({ pressed: false, secondary: false });
  console.log('Ballast box launched across arena smashing into targets!');
  await page.waitForTimeout(1800);

  // 4. WATER BASIN: Jetpack flight to sunken water basin
  console.log('4. Jetpack flight to sunken water quarry (fluid dynamics)...');
  await setAim(-0.75, -0.05);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(1800);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(600);

  // Inspect floating crates
  await setAim(-0.75, -0.32);
  await page.waitForTimeout(1200);

  // Levitate crate from water
  console.log('Levitating floating crate from water...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1000);
  await setAim(-0.75, 0.18);
  await page.waitForTimeout(800);
  await simInput({ pressed: false });
  await setAim(-0.75, -0.25);
  await page.waitForTimeout(1500);

  // 5. BUGGY VEHICLE: Flying over to Buggy and Driving
  console.log('5. Flying to Buggy Vehicle on off-road berms...');
  await setAim(-2.4, -0.05);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(2000);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(600);

  // Approach buggy
  await setAim(-2.35, -0.2);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(700);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Mount cockpit!
  console.log('Mounting Buggy Cockpit (Secondary Interact)...');
  await simInput({ secondary: true });
  await page.waitForTimeout(150);
  await simInput({ secondary: false });
  await page.waitForTimeout(1000);

  // Drive across heightfield terrain
  console.log('Driving Buggy: Accelerating across Syncplay Heightfield terrain...');
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1600);

  // Steer through berms
  console.log('Steering around off-road terrain berms...');
  await simInput({ moveX: -1, moveZ: 1 });
  await page.waitForTimeout(1000);
  await simInput({ moveX: 1, moveZ: 1 });
  await page.waitForTimeout(1200);

  // Full throttle toward ramp!
  console.log('Full throttle toward stunt jump ramp!');
  await simInput({ moveX: 0, moveZ: 1 });
  await page.waitForTimeout(1600);

  // Eject from buggy in mid-air with jetpack
  console.log('Mid-air ejection with jetpack thrusters!');
  await simInput({ jetpack: true, moveZ: 0, moveX: 0 });
  await page.waitForTimeout(1200);
  await simInput({ jetpack: false });
  await page.waitForTimeout(1000);

  // 6. FINALE: High aerial survey
  console.log('6. High aerial survey of the demolition playground...');
  await setAim(0, -0.45);
  await simInput({ jetpack: true });
  await page.waitForTimeout(1800);
  await simInput({ jetpack: false });
  await page.waitForTimeout(2000);

  const stats = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    return c?.getRender()?.stats;
  });
  console.log('--- SHOWCASE COMPLETE --- Final Stats:', stats);

  console.log('Closing page to finalize video recording...');
  await page.close();
  const video = page.video();
  if (video) {
    const rawPath = await video.path();
    console.log('Raw video saved to:', rawPath);
    const destPath = '/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/wreck_yard_classic_gameplay.webm';
    fs.copyFileSync(rawPath, destPath);
    fs.copyFileSync(rawPath, '/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/gameplay.webm');
    console.log('Copied video to:', destPath);

    const { execSync } = require('child_process');
    const ffmpegBin = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
    try {
      execSync(`"${ffmpegBin}" -y -ss 00:00:01.2 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_gravity_gun.png"`);
      execSync(`"${ffmpegBin}" -y -ss 00:00:03.2 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_torch_gun.png"`);
      execSync(`"${ffmpegBin}" -y -ss 00:00:06.0 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_molten_slicing.png"`);
      execSync(`"${ffmpegBin}" -y -ss 00:00:10.5 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_levitation.png"`);
      execSync(`"${ffmpegBin}" -y -ss 00:00:17.5 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_water_basin.png"`);
      execSync(`"${ffmpegBin}" -y -ss 00:00:26.5 -i "${destPath}" -vframes 1 "/Users/pany/.gemini/antigravity-acp/brain/a420a389-15e4-420c-a27d-16bff6289c0b/classic_buggy_drive.png"`);
      console.log('Successfully extracted 6 high-res classic gameplay frames!');
    } catch (e) {
      console.error('Frame extraction error:', e);
    }
  }

  await browser.close();
  console.log('ALL DONE!');
})();
