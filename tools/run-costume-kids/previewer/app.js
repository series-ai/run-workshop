// Bobble costume previewer: every character's toy clips, live, in one page.
// Grid: one full-page canvas draws each character into its cell (scissor).
// Focus: click a cell for a big orbitable view of that character.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CLIPS = ["idle", "walk", "run", "jump", "pick-up", "celebrate", "scared", "attack", "trick-or-treat", "wave", "hit", "sad",
  "sneak", "spin", "idle-peek", "idle-yawn", "idle-look", "dance-wiggle", "dance-robot", "run-jump", "eat-candy", "death"];
const SKIN_TONES = [[0.99, 0.86, 0.74], [0.95, 0.78, 0.62], [0.88, 0.66, 0.48], [0.74, 0.50, 0.32], [0.56, 0.35, 0.21], [0.38, 0.23, 0.14]];
const VIEW_H = 12;                                    // world units the grid cells show, the same for everyone (heads match)
const TARGET = new THREE.Vector3(0, 4.6, 0);          // Blender z-up (0, 0, 4.6) -> three y-up
const VIEW_DIR = new THREE.Vector3(0.62, 0.42, 1.0).normalize(); // the renders' 3/4 view, in y-up

const state = { clip: "idle", speed: 1, paused: false, sync: true, skin: 1, filter: "", turn: false, buckets: true };
const chars = [];  // { slug, cell, scene, mixer, actions, skinMats, ready }
const loader = new GLTFLoader();
const bust = `?t=${Date.now()}`;

// ---------- renderers ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });  // opaque: it paints the page and cell backgrounds itself
const PAGE_BG = new THREE.Color(0xece5d8), CELL_BG = new THREE.Color(0xf3ede3);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setScissorTest(true);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
cam.position.copy(TARGET).addScaledVector(VIEW_DIR, 40);
cam.lookAt(TARGET);

function makeScene() {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff6ea, 0xb9a98f, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 10, 7);
  s.add(sun);
  return s;
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
function chip(parent, text, onClick, cls = "") {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
}
const clipBtns = CLIPS.map((c, i) => chip($("clips"), `${i + 1} ${c}`, () => setClip(c)));
const fclipBtns = CLIPS.map((c, i) => chip($("fclips"), `${i + 1} ${c}`, () => setClip(c)));
const skinBtns = SKIN_TONES.map((t, i) => {
  const b = chip($("skins"), "", () => setSkin(i), "swatch");
  b.style.background = `rgb(${t.map((v) => Math.round(v * 255)).join(",")})`;
  return b;
});
$("speed").oninput = (e) => { state.speed = +e.target.value; $("speedv").textContent = `${state.speed.toFixed(1)}×`; };
$("size").oninput = (e) => document.documentElement.style.setProperty("--cell", `${e.target.value}px`);
$("pause").onclick = () => togglePause();
$("sync").onclick = () => { state.sync = !state.sync; $("sync").classList.toggle("on", state.sync); $("sync").textContent = state.sync ? "In sync" : "Staggered"; setClip(state.clip); };
$("turn").onclick = () => {  // every kid slowly spins, to check the backs
  state.turn = !state.turn;
  $("turn").classList.toggle("on", state.turn);
  if (!state.turn) for (const c of chars) if (c.ready) c.root.rotation.y = 0;
};
$("buckets").onclick = () => {  // hide or show every trick-or-treat bucket (its bone scaled to zero)
  state.buckets = !state.buckets;
  $("buckets").classList.toggle("on", state.buckets);
  chars.forEach(applyBucket);
};
function applyBucket(c) {
  if (!c.ready) return;
  c.root.traverse((o) => { if (o.name === "bucket") o.scale.setScalar(state.buckets ? 1 : 0); });
}
$("filter").oninput = (e) => { state.filter = e.target.value.toLowerCase(); applyFilter(); };

function togglePause() { state.paused = !state.paused; $("pause").classList.toggle("on", state.paused); $("pause").textContent = state.paused ? "Play" : "Pause"; }
function applyFilter() {
  let n = 0;
  for (const c of chars) {
    const show = !state.filter || c.slug.includes(state.filter);
    c.cell.style.display = show ? "" : "none";
    n += show;
  }
  $("count").textContent = `${n} / ${chars.length}`;
}

const ONESHOT = new Set(["death"]);  // clips that end in a different pose: play once, hold, replay

function play(c) {
  if (!c.ready) return;
  for (const a of Object.values(c.actions)) a.stop();
  const a = c.actions[state.clip];
  if (!a) return;
  const once = ONESHOT.has(state.clip);
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  a.clampWhenFinished = once;
  a.reset().play();
  if (!state.sync) a.time = Math.random() * a.getClip().duration;
}
function setClip(name) {
  state.clip = name;
  clipBtns.forEach((b, i) => b.classList.toggle("on", CLIPS[i] === name));
  fclipBtns.forEach((b, i) => b.classList.toggle("on", CLIPS[i] === name));
  chars.forEach(play);
}
function paintSkin(c) {
  const [r, g, b] = SKIN_TONES[state.skin];
  for (const m of c.skinMats) m.color.setRGB(r, g, b, THREE.SRGBColorSpace);
}
function setSkin(i) {
  state.skin = i;
  skinBtns.forEach((b, k) => b.classList.toggle("on", k === i));
  chars.forEach((c) => c.ready && paintSkin(c));
}

