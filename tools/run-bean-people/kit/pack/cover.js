// Pack cover and gallery sheets, 1080 x 1080, built with the shipped helper (pack-out/kit/beankit.js), so a
// render here is also a test of the pack. Serve tools/ and open
//   run-bean-people/kit/pack/cover.html?shot=<cover|weapons|faces|outfits|finishes|action>
// (node scripts/pack.mjs pack-out first). window.done turns true once the frame is drawn.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { loadBeanKit } from "../pack-out/kit/beankit.js";

const shot = new URLSearchParams(location.search).get("shot") ?? "cover";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const kit = await loadBeanKit("../pack-out/kit/", { loader });
const L = kit.looks;

// a figure: [look, clip, time 0-1, x, z, turn (deg), label]
const grid = (items, cols, dx, rise, run, z0 = 0) => items.map((it, i) => {
  const r = Math.floor(i / cols), c = i % cols, n = Math.min(cols, items.length - r * cols);
  return { ...it, x: (c - (n - 1) / 2) * dx, y: r * rise, z: z0 - r * run, row: r };
});

const SHOTS = {
  cover: {
    bg: ["#ffcf4a", "#ff7a3d"], floor: "#ffb347", ink: "#3a1606", pill: "#fff1c9",
    title: ["BEAN SQUAD"], pills: ["70 ANIMATIONS · 12 TOY WEAPONS", "ANIMATED GLTF / GLB"],
    cam: [0, 5.9, 13.9], target: [0, 1.15, -1.2], fov: 32,
    figs: [
      // the hero: the devil, front and centre, angry screen face, no weapon, fists up
      { look: { ...L.imp, weapon: "none" }, clip: "cheer", t: 0.25, x: 0, z: 2.2, turn: 0, hero: true },
      // front row
      { look: L.skater, clip: "dance-floss", t: 0.3, x: -2.3, z: 0.9, turn: 20 },
      { look: L.striker, clip: "jumping-jacks", t: 0.25, x: 2.3, z: 0.9, turn: -20 },
      { look: L.heavy, clip: "aim", t: 0.2, x: -3.6, z: -0.9, turn: -10 },
      { look: L.glowbug, clip: "aim", t: 0.3, x: 3.7, z: -0.9, turn: 30 },
      // middle row, in the gaps
      { look: L.goalie, clip: "wave-big", t: 0.2, x: -2.4, z: -2.4, turn: 10 },
      { look: L.hiker, clip: "dance-bob", t: 0.25, x: -0.9, z: -1.7, turn: 10 },
      { look: L.royal, clip: "victory", t: 0.4, x: 0.9, z: -1.7, turn: -10 },
      { look: L.sprout, clip: "dance-disco", t: 0.15, x: 2.4, z: -2.4, turn: -15 },
      // back row
      { look: L.ghost, clip: "dance-spin", t: 0.3, x: -1.9, z: -5.0, turn: 0 },
      { look: L.trooper, clip: "taunt", t: 0.3, x: 0.0, z: -5.4, turn: 0 },
      { look: L.mechanic, clip: "thumbs-up", t: 0.45, x: 1.9, z: -5.0, turn: 0 },
    ],
  },
  weapons: {
    bg: ["#8fd8ff", "#3d5a80"], floor: "#5f86b5", ink: "#0f1c33", pill: "#e8f6ff",
    title: ["12 TOY WEAPONS"], cam: [0, 5.6, 19.5], target: [0, 3.5, -2.6], fov: 30, labels: true, steps: [12, 2.1],
    figs: grid(kit.catalog.weapons.map((w, i) => ({
      look: { ...kit.randomLook(mulberry(i * 7 + 3)), top: "none", head: "none", topper: "none", number: "none", weapon: w,
              colours: { ...kit.randomLook(mulberry(i * 7 + 3)).colours, weapon: ["#ff7426", "#ffcc26", "#8fd8ff", "#b5f0a0", "#ff8fb1", "#c9a7ff"][i % 6] } },
      clip: "aim", t: 0.3, turn: -62, label: w })), 3, 3.3, 1.3, 2.1, 1.4),
  },
  faces: {
    bg: ["#c9a7ff", "#6b3fa0"], floor: "#8f6bc9", ink: "#20103a", pill: "#f3ecff",
    title: ["24 FACES"], sub: "printed or on a glowing screen", cam: [0, 5.2, 21], target: [0, 3.9, -2.0], fov: 30, steps: [13, 1.5],
    figs: grid([...kit.catalog.art_faces, ...kit.catalog.led_faces].map((f, i) => ({
      look: { face: f, finish: i % 3 === 0 ? "black" : "custom", colours: { body: ["#e6ded0", "#ff8fb1", "#8fd8ff", "#b5f0a0", "#ffe08a", "#ff7426"][i % 6],
              arms: ["#e6ded0", "#ff8fb1", "#8fd8ff", "#b5f0a0", "#ffe08a", "#ff7426"][i % 6], hands: ["#e6ded0", "#ff8fb1", "#8fd8ff", "#b5f0a0", "#ffe08a", "#ff7426"][i % 6],
              mark: "#1a181c", led: ["#59f2ff", "#ffb347", "#ff4d4d", "#9dff6b", "#ff6fd8"][i % 5] } },
      clip: "idle", t: 0.1, turn: 0 })), 6, 1.85, 1.2, 1.5, 1.6),
  },
  outfits: {
    bg: ["#b5f0a0", "#2f9e8f"], floor: "#6cc79a", ink: "#0e2e26", pill: "#effff0",
    title: ["MIX AND MATCH"], sub: "tops · hats · toppers · numbers", cam: [0, 3.4, 21.0], target: [0, 3.55, -1.2], fov: 30, steps: [16, 2.4],
    figs: grid([
      { look: { face: "x", top: "hoodie", finish: "bone", colours: { top: "#ef476f", legs: "#1f1f21" } }, clip: "idle", t: 0.2 },
      { look: { face: "happy", top: "hoodie", finish: "black", colours: { top: "#ffcc26", led: "#59f2ff" } }, clip: "wave", t: 0.3 },
      { look: { face: "dots", top: "vest", head: "beanie", finish: "custom", colours: { body: "#8fd8ff", arms: "#8fd8ff", hands: "#8fd8ff", top: "#ff5a36", hat: "#1f1f21" } }, clip: "idle-look", t: 0.3 },
      { look: { face: "led-smirk", top: "vest", head: "bucket", finish: "olive", colours: { top: "#f4a259", hat: "#e6ded0", led: "#9dff6b" } }, clip: "taunt", t: 0.3 },
      { look: { face: "stitch", top: "coveralls", finish: "custom", colours: { body: "#ffe08a", arms: "#ffe08a", hands: "#ffe08a", top: "#3d5a80" } }, clip: "thumbs-up", t: 0.45 },
      { look: { face: "slits", number: 23, topper: "flower", finish: "custom", colours: { body: "#ff8fb1", arms: "#ff8fb1", hands: "#ff8fb1", legs: "#6b3fa0", topper: "#ffe08a", number: "#f2f0ea" } }, clip: "dance-bob", t: 0.2 },
      { look: { face: "cool", number: 7, topper: "crown", finish: "gold", colours: { topper: "#ff8fb1", number: "#1f1f21", led: "#ffb347" } }, clip: "victory", t: 0.4 },
      { look: { face: "drip", number: 42, topper: "antenna", finish: "custom", colours: { body: "#2f9e8f", arms: "#2f9e8f", hands: "#f2f0ea", mark: "#f2f0ea", topper: "#ffcc26", number: "#ffcc26" } }, clip: "cheer", t: 0.3 },
      { look: { face: "glyph", topper: "horns", top: "coveralls", finish: "black", colours: { top: "#d92e2e", topper: "#f2f0ea" } }, clip: "angry", t: 0.3 },
      { look: { face: "tired", topper: "sprout", number: 0, finish: "bone", colours: { topper: "#5cbf4a", number: "#ff7426", legs: "#2f9e8f" } }, clip: "shrug", t: 0.4 },
    ].map(f => ({ ...f, turn: 0 })), 5, 2.3, 1.2, 2.4, 0.8),
  },
  finishes: {
    bg: ["#f2f0ea", "#b89a6b"], floor: "#d8c7a3", ink: "#2a1f10", pill: "#fff8e8",
    title: ["ART-TOY FINISHES"], cam: [0, 3.3, 18.5], target: [0, 3.4, -1.2], fov: 30, labels: true, steps: [14, 2.4],
    figs: grid(Object.keys(kit.finishes).map((f, i) => ({
      look: { face: ["x", "dots", "holes", "happy", "stitch", "cyclops-dot", "x", "slits"][i], finish: f, colours: { legs: "#1f1f21", feet: "#1f1f21", led: "#59f2ff" } },
      clip: ["idle", "wave", "victory", "dance-bob", "cheer", "idle-look", "thumbs-up", "taunt"][i], t: 0.3, turn: 0, label: f })), 4, 2.35, 1.2, 2.4, 1.0),
  },
  action: {
    bg: ["#ff8fb1", "#ef476f"], floor: "#ff9fb8", ink: "#3a0a1a", pill: "#fff0f4",
    title: ["70 ANIMATIONS"], sub: "move · jump · fight · dance · emote", cam: [2.6, 2.2, 20.5], target: [0.3, 3.1, -1.2], fov: 31,
    figs: [
      { look: L.striker, clip: "sprint", t: 0.25, x: -4.6, z: 0.6, turn: 70 },
      { look: L.skater, clip: "celebrate-backflip", t: 0.45, x: -2.2, z: 0.2, turn: 20 },
      { look: L.goalie, clip: "dive", t: 0.3, x: 0.6, z: 0.4, turn: 80 },
      { look: L.imp, clip: "knockback", t: 0.25, x: 3.6, z: 0.6, turn: -30 },
      { look: L.sprout, clip: "jumping-jacks", t: 0.3, x: -4.0, z: -2.6, turn: 10 },
      { look: L.hiker, clip: "climb", t: 0.3, x: -1.6, z: -2.9, turn: 160 },
      { look: L.royal, clip: "dance-spin", t: 0.3, x: 0.8, z: -3.0, turn: 0 },
      { look: L.ghost, clip: "scared", t: 0.4, x: 3.1, z: -2.8, turn: -15 },
      { look: L.glowbug, clip: "whoa", t: 0.35, x: 5.2, z: -2.2, turn: -30 },
    ],
  },
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const S = SHOTS[shot];
const heroQ = new URLSearchParams(location.search).get("hero");
if (heroQ) { const [c, t] = heroQ.split(":"); Object.assign(S.figs.find(f => f.hero), { clip: c, t: +t }); }
const card = document.getElementById("card");
for (const [k, v] of Object.entries({ "--bg0": S.bg[0], "--bg1": S.bg[1], "--ink": S.ink, "--pill": S.pill })) card.style.setProperty(k, v);
document.getElementById("title").innerHTML = S.title.map(t => `<div class="name">${t}</div>`).join("") + (S.sub ? `<div class="sub">${S.sub}</div>` : "");
document.getElementById("pills").innerHTML = (S.pills || []).map((p, i) => `<div class="pill${i ? " alt" : ""}">${p}</div>`).join("");

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1080, 1080, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 200);
camera.position.set(...S.cam);
camera.lookAt(...S.target);
camera.updateMatrixWorld();
scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(S.floor), 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(6, 14, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.radius = 4;
sun.shadow.bias = -0.0005;
scene.add(sun);
const pmrem = new THREE.PMREMGenerator(renderer);   // metal finishes (gold, chrome) need something to reflect
const env = new THREE.Scene();
env.background = new THREE.Color(0x777774);
for (const [c, p, sz] of [[0xffffff, [0, 6, 0], [6, 6]], [0xfff0e0, [-6, 2, 3], [3, 5]], [0xe0ecff, [6, 2, -3], [3, 5]]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(...sz), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  m.position.set(...p);
  m.lookAt(0, 0, 0);
  env.add(m);
}
scene.environment = pmrem.fromScene(env, 0.04).texture;
scene.environmentIntensity = 0.7;
const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: S.floor, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
if (S.steps) {                                       // bleachers: one step per row behind the front row
  const [w, run] = S.steps, rows = Math.max(...S.figs.map(f => f.row)) + 1, z0 = S.figs[0].z;
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.floor).offsetHSL(0, 0, 0.06), roughness: 0.9 });
  for (let r = 1; r < rows; r++) {
    const y = S.figs.find(f => f.row === r).y;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, y, run), mat);
    step.position.set(0, y / 2, z0 - r * run);
    step.castShadow = step.receiveShadow = true;
    scene.add(step);
  }
}

const beans = await Promise.all(S.figs.map(async f => {
  const b = await kit.makeBean(f.look);
  b.inPlace = true;
  b.mixer.stopAllAction();
  b.current = null;
  const a = b.play(f.clip, { fade: 0 });
  a.time = f.t * a.getClip().duration;
  b.update(0);
  b.object.position.set(f.x, f.y || 0, f.z);
  b.object.rotation.y = THREE.MathUtils.degToRad(f.turn || 0);
  scene.add(b.object);
  return b;
}));
scene.updateMatrixWorld(true);
if (S.labels) {
  const labels = document.getElementById("labels");
  S.figs.forEach(f => {
    const p = new THREE.Vector3(f.x, (f.y || 0) - 0.02, f.z + 0.75).project(camera);
    const el = document.createElement("div");
    el.className = "label";
    el.textContent = f.label;
    el.style.left = `${(p.x + 1) * 540}px`;
    el.style.top = `${(1 - p.y) * 540}px`;
    labels.appendChild(el);
  });
}
await document.fonts.ready;
renderer.render(scene, camera);
window.stats = { beans: beans.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
window.done = true;
