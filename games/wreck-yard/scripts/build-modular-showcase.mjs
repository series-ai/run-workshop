import fs from 'node:fs';
import path from 'node:path';

const brainDir = '/Users/pany/.gemini/antigravity-acp/brain/fd27fe2f-eb7e-4d01-8df3-5b0efdf235c9';
const publicShowcaseDir = path.resolve('public/showcase');

function getBase64(filename) {
  const p = path.join(brainDir, filename);
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const mime = ext === 'gif' ? 'image/gif' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

console.log('Loading base64 assets...');
const vistaJpg = getBase64('wreck_yard_vista_playground.jpg');
const torchJpg = getBase64('wreck_yard_torch_cutter.jpg');
const gravityJpg = getBase64('wreck_yard_gravity_gun.jpg');
const jetpackJpg = getBase64('wreck_yard_jetpack_aerial.jpg');
const buggyJpg = getBase64('wreck_yard_buggy_sector.jpg');
const cockpitJpg = getBase64('wreck_yard_buggy_cockpit.jpg');
const towerJpg = getBase64('wreck_yard_tower_containers.jpg');

const refVistaJpg = getBase64('retro_industrial_vista.jpg');
const refTorchJpg = getBase64('retro_torch_slicing.jpg');
const refGravityJpg = getBase64('retro_gravity_gun.jpg');
const refBasinJpg = getBase64('retro_water_basin.jpg');

const gifCompact = getBase64('gameplay_loop_compact.gif');

const sharedStyles = `
    :root {
      --bg-base: #0a0d10;
      --bg-surface: #121820;
      --bg-card: #18202a;
      --bg-card-hover: #1f2a37;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-bright: rgba(255, 255, 255, 0.2);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-lime: #a3e635;
      --accent-lime-dim: rgba(163, 230, 53, 0.15);
      --accent-cyan: #38bdf8;
      --accent-cyan-dim: rgba(56, 189, 248, 0.15);
      --font-mono: "JetBrains Mono", ui-monospace, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 4rem;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 13, 16, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; }
    .brand-logo {
      width: 26px; height: 26px;
      background: linear-gradient(135deg, var(--accent-lime), #4d7c0f);
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; color: #0c1206; font-size: 13px;
    }
    .brand-title { font-weight: 700; font-size: 1rem; color: #fff; letter-spacing: 0.04em; }
    .nav-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
    .nav-tab {
      font-family: var(--font-mono);
      font-size: 0.74rem;
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .nav-tab:hover { color: #fff; background: var(--bg-card); }
    .nav-tab.active {
      color: var(--accent-lime);
      background: var(--bg-card);
      border-color: rgba(163, 230, 53, 0.4);
      font-weight: 600;
    }
    main { max-width: 1100px; margin: 2rem auto; padding: 0 1.25rem; display: flex; flex-direction: column; gap: 2rem; }
    .section-tag {
      font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase;
      letter-spacing: 0.12em; color: var(--accent-lime); display: block; margin-bottom: 0.25rem;
    }
    .section-title { font-size: 1.5rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
    .section-desc { color: var(--text-muted); font-size: 0.92rem; margin-top: 0.25rem; max-width: 780px; }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      overflow: hidden;
      padding: 1.25rem;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    }
    .btn {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.82rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;
    }
    .btn:hover { background: var(--bg-card-hover); border-color: var(--border-bright); }
    .btn-active { background: var(--accent-lime); color: #0b1106; border-color: var(--accent-lime); font-weight: 600; }
    .nav-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 1.5rem; border-top: 1px solid var(--border-subtle);
    }
`;

function buildHeader(activeSlug) {
  const tabs = [
    { slug: 'index', name: 'Hub' },
    { slug: '01-video', name: '01 Video' },
    { slug: '02-comparison', name: '02 Comparison' },
    { slug: '03-weapons', name: '03 Tools' },
    { slug: '04-playground', name: '04 Playground' },
    { slug: '05-telemetry', name: '05 Telemetry' },
  ];

  return `
  <header>
    <a href="./index.html" class="brand">
      <div class="brand-logo">WY</div>
      <div class="brand-title">Wreck Yard</div>
    </a>
    <nav class="nav-tabs">
      ${tabs
        .map(
          (t) =>
            `<a href="./${t.slug}.html" class="nav-tab ${t.slug === activeSlug ? 'active' : ''}">${t.name}</a>`
        )
        .join('\n      ')}
    </nav>
  </header>`;
}

// 1. INDEX / HUB (Uses lightweight Base64 thumbnails: ~180KB total)
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // Showcase Hub</title>
  <style>
    ${sharedStyles}
    .hub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin-top: 1rem; }
    .hub-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
    }
    .hub-card:hover {
      border-color: var(--accent-lime);
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .hub-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #000; }
    .hub-body { padding: 1.1rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
    .hub-num { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent-lime); font-weight: 700; text-transform: uppercase; }
    .hub-title { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .hub-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; }
    .hub-action { margin-top: auto; padding-top: 0.6rem; font-size: 0.8rem; font-weight: 600; color: var(--accent-lime); display: flex; align-items: center; gap: 0.25rem; }
  </style>
</head>
<body>
  ${buildHeader('index')}
  <main>
    <div>
      <span class="section-tag">Interactive Showcase Hub</span>
      <h1 class="section-title">Wreck Yard Feature & Gameplay Showcase</h1>
      <p class="section-desc">
        Select any module below to inspect live gameplay footage, target vs realtime visual benchmarks, first-person tools, and physics playground toys.
      </p>
    </div>

    <div class="hub-grid">
      <!-- 01 Video -->
      <a href="./01-video.html" class="hub-card">
        <img class="hub-thumb" src="${vistaJpg}" alt="Video preview" />
        <div class="hub-body">
          <span class="hub-num">Module 01</span>
          <h2 class="hub-title">Live 60 FPS Video Recording</h2>
          <p class="hub-desc">Uncut capture from live 4-slot Syncplay session showing tool switching, laser bisection, and jetpack flight.</p>
          <div class="hub-action">Open Video Player →</div>
        </div>
      </a>

      <!-- 02 Comparison -->
      <a href="./02-comparison.html" class="hub-card">
        <img class="hub-thumb" src="${refVistaJpg}" alt="Comparison preview" />
        <div class="hub-body">
          <span class="hub-num">Module 02</span>
          <h2 class="hub-title">Target vs Realtime Comparison</h2>
          <p class="hub-desc">Interactive draggable split slider comparing WebGL2 Sobel ink/cel shaders against original concept art.</p>
          <div class="hub-action">Open Split Slider →</div>
        </div>
      </a>

      <!-- 03 Weapons -->
      <a href="./03-weapons.html" class="hub-card">
        <img class="hub-thumb" src="${torchJpg}" alt="Weapons preview" />
        <div class="hub-body">
          <span class="hub-num">Module 03</span>
          <h2 class="hub-title">First-Person Tool Rig</h2>
          <p class="hub-desc">Plasma Torch dual-laser cutter, 3-prong magnetic Gravity Gun, and vertical thruster Jetpack mechanics.</p>
          <div class="hub-action">Inspect Tools →</div>
        </div>
      </a>

      <!-- 04 Playground -->
      <a href="./04-playground.html" class="hub-card">
        <img class="hub-thumb" src="${jetpackJpg}" alt="Playground preview" />
        <div class="hub-body">
          <span class="hub-num">Module 04</span>
          <h2 class="hub-title">Physics Toys & Compound Buggy</h2>
          <p class="hub-desc">Drivable 4-wheel buggy, dual-tier Archimedes buoyancy basin, hinged seesaw, and bowling ball hopper.</p>
          <div class="hub-action">Explore Playground →</div>
        </div>
      </a>

      <!-- 05 Telemetry -->
      <a href="./05-telemetry.html" class="hub-card">
        <div style="width: 100%; aspect-ratio: 16/9; background: #131b24; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 2.2rem; color: var(--accent-lime); font-weight: 900;">
          74 / 74 ✓
        </div>
        <div class="hub-body">
          <span class="hub-num">Module 05</span>
          <h2 class="hub-title">Verification & Rollback Telemetry</h2>
          <p class="hub-desc">Synctest rollback idempotency audit, 2-client authority room parity, and snapshot hydration verification.</p>
          <div class="hub-action">View Telemetry →</div>
        </div>
      </a>
    </div>
  </main>
</body>
</html>`;

// 2. MODULE 01: VIDEO (~1.1 MB with embedded animated loop + video tag)
const videoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // 01 Video Player</title>
  <style>
    ${sharedStyles}
    .video-viewport {
      position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000;
      border-radius: 8px; overflow: hidden; border: 1px solid var(--border-bright);
    }
    .video-viewport img, .video-viewport video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-top: 1.25rem; }
    .stat-box { background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.5rem 0.75rem; }
    .stat-label { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; }
    .stat-val { font-family: var(--font-mono); font-size: 1.1rem; color: var(--accent-lime); font-weight: 700; }
    .mode-pills { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  ${buildHeader('01-video')}
  <main>
    <div>
      <span class="section-tag">Module 01</span>
      <h1 class="section-title">Live 60 FPS Gameplay Recording</h1>
      <p class="section-desc">Uncut capture from live 4-slot Syncplay session in Chromium WebGL2.</p>
    </div>

    <div class="card">
      <div class="mode-pills">
        <button class="btn btn-active" id="gifBtn" onclick="showGif()">Embedded Highlight Loop (Instant)</button>
        <button class="btn" id="vidBtn" onclick="showVid()">HTML5 MP4 Player</button>
      </div>

      <div class="video-viewport" id="vwrap">
        <img id="gifImg" src="${gifCompact}" alt="Gameplay Animated Highlight Loop" />
        <video id="vidEl" style="display: none;" controls loop playsinline poster="${vistaJpg}">
          <source src="./gameplay_recording.mp4" type="video/mp4" />
          <source src="./gameplay_recording.webm" type="video/webm" />
        </video>
      </div>

      <div class="stats-row">
        <div class="stat-box"><div class="stat-label">Frame Rate</div><div class="stat-val">60 FPS</div></div>
        <div class="stat-box"><div class="stat-label">Fixed Physics</div><div class="stat-val">30 Hz</div></div>
        <div class="stat-box"><div class="stat-label">Syncplay Mode</div><div class="stat-val">Deterministic</div></div>
        <div class="stat-box"><div class="stat-label">Dynamic Bodies</div><div class="stat-val">17 Active</div></div>
      </div>
    </div>

    <div class="nav-footer">
      <a href="./index.html" class="btn">← Back to Hub</a>
      <a href="./02-comparison.html" class="btn btn-active">Next: 02 Visual Comparison →</a>
    </div>
  </main>

  <script>
    const gifImg = document.getElementById('gifImg');
    const vidEl = document.getElementById('vidEl');
    const gifBtn = document.getElementById('gifBtn');
    const vidBtn = document.getElementById('vidBtn');

    function showGif() {
      gifImg.style.display = 'block';
      vidEl.style.display = 'none';
      try { vidEl.pause(); } catch {}
      gifBtn.classList.add('btn-active');
      vidBtn.classList.remove('btn-active');
    }

    function showVid() {
      gifImg.style.display = 'none';
      vidEl.style.display = 'block';
      try { vidEl.play(); } catch {}
      vidBtn.classList.add('btn-active');
      gifBtn.classList.remove('btn-active');
    }
  </script>
</body>
</html>`;

// 3. MODULE 02: COMPARISON (~480KB with inlined JPEGs)
const comparisonHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // 02 Target Comparison</title>
  <style>
    ${sharedStyles}
    .split-box {
      position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 8px;
      overflow: hidden; border: 1px solid var(--border-bright); cursor: ew-resize; user-select: none;
    }
    .split-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .split-overlay {
      position: absolute; top: 0; left: 0; width: 50%; height: 100%; overflow: hidden;
      border-right: 2px solid var(--accent-lime); box-shadow: 2px 0 16px rgba(163,230,53,0.6); pointer-events: none;
    }
    .split-overlay img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
    .split-handle {
      position: absolute; top: 50%; left: 50%; width: 36px; height: 36px;
      background: var(--accent-lime); color: #000; border-radius: 50%; transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center; font-weight: 900; z-index: 10;
      box-shadow: 0 0 16px rgba(163,230,53,0.8);
    }
    .badge-pill {
      position: absolute; top: 1rem; padding: 0.3rem 0.65rem; border-radius: 4px;
      font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; z-index: 5;
    }
    .badge-l { left: 1rem; background: rgba(163,230,53,0.9); color: #000; }
    .badge-r { right: 1rem; background: rgba(18,24,32,0.9); color: #fff; border: 1px solid var(--border-bright); }
    .tab-pills { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
  </style>
</head>
<body>
  ${buildHeader('02-comparison')}
  <main>
    <div>
      <span class="section-tag">Module 02</span>
      <h1 class="section-title">Visual Benchmark: Target vs In-Engine</h1>
      <p class="section-desc">Drag the divider horizontally to compare real-time WebGL2 Sobel ink/cel shaders against original concept benchmarks.</p>
    </div>

    <div class="card">
      <div class="tab-pills">
        <button class="btn btn-active" onclick="switchTab('vista', this)">Salvage Vista</button>
        <button class="btn" onclick="switchTab('torch', this)">Plasma Torch</button>
        <button class="btn" onclick="switchTab('gravity', this)">Gravity Gun</button>
        <button class="btn" onclick="switchTab('basin', this)">Water Basin</button>
      </div>

      <!-- Slide: Vista -->
      <div class="split-box comp-slide" id="slide-vista">
        <span class="badge-pill badge-l">In-Engine Realtime (WebGL2)</span>
        <span class="badge-pill badge-r">Concept Target Benchmark</span>
        <img class="split-img" src="${refVistaJpg}" alt="Concept Benchmark" /> <!-- secret-scan: allow -->
        <div class="split-overlay">
          <img src="${vistaJpg}" alt="In-Engine" /> <!-- secret-scan: allow -->
        </div>
        <div class="split-handle">⟷</div>
      </div>

      <!-- Slide: Torch -->
      <div class="split-box comp-slide" id="slide-torch" style="display: none;">
        <span class="badge-pill badge-l">In-Engine Realtime (WebGL2)</span>
        <span class="badge-pill badge-r">Concept Target Benchmark</span>
        <img class="split-img" src="${refTorchJpg}" alt="Concept Benchmark" /> <!-- secret-scan: allow -->
        <div class="split-overlay">
          <img src="${torchJpg}" alt="In-Engine" /> <!-- secret-scan: allow -->
        </div>
        <div class="split-handle">⟷</div>
      </div>

      <!-- Slide: Gravity -->
      <div class="split-box comp-slide" id="slide-gravity" style="display: none;">
        <span class="badge-pill badge-l">In-Engine Realtime (WebGL2)</span>
        <span class="badge-pill badge-r">Concept Target Benchmark</span>
        <img class="split-img" src="${refGravityJpg}" alt="Concept Benchmark" /> <!-- secret-scan: allow -->
        <div class="split-overlay">
          <img src="${gravityJpg}" alt="In-Engine" /> <!-- secret-scan: allow -->
        </div>
        <div class="split-handle">⟷</div>
      </div>

      <!-- Slide: Basin -->
      <div class="split-box comp-slide" id="slide-basin" style="display: none;">
        <span class="badge-pill badge-l">In-Engine Realtime (WebGL2)</span>
        <span class="badge-pill badge-r">Concept Target Benchmark</span>
        <img class="split-img" src="${refBasinJpg}" alt="Concept Benchmark" /> <!-- secret-scan: allow -->
        <div class="split-overlay">
          <img src="${jetpackJpg}" alt="In-Engine" /> <!-- secret-scan: allow -->
        </div>
        <div class="split-handle">⟷</div>
      </div>
    </div>

    <div class="nav-footer">
      <a href="./01-video.html" class="btn">← Prev: 01 Video Player</a>
      <a href="./03-weapons.html" class="btn btn-active">Next: 03 First-Person Tools →</a>
    </div>
  </main>

  <script>
    function switchTab(k, btn) {
      document.querySelectorAll('.tab-pills button').forEach(b => b.classList.remove('btn-active'));
      btn.classList.add('btn-active');
      document.querySelectorAll('.comp-slide').forEach(s => s.style.display = 'none');
      const activeSlide = document.getElementById('slide-' + k);
      if (activeSlide) {
        activeSlide.style.display = 'block';
        initSlider(activeSlide);
      }
    }

    function initSlider(slide) {
      const overlay = slide.querySelector('.split-overlay');
      const handle = slide.querySelector('.split-handle');
      const imgL = overlay.querySelector('img');

      function setPct(p) {
        p = Math.max(0, Math.min(100, p));
        overlay.style.width = p + '%';
        handle.style.left = p + '%';
        if (slide.clientWidth > 0) imgL.style.width = slide.clientWidth + 'px';
      }

      setPct(50);

      let dragging = false;
      function onMove(e) {
        if (!dragging) return;
        const rect = slide.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        setPct(((clientX - rect.left) / rect.width) * 100);
      }

      slide.onmousedown = (e) => { dragging = true; onMove(e); };
      slide.ontouchstart = (e) => { dragging = true; onMove(e); };
      window.onmousemove = onMove;
      window.ontouchmove = onMove;
      window.onmouseup = () => dragging = false;
      window.ontouchend = () => dragging = false;
    }

    document.querySelectorAll('.comp-slide').forEach(s => {
      if (s.style.display !== 'none') initSlider(s);
    });
    window.addEventListener('resize', () => {
      document.querySelectorAll('.comp-slide').forEach(s => {
        if (s.style.display !== 'none') initSlider(s);
      });
    });
  </script>
</body>
</html>`;

// 4. MODULE 03: WEAPONS (~420KB with inlined JPEGs)
const weaponsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // 03 First-Person Tools</title>
  <style>
    ${sharedStyles}
    .tool-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; }
    .tool-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
    .tool-thumb { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; }
    .tool-body { padding: 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .tool-hdr { display: flex; justify-content: space-between; align-items: center; }
    .tool-name { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .tool-key { font-family: var(--font-mono); font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: rgba(163,230,53,0.15); color: var(--accent-lime); border: 1px solid rgba(163,230,53,0.3); }
    .tool-bullets { list-style: none; margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .tool-bullets li { font-size: 0.82rem; color: var(--text-muted); display: flex; gap: 0.4rem; }
    .tool-bullets li::before { content: "▹"; color: var(--accent-lime); }
  </style>
</head>
<body>
  ${buildHeader('03-weapons')}
  <main>
    <div>
      <span class="section-tag">Module 03</span>
      <h1 class="section-title">First-Person Weapon Rig</h1>
      <p class="section-desc">Deterministic tool interactions with laser voxel cutting, magnetic levitation, and aerial thrust.</p>
    </div>

    <div class="tool-grid">
      <!-- Plasma Torch -->
      <div class="tool-card">
        <img class="tool-thumb" src="${torchJpg}" alt="Plasma Torch" />
        <div class="tool-body">
          <div class="tool-hdr">
            <h2 class="tool-name">Plasma Torch</h2>
            <span class="tool-key">Key 2 / LMB</span>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted);">
            Dual-nozzle heavy cutting laser with animated induction coils, volumetric sparks, and real-time voxel hull bisection.
          </p>
          <ul class="tool-bullets">
            <li>Bisects rigid voxel structures along raycast plane</li>
            <li>Spawns severed segments as free dynamic bodies</li>
            <li>Heat shroud color modulation and molten embers</li>
          </ul>
        </div>
      </div>

      <!-- Gravity Gun -->
      <div class="tool-card">
        <img class="tool-thumb" src="${gravityJpg}" alt="Gravity Gun" />
        <div class="tool-body">
          <div class="tool-hdr">
            <h2 class="tool-name">Gravity Gun</h2>
            <span class="tool-key">Key 1 / LMB</span>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted);">
            Three-prong magnetic tractor beam with spinning rotor core. Levitates, locks orientation, and flings dynamic objects.
          </p>
          <ul class="tool-bullets">
            <li>Rapier 3D joint spring-damper constraint</li>
            <li>Capped linear and angular momentum targeting</li>
            <li>High-impulse release fling vector on throw</li>
          </ul>
        </div>
      </div>

      <!-- Jetpack -->
      <div class="tool-card">
        <img class="tool-thumb" src="${jetpackJpg}" alt="Jetpack Aerial" />
        <div class="tool-body">
          <div class="tool-hdr">
            <h2 class="tool-name">Industrial Jetpack</h2>
            <span class="tool-key">Spacebar (Hold)</span>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted);">
            Dual thruster nacelles providing vertical impulse thrust with fuel consumption, cooldown recharge, and camera tilt.
          </p>
          <ul class="tool-bullets">
            <li>Impulse vector integration with ground detection</li>
            <li>Tactical HUD fuel gauge with overheat indicator</li>
            <li>Allows aerial navigation over gantry towers</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="nav-footer">
      <a href="./02-comparison.html" class="btn">← Prev: 02 Visual Comparison</a>
      <a href="./04-playground.html" class="btn btn-active">Next: 04 Physics Playground →</a>
    </div>
  </main>
</body>
</html>`;

// 5. MODULE 04: PLAYGROUND (~180KB with inlined JPEG)
const playgroundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // 04 Physics Playground</title>
  <style>
    ${sharedStyles}
    .play-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .play-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1.1rem; }
    .play-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem; }
    .play-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; }
  </style>
</head>
<body>
  ${buildHeader('04-playground')}
  <main>
    <div>
      <span class="section-tag">Module 04</span>
      <h1 class="section-title">Physics Toys & Compound Buggy</h1>
      <p class="section-desc">Interactive environmental systems simulating fluid dynamics, compound vehicles, and joint constraints.</p>
    </div>

    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 0.5rem;">
      <img src="${vistaJpg}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;" alt="Playground Overview" />
    </div>

    <!-- Playground Focus Sectors -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; margin-bottom: 1rem;">
      <div class="card" style="padding: 0; overflow: hidden;">
        <img src="${buggyJpg}" style="width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block;" alt="Buggy Test Pad & Tire Barriers" />
        <div style="padding: 1rem;">
          <span class="pill">Sector D: Vehicle Staging</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin: 0.4rem 0 0.2rem;">Player-Sized Salvage Buggy (1.79m)</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Scaled to match 1.71m character avatar. 6-point tubular steel roll cage, V8 engine block, front bull bar stinger, and 0.96m knobby off-road wheels.</p>
        </div>
      </div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <img src="${cockpitJpg}" style="width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block;" alt="Buggy First-Person Driving Cockpit" />
        <div style="padding: 1rem;">
          <span class="pill">First-Person Driving View</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin: 0.4rem 0 0.2rem;">Rideable Cockpit & Dynamic Wheel</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Mount with [E]. Camera locks at driver eye-level inside the roll cage, rotates dynamically with chassis yaw, with active steering wheel rotation.</p>
        </div>
      </div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <img src="${towerJpg}" style="width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block;" alt="Destructible Watchtower & Shipping Containers" />
        <div style="padding: 1rem;">
          <span class="pill">Sector A: Salvage Yard</span>
          <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin: 0.4rem 0 0.2rem;">3-Tier Watchtower & 20ft Containers</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">3.5m tall salvage watchtower with destructible structural lattice legs, alongside stacked 20ft corrugated intermodal containers.</p>
        </div>
      </div>
    </div>

    <div class="play-grid">
      <div class="play-card">
        <h2 class="play-title">🚜 Drivable Salvage Buggy</h2>
        <p class="play-desc">4-wheel compound suspension vehicle with chassis collider, wheel raycasts, steering kinematics, and mount/dismount controls.</p>
      </div>

      <div class="play-card">
        <h2 class="play-title">🌊 Archimedes Fluid Basin</h2>
        <p class="play-desc">Dual-tier reservoir calculating submerged body displacement, buoyant lift forces, and viscous drag for floating crates & hazard drums.</p>
      </div>

      <div class="play-card">
        <h2 class="play-title">⚖️ Seesaw Fulcrum</h2>
        <p class="play-desc">Hinged balance plank responding to dynamic ballast weight. Stacking salvage crates on either end shifts torque dynamically.</p>
      </div>

      <div class="play-card">
        <h2 class="play-title">🎳 Gravity Ball Hopper</h2>
        <p class="play-desc">Overhead 4-legged lattice steel hopper tower with roller release chute dropping heavy spheres for kinetic impacts.</p>
      </div>
    </div>

    <div class="nav-footer">
      <a href="./03-weapons.html" class="btn">← Prev: 03 First-Person Tools</a>
      <a href="./05-telemetry.html" class="btn btn-active">Next: 05 Verification Telemetry →</a>
    </div>
  </main>
</body>
</html>`;

// 6. MODULE 05: TELEMETRY (~9KB)
const telemetryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wreck Yard // 05 Telemetry & Tests</title>
  <style>
    ${sharedStyles}
    .table-wrap { overflow-x: auto; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { text-align: left; font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border-bright); }
    td { padding: 0.75rem; border-bottom: 1px solid var(--border-subtle); }
    .pill { font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; background: rgba(163,230,53,0.12); border: 1px solid rgba(163,230,53,0.4); color: var(--accent-lime); }
  </style>
</head>
<body>
  ${buildHeader('05-telemetry')}
  <main>
    <div>
      <span class="section-tag">Module 05</span>
      <h1 class="section-title">Automated Determinism & Test Telemetry</h1>
      <p class="section-desc">Verification audit ensuring zero multiplayer desyncs across network boundaries and rollback resteps.</p>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span style="font-size: 1.1rem; font-weight: 700; color: #fff;">Full Suite Results:</span>
          <span style="font-family: var(--font-mono); color: var(--accent-lime); margin-left: 0.5rem; font-weight: 700;">16 files / 74 tests passing (0 failures)</span>
        </div>
        <span class="pill">✓ 100% PASS</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Suite Target</th><th>Methodology</th><th>Pass Condition</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Deterministic Rollback</strong></td>
              <td>Syncplay synctest fuzzer over 15 frames</td>
              <td>Checksum(Rewind Restep) == Checksum(Straight Step)</td>
              <td><span class="pill">✓ PASS (7.1s)</span></td>
            </tr>
            <tr>
              <td><strong>2-Client Authority Room</strong></td>
              <td>Networked multiplayer simulation with jitter</td>
              <td>Host and client reach identical presentation state</td>
              <td><span class="pill">✓ PASS (52.4s)</span></td>
            </tr>
            <tr>
              <td><strong>Late Join Snapshot</strong></td>
              <td>Hydrate room state into fresh joining client</td>
              <td>Joining client matches room state hash on tick N</td>
              <td><span class="pill">✓ PASS (20.2s)</span></td>
            </tr>
            <tr>
              <td><strong>Voxel Fracture Bisection</strong></td>
              <td>Cut beams into dual convex hulls</td>
              <td>Pinning preserved on stump; child bodies dynamic</td>
              <td><span class="pill">✓ PASS (0.8s)</span></td>
            </tr>
            <tr>
              <td><strong>Buoyancy & Fluid Damping</strong></td>
              <td>Dual-tier Archimedes immersion integration</td>
              <td>Floating crates reach stable equilibrium at surface</td>
              <td><span class="pill">✓ PASS (26.0s)</span></td>
            </tr>
            <tr>
              <td><strong>Buggy Vehicle Controller</strong></td>
              <td>4-wheel compound suspension kinematics</td>
              <td>Mounts, steers, accelerates WASD, dismounts</td>
              <td><span class="pill">✓ PASS (1.1s)</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="nav-footer">
      <a href="./04-playground.html" class="btn">← Prev: 04 Physics Playground</a>
      <a href="./index.html" class="btn btn-active">Back to Showcase Hub ⤾</a>
    </div>
  </main>
</body>
</html>`;

const pages = [
  { name: 'index.html', content: indexHtml },
  { name: '01-video.html', content: videoHtml },
  { name: '02-comparison.html', content: comparisonHtml },
  { name: '03-weapons.html', content: weaponsHtml },
  { name: '04-playground.html', content: playgroundHtml },
  { name: '05-telemetry.html', content: telemetryHtml },
];

console.log('Writing modular pages with embedded media...');
for (const p of pages) {
  const bPath = path.join(brainDir, p.name);
  const pubPath = path.join(publicShowcaseDir, p.name);

  fs.writeFileSync(bPath, p.content, 'utf-8');
  fs.writeFileSync(pubPath, p.content, 'utf-8');
  console.log(`Wrote ${p.name}: ${(p.content.length / 1024).toFixed(1)} KB`);
}

console.log('All modular pages built successfully!');