// ---------- loading ----------
async function load(c) {
  const gltf = await loader.loadAsync(`chars/${c.slug}.glb${bust}`);
  c.scene = makeScene();
  c.scene.add(gltf.scene);
  c.root = gltf.scene;
  c.mixer = new THREE.AnimationMixer(gltf.scene);
  c.mixer.addEventListener("finished", () => setTimeout(() => ONESHOT.has(state.clip) && play(c), 1000));  // hold the end, then replay
  c.actions = Object.fromEntries(gltf.animations.map((a) => [a.name, c.mixer.clipAction(a)]));
  c.skinMats = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (m.name.startsWith("SKIN") && !c.skinMats.includes(m)) c.skinMats.push(m);
      if (m.transparent) console.warn(`${c.slug}: transparent material ${m.name} (the art rules allow none)`);
    }
  });
  c.ready = true;
  c.cell.classList.remove("loading");
  paintSkin(c);
  applyBucket(c);
  play(c);
}

async function main() {
  const res = await fetch(`chars/index.json${bust}`);
  if (!res.ok) { $("msg").textContent = "No characters exported yet (chars/index.json missing). Refresh in a minute."; return; }
  const slugs = await res.json();
  for (const slug of slugs) {
    const cell = document.createElement("div");
    cell.className = "cell loading";
    cell.innerHTML = `<span>${slug}</span>`;
    $("grid").appendChild(cell);
    const c = { slug, cell, ready: false };
    cell.onclick = () => openFocus(chars.indexOf(c));
    chars.push(c);
  }
  applyFilter();
  setClip("idle");
  setSkin(1);
  const queue = [...chars];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await load(queue.shift()).catch((e) => console.error(e)); }));
}

// ---------- focus view ----------
const fcanvas = $("fc");
const frenderer = new THREE.WebGLRenderer({ canvas: fcanvas, antialias: true });
frenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
frenderer.setClearColor(0xece5d8);
const fcam = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
const controls = new OrbitControls(fcam, fcanvas);
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0xd9ccb6, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
let focusIdx = -1;

function openFocus(i) {
  const c = chars[i];
  if (!c?.ready) return;
  if (focusIdx >= 0) chars[focusIdx].scene.remove(ground);
  focusIdx = i;
  c.scene.add(ground);
  $("fname").textContent = c.slug;
  $("focus").classList.add("open");
  if (!controls.userMoved) {
    controls.target.copy(TARGET);
    fcam.position.copy(TARGET).addScaledVector(VIEW_DIR, +(new URLSearchParams(location.search).get("d") || 34));
  }
  controls.update();
}
function closeFocus() {
  if (focusIdx >= 0) chars[focusIdx].scene.remove(ground);
  focusIdx = -1;
  $("focus").classList.remove("open");
}
controls.addEventListener("start", () => { controls.userMoved = true; });
$("close").onclick = closeFocus;
$("prev").onclick = () => step(-1);
$("next").onclick = () => step(1);
function step(d) {
  const vis = chars.filter((c) => c.cell.style.display !== "none");
  const k = vis.indexOf(chars[focusIdx]);
  openFocus(chars.indexOf(vis[(k + d + vis.length) % vis.length]));
}
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key >= "1" && e.key <= "9") setClip(CLIPS[+e.key - 1]);
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") { const i = CLIPS.indexOf(state.clip); setClip(CLIPS[(i + (e.key === "ArrowDown" ? 1 : -1) + CLIPS.length) % CLIPS.length]); }
  else if (e.key === " ") { e.preventDefault(); togglePause(); }
  else if (focusIdx >= 0 && e.key === "Escape") closeFocus();
  else if (focusIdx >= 0 && e.key === "ArrowRight") step(1);
  else if (focusIdx >= 0 && e.key === "ArrowLeft") step(-1);
});

// test hook: show `slug` at time `t` (seconds) of `clip`, for screenshots of exact moments
window.__chars = chars;
window.__seek = (slug, clip, t) => {
  const c = chars.find((x) => x.slug === slug);
  if (!c?.ready || !c.actions[clip]) return;
  for (const a of Object.values(c.actions)) a.stop();
  const a = c.actions[clip];
  a.reset().play();
  a.time = t;
  c.mixer.update(0);
};

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = state.paused ? 0 : clock.getDelta() * state.speed;
  if (state.paused) clock.getDelta();
  for (const c of chars) if (c.ready) c.mixer.update(dt);
  if (state.turn) { const a = clock.elapsedTime * 0.35; for (const c of chars) if (c.ready) c.root.rotation.y = a; }  // about 18 s a turn

  if (focusIdx >= 0) {
    const w = fcanvas.clientWidth, h = fcanvas.clientHeight;
    if (fcanvas.width !== Math.floor(w * frenderer.getPixelRatio())) frenderer.setSize(w, h, false);
    fcam.aspect = w / h;
    fcam.updateProjectionMatrix();
    controls.update();
    frenderer.render(chars[focusIdx].scene, fcam);
  } else {
    const W = innerWidth, H = innerHeight;
    if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) renderer.setSize(W, H, false);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.setClearColor(PAGE_BG);
    renderer.clear();
    renderer.setClearColor(CELL_BG);
    for (const c of chars) {
      if (c.cell.style.display === "none") continue;
      const r = c.cell.getBoundingClientRect();
      if (!c.ready) {
        if (r.bottom < 0 || r.top > H) continue;
        renderer.setScissor(r.left, H - r.bottom, r.width, r.height);
        renderer.clear();
        continue;
      }
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      const aspect = r.width / r.height;
      cam.top = VIEW_H / 2; cam.bottom = -VIEW_H / 2;
      cam.left = -VIEW_H / 2 * aspect; cam.right = VIEW_H / 2 * aspect;
      cam.updateProjectionMatrix();
      renderer.render(c.scene, cam);
    }
  }
  requestAnimationFrame(frame);
}
main();
frame();
