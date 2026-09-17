async (page) => {
  console.log('--- STARTING COMPREHENSIVE ACTION SHOWCASE ---');

  // Focus canvas
  try {
    const canvas = page.locator('canvas');
    await canvas.click({ timeout: 5000 });
  } catch {}
  await page.waitForTimeout(500);

  // Helper for input
  const simInput = (action) => page.evaluate((a) => window.__SIMULATE_INPUT__?.(a), action);
  const setAim = (yaw, pitch) => page.evaluate(({ y, p }) => window.__SET_LOOK_ANGLES__?.(y, p), { y: yaw, p: pitch });

  // =========================================================================
  // SCENE INTRO: Arena Topography & First-Person Tool
  // =========================================================================
  console.log('Scene Intro: Golden hour arena with Syncplay Heightfield terrain...');
  await setAim(3.14, 0.05);
  await page.waitForTimeout(1000);

  // =========================================================================
  // ACTION 1: TORCHING & PHYSICAL SLICING DESTRUCTION
  // =========================================================================
  console.log('Action 1: Equipping Torch Gun & Slicing Destructible Tower Column...');
  await simInput({ tool: 'torch' });
  await page.waitForTimeout(600);

  // Walk forward to tower
  await setAim(3.14, -0.05);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1000);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Aim at the support pillar
  await setAim(3.14, 0.08);
  console.log('Engaging cutting torch flame with white-hot sparks shower...');
  await simInput({ pressed: true });
  // Sweep beam across pillar
  for (let i = 0; i < 12; i++) {
    const yaw = 3.14 + (i - 6) * 0.03;
    await setAim(yaw, 0.08);
    await page.waitForTimeout(200);
  }
  await simInput({ pressed: false });
  console.log('Pillar severed! Structural fracture initiated.');
  await page.waitForTimeout(1400);

  // =========================================================================
  // ACTION 2: SHOOTING THINGS ABOUT (GRAVITY GUN & HIGH-IMPULSE PUNT)
  // =========================================================================
  console.log('Action 2: Gravity Gun: Levitating Ballast Box & High-Speed Punt...');
  await simInput({ tool: 'hand' });
  await setAim(2.85, -0.12);
  await page.waitForTimeout(600);

  // Grab heavy ballast box
  console.log('Locking tractor beam onto ballast box...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1200);

  // Turn toward bowling pins and seesaw
  console.log('Aiming at bowling alley pins and seesaw...');
  await setAim(2.05, 0.08);
  await page.waitForTimeout(800);

  // SECONDARY FIRE: 30 m/s PUNT IMPULSE!
  console.log('FIRING SECONDARY PUNT IMPULSE (30 m/s)!');
  await simInput({ secondary: true });
  await page.waitForTimeout(100);
  await simInput({ pressed: false, secondary: false });
  console.log('Ballast box launched across arena smashing into targets!');
  await page.waitForTimeout(1600);

  // =========================================================================
  // ACTION 3: NATIVE 3D FLUID DYNAMICS & WATER BASIN
  // =========================================================================
  console.log('Action 3: Jetpack flight to Sunken Water Basin (Fluid Dynamics)...');
  await setAim(4.6, -0.12);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(1400);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(800);

  // Observe water surface, caustics, and floating buoyant crates
  console.log('Inspecting water basin with buoyant floating objects...');
  await setAim(4.6, -0.22);
  await page.waitForTimeout(1000);

  // Grab buoyant float crate from water
  console.log('Levitating floating crate from water basin...');
  await simInput({ pressed: true });
  await page.waitForTimeout(1000);
  // Lift above water
  await setAim(4.6, 0.15);
  await page.waitForTimeout(800);
  // Drop back into water to observe splash & buoyancy bobbing
  console.log('Dropping crate back into pool: splash & buoyancy bobbing...');
  await simInput({ pressed: false });
  await setAim(4.6, -0.2);
  await page.waitForTimeout(1500);

  // =========================================================================
  // ACTION 4: RIDING VEHICLES (BUGGY COCKPIT & TERRAIN STUNT)
  // =========================================================================
  console.log('Action 4: Flying over to Buggy Vehicle on Dirt Berms...');
  await setAim(0.9, -0.05);
  await simInput({ moveZ: 1, jetpack: true });
  await page.waitForTimeout(1600);
  await simInput({ jetpack: false });
  await page.waitForTimeout(600);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(600);

  // Approach buggy chassis
  await setAim(0.85, -0.15);
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(500);
  await simInput({ moveZ: 0 });
  await page.waitForTimeout(400);

  // Press Secondary (E / Right Click) to Mount Buggy!
  console.log('Mounting Buggy Cockpit (Secondary Interact)...');
  await simInput({ secondary: true });
  await page.waitForTimeout(150);
  await simInput({ secondary: false });
  await page.waitForTimeout(800);

  // Driving buggy across terrain!
  console.log('Driving Buggy: Accelerating across Syncplay Heightfield terrain...');
  await simInput({ moveZ: 1 });
  await page.waitForTimeout(1800);

  // Steer through the dirt berms
  console.log('Steering around off-road terrain berms...');
  await simInput({ moveX: -1, moveZ: 1 });
  await page.waitForTimeout(1000);
  await simInput({ moveX: 1, moveZ: 1 });
  await page.waitForTimeout(1200);

  // Line up with stunt jump ramp and launch!
  console.log('Full throttle toward stunt jump ramp!');
  await simInput({ moveX: 0, moveZ: 1 });
  await page.waitForTimeout(1600);

  // Eject from vehicle in mid-air with jetpack thrusters!
  console.log('Mid-air ejection with jetpack thrusters!');
  await simInput({ jetpack: true, moveZ: 0, moveX: 0 });
  await page.waitForTimeout(1000);
  await simInput({ jetpack: false });
  await page.waitForTimeout(1000);

  // =========================================================================
  // FINALE: AERIAL OVERVIEW OF THE PLAYGROUND
  // =========================================================================
  console.log('Finale: High aerial survey of the entire demolition yard...');
  await setAim(3.14, -0.45);
  await simInput({ jetpack: true });
  await page.waitForTimeout(1500);
  await simInput({ jetpack: false });
  await page.waitForTimeout(1500);

  const stats = await page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    return c?.getRender()?.stats;
  });
  console.log('--- SHOWCASE COMPLETE --- Final Stats:', stats);
  return stats;
}
