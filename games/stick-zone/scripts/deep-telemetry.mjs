import { chromium } from "playwright";
import fs from "fs";

async function run() {
  console.log("Launching Chromium with WebGL...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--no-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on("console", msg => {
    if (msg.type() === "error") {
      console.error("[Browser Error]", msg.text());
    }
  });

  console.log("Navigating to http://localhost:58392/ ...");
  await page.goto("http://localhost:58392/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Toggle F3 performance overlay
  await page.keyboard.press("F3");
  await page.waitForTimeout(500);

  // Phase 1: Baseline Idle Sampling (FOB)
  console.log("Sampling Phase 1: FOB Baseline Idle (2s)...");
  await page.waitForTimeout(2000);

  const phase1 = await page.evaluate(() => {
    const perf = window.__STICK_ZONE_PERF__;
    const sim = window.__STICK_ZONE_SIM__;
    return {
      telemetry: perf ? perf.getSnapshot() : null,
      memory: window.performance && window.performance.memory ? {
        totalJSHeapSizeMB: +(window.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
        usedJSHeapSizeMB: +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      } : null,
    };
  });
  console.log("Phase 1 Baseline:", JSON.stringify(phase1, null, 2));

  // Phase 2: Active Movement & Aiming (FOB)
  console.log("Sampling Phase 2: WASD Movement & Aiming (2s)...");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  for (let i = 0; i < 20; i++) {
    const x = 640 + Math.cos(i * 0.3) * 280;
    const y = 360 + Math.sin(i * 0.3) * 180;
    await page.mouse.move(x, y);
    await page.waitForTimeout(100);
  }
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");

  const phase2 = await page.evaluate(() => {
    const perf = window.__STICK_ZONE_PERF__;
    return perf ? perf.getSnapshot() : null;
  });
  console.log("Phase 2 Movement:", JSON.stringify(phase2, null, 2));

  // Phase 3: High-Cadence Shooting (Rifle + Shotgun)
  console.log("Sampling Phase 3: High-Cadence Shooting (2s)...");
  await page.mouse.move(640, 180);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();

  const phase3 = await page.evaluate(() => {
    const perf = window.__STICK_ZONE_PERF__;
    return perf ? perf.getSnapshot() : null;
  });
  console.log("Phase 3 Shooting:", JSON.stringify(phase3, null, 2));

  // Phase 4: Raid Deployment (Enemies, Crates, Occlusion)
  console.log("Sampling Phase 4: Raid Deployment...");
  await page.evaluate(() => {
    const sim = window.__STICK_ZONE_SIM__;
    if (sim && typeof sim.deployToRaid === "function") {
      sim.deployToRaid();
    }
  });
  await page.waitForTimeout(2500);

  // Move and shoot in Raid
  await page.keyboard.down("KeyW");
  await page.mouse.move(800, 300);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.keyboard.up("KeyW");

  const phase4 = await page.evaluate(() => {
    const perf = window.__STICK_ZONE_PERF__;
    const sim = window.__STICK_ZONE_SIM__;
    return {
      telemetry: perf ? perf.getSnapshot() : null,
      simState: sim ? {
        phase: sim.phase,
        enemies: sim.enemies ? sim.enemies.length : 0,
        crates: sim.crates ? sim.crates.length : 0,
        projectiles: sim.projectiles ? sim.projectiles.length : 0,
        particles: sim.particles ? sim.particles.length : 0,
      } : null
    };
  });
  console.log("Phase 4 Raid:", JSON.stringify(phase4, null, 2));

  // Phase 5: Deep Inspection of WebGL / Three.js Scene Graph
  const sceneDeepAudit = await page.evaluate(() => {
    const results = {
      totalMeshCount: 0,
      meshDetails: [],
      materialsByType: {},
      geometriesByType: {},
      shadowCasters: 0,
      shadowReceivers: 0,
      lightCount: 0,
    };

    // Find the Three.js canvas
    const canvas = document.querySelector("canvas");
    if (!canvas) return { error: "No canvas found" };

    // Traverse React fiber or inspect Three.js scene through root fiber
    const key = Object.keys(canvas).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    let scene = null;
    if (key) {
      let fiber = canvas[key];
      while (fiber) {
        if (fiber.stateNode && fiber.stateNode.__r3f) {
          scene = fiber.stateNode.__r3f.root?.store?.getState()?.scene;
          if (scene) break;
        }
        fiber = fiber.return;
      }
    }

    if (!scene) {
      // Fallback: look in window or document
      return { note: "Scene accessed via renderer telemetry", canvasRect: canvas.getBoundingClientRect() };
    }

    scene.traverse((obj) => {
      if (obj.isMesh) {
        results.totalMeshCount++;
        if (obj.castShadow) results.shadowCasters++;
        if (obj.receiveShadow) results.shadowReceivers++;

        const matType = obj.material ? (Array.isArray(obj.material) ? "MultiMaterial" : obj.material.type) : "None";
        results.materialsByType[matType] = (results.materialsByType[matType] || 0) + 1;

        const geoType = obj.geometry ? obj.geometry.type : "None";
        results.geometriesByType[geoType] = (results.geometriesByType[geoType] || 0) + 1;

        // Sample names or tags
        results.meshDetails.push({
          name: obj.name || (obj.parent ? obj.parent.name : "") || "unnamed",
          matType,
          geoType,
          castShadow: !!obj.castShadow,
          receiveShadow: !!obj.receiveShadow
        });
      } else if (obj.isLight) {
        results.lightCount++;
      }
    });

    return results;
  });

  console.log("Three.js Deep Audit Summary:", {
    totalMeshCount: sceneDeepAudit.totalMeshCount,
    shadowCasters: sceneDeepAudit.shadowCasters,
    shadowReceivers: sceneDeepAudit.shadowReceivers,
    lightCount: sceneDeepAudit.lightCount,
    materialsByType: sceneDeepAudit.materialsByType,
    geometriesByType: sceneDeepAudit.geometriesByType,
  });

  const fullReport = {
    timestamp: new Date().toISOString(),
    phases: { phase1, phase2, phase3, phase4 },
    sceneDeepAudit,
  };

  fs.writeFileSync("/Users/pany/.gemini/antigravity-acp/brain/c85c855d-70ef-45e1-a292-72eeba99b77c/deep_telemetry_report.json", JSON.stringify(fullReport, null, 2));
  console.log("Wrote /Users/pany/.gemini/antigravity-acp/brain/c85c855d-70ef-45e1-a292-72eeba99b77c/deep_telemetry_report.json");

  await page.screenshot({ path: "/Users/pany/.gemini/antigravity-acp/brain/c85c855d-70ef-45e1-a292-72eeba99b77c/deep_telemetry_screenshot.png" });
  console.log("Saved screenshot.");

  await browser.close();
  console.log("Telemetry gathering finished successfully.");
}

run().catch(err => {
  console.error("Telemetry script failed:", err);
  process.exit(1);
});
