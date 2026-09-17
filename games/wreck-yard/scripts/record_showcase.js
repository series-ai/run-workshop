async (page) => {
  console.log('--- STARTING COMPREHENSIVE ACTION SHOWCASE ---');

  // Helper functions
  const simInput = (action) => page.evaluate((a) => window.__SIMULATE_INPUT__?.(a), action);
  const setAim = (yaw, pitch) => page.evaluate(({ y, p }) => window.__SET_LOOK_ANGLES__?.(y, p), { y: yaw, p: pitch });

  // Focus canvas
  try {
    const canvas = page.locator('canvas');
    await canvas.click({ timeout: 4000 });
  } catch {}
  await page.waitForTimeout(600);

  // =========================================================================
  // SCENE INTRO: Full demolition yard panorama with yaw=0 facing negative Z
  // =========================================================================
  console.log('Scene Intro: Golden hour arena with Syncplay Heightfield terrain...');
  await setAim(0, -0.05);
  await page.waitForTimeout(1200);

  // =========================================================================
  // ACT 1: TORCHING & PHYSICAL SLICING DESTRUCTION
  // =========================================================================
  console.log('Act 1: Equipping Torch Gun & Slicing Destructible Gantry Pillar...');
  await simInput({ tool: 'torch' });
  await page.waitForTimeout(600);

  // Walk forward into the yard towards the gantry
  await setAim(-0.35, -0.02);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1400);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Aim directly at the support column
  await setAim(-0.45, 0.04);
  await page.waitForTimeout(400);

  // Engage cutting torch flame with white-hot sparks shower
  console.log('Engaging cutting torch flame with white-hot sparks shower...');
  await simInput({ pressed: true });
  for (let i = 0; i < 14; i++) {
    const yaw = -0.40 - i * 0.012;
    await setAim(yaw, 0.04);
    await page.waitForTimeout(150);
  }
  await simInput({ pressed: false });
  console.log('Column severed! Structural collapse initiated.');
  await page.waitForTimeout(1500);

  // =========================================================================
  // ACT 2: GRAVITY GUN & HIGH-IMPULSE PUNT
  // =========================================================================
  console.log('Act 2: Gravity Gun: Levitating Ballast Box & High-Speed Punt...');
  await simInput({ tool: 'hand' });
  await page.waitForTimeout(500);

  // Look down-left at the nearby ballast box
  await setAim(-0.15, -0.22);
  await page.waitForTimeout(600);

  // Lock tractor beam onto ballast box
  console.log('Locking tractor beam onto ballast box...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1400);

  // Turn aim toward bowling pins and seesaw
  console.log('Aiming at bowling alley pins and seesaw...');
  await setAim(0.55, 0.08);
  await page.waitForTimeout(1000);

  // SECONDARY FIRE: 30 m/s PUNT IMPULSE!
  console.log('FIRING SECONDARY PUNT IMPULSE (30 m/s)!');
  await simInput({ secondary: true });
  await page.waitForTimeout(120);
  await simInput({ pressed: false, secondary: false });
  console.log('Ballast box launched across arena smashing into targets!');
  await page.waitForTimeout(1600);

  // =========================================================================
  // ACT 3: NATIVE 3D FLUID DYNAMICS & SUNKEN WATER BASIN
  // =========================================================================
  console.log('Act 3: Jetpack flight to Sunken Water Basin (Fluid Dynamics)...');
  await setAim(-0.75, -0.05);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(1800);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(600);

  // Observe water surface, caustics, and floating buoyant crates
  console.log('Inspecting water basin with buoyant floating objects...');
  await setAim(-0.75, -0.32);
  await page.waitForTimeout(1200);

  // Levitate floating crate from water basin
  console.log('Levitating floating crate from water basin...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1000);

  // Lift high above water
  await setAim(-0.75, 0.18);
  await page.waitForTimeout(800);

  // Drop back into pool: splash & buoyancy bobbing
  console.log('Dropping crate back into pool: splash & buoyancy bobbing...');
  await simInput({ pressed: false });
  await setAim(-0.75, -0.25);
  await page.waitForTimeout(1500);

  // =========================================================================
  // ACT 4: RIDING VEHICLES (BUGGY COCKPIT & TERRAIN STUNT)
  // =========================================================================
  console.log('Act 4: Flying over to Buggy Vehicle on Dirt Berms...');
  await setAim(-2.4, -0.05);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(2000);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(600);

  // Approach buggy chassis
  await setAim(-2.35, -0.2);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(700);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Press Secondary to Mount Buggy Cockpit!
  console.log('Mounting Buggy Cockpit (Secondary Interact)...');
  await simInput({ secondary: true });
  await page.waitForTimeout(150);
  await simInput({ secondary: false });
  await page.waitForTimeout(1000);

  // Driving buggy across terrain!
  console.log('Driving Buggy: Accelerating across Syncplay Heightfield terrain...');
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1600);

  // Steer through the dirt berms
  console.log('Steering around off-road terrain berms...');
  await simInput({ moveX: -1, moveZ: 1 });
  await page.waitForTimeout(1000);
  await simInput({ moveX: 1, moveZ: 1 });
  await page.waitForTimeout(1200);

  // Full throttle toward stunt jump ramp!
  console.log('Full throttle toward stunt jump ramp!');
  await simInput({ moveX: 0, moveZ: 1 });
  await page.waitForTimeout(1600);

  // Eject from vehicle in mid-air with jetpack thrusters!
  console.log('Mid-air ejection with jetpack thrusters!');
  await simInput({ jetpack: true, moveZ: 0, moveX: 0 });
  await page.waitForTimeout(1200);
  await simInput({ jetpack: false });
  await page.waitForTimeout(1000);

  // =========================================================================
  // ACT 5: AERIAL SURVEY OF THE DEMOLITION PLAYGROUND
  // =========================================================================
  console.log('Act 5: High aerial survey of the entire demolition yard...');
  await setAim(0, -0.45);
  await simInput({ jetpack: true });
  await page.waitForTimeout(1600);
  await simInput({ jetpack: false });
  await page.waitForTimeout(1800);

  const stats = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    return c?.getRender()?.stats;
  });
  console.log('--- SHOWCASE COMPLETE --- Final Stats:', stats);
  return stats;
}
