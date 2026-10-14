// House kit builder: assembles a Victorian house live from the exported parts
// (house-parts/*.glb + manifest.json, made by neighborhood/props/house_parts.py).
// Parts come coloured by role (key colours); they are recoloured to a palette and
// merged into one mesh per material, so a house is 2 draw calls like the baked GLBs.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const bust = `?t=${Date.now()}`;
const M = await (await fetch(`house-parts/manifest.json${bust}`)).json();
const loader = new GLTFLoader();
const $ = (id) => document.getElementById(id);
const VIEW_DIR = new THREE.Vector3(0.62, 0.42, 1.0).normalize();   // the renders' 3/4 view, y-up
const EXTRAS = M.options.extras;
const SIDED = M.options.sided;                         // turret, bay, wing, chimney: none / left / right / both
const FLAGS = EXTRAS.filter((e) => !SIDED.includes(e)); // dormer, balcony, boxes: yes / no
const OPTS = ["width", "roof", "gingerbread", "porch", "rail", "frieze", "siding", "gable_window", "cross_style"];
const ROLES = ["body", "trim", "roof", "porch"];

// ---------- rules (mirror house.validate / parts_for) ----------
const matchCond = (cond, spec) => Object.entries(cond).every(([k, vals]) => vals.includes(spec[k]));
// the parts of a spec: [{ def, mirror }] (a mirrorable part may appear twice: as built and mirrored)
function partsFor(spec) {
  const out = [];
  for (const p of M.parts) {
    if (p.width !== null && p.width !== spec.width) continue;
    if (p.when.some((c) => matchCond(c, spec))) out.push({ def: p, mirror: false });
    if (p.when_mirror && p.when_mirror.some((c) => matchCond(c, spec))) out.push({ def: p, mirror: true });
  }
  return out;
}
const broken = (spec) => M.rules.filter((r) => matchCond(r.forbid, spec));
const off = (e) => (SIDED.includes(e) ? "none" : false);
function whyNot(spec, extra, value = true) {   // reasons the extra can't take this value on this spec
  const t = { ...spec, [extra]: value };
  return [...new Set(M.rules.filter((r) => extra in r.forbid && matchCond(r.forbid, t)).map((r) => r.reason))];
}
function fixUp(spec) {           // switch off extras the other options rule out
  for (const e of EXTRAS) {
    if (spec[e] === off(e) || !whyNot(spec, e, spec[e]).length) continue;
    const fallback = spec[e] === "both" ? ["right", "left"].find((v) => !whyNot(spec, e, v).length) : undefined;
    spec[e] = fallback || off(e);   // "both" keeps whichever side still works
  }
  return spec;
}

// ---------- colours ----------
const toLin = (c) => Math.pow(c, 2.2);
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const ROLE_KEYS = M.roles.table.map((e) => ({ ...e }));
function roleOf(r, g, b) {       // linear vertex colour -> index into ROLE_KEYS, or -1 (a fixed colour)
  const s = [r, g, b].map((c) => Math.pow(Math.max(c, 0), 1 / 2.2));
  let best = -1, bd = 0.02;
  ROLE_KEYS.forEach((e, i) => {
    const d = Math.max(...e.srgb.map((v, j) => Math.abs(v - s[j])));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// ---------- parts ----------
const cache = new Map();          // file -> Promise<{pal, glow, bytes}>
let bytesFetched = 0;
function loadPart(file) {
  if (!cache.has(file)) cache.set(file, (async () => {
    const buf = await (await fetch(`house-parts/${file}${bust}`)).arrayBuffer();
    bytesFetched += buf.byteLength;
    const gltf = await loader.parseAsync(buf, "");
    gltf.scene.updateMatrixWorld(true);
    const out = { pal: [], glow: [], bytes: buf.byteLength };
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const g = new THREE.BufferGeometry();
      g.setIndex(src.index);
      g.setAttribute("position", src.getAttribute("position"));
      g.setAttribute("normal", src.getAttribute("normal"));
      const isGlow = o.material.name === "GLOW";
      if (!isGlow) {
        const col = src.getAttribute("color");
        const n = g.getAttribute("position").count;
        const base = new Float32Array(n * 3), role = new Int16Array(n);
        for (let i = 0; i < n; i++) {
          base[i * 3] = col.getX(i); base[i * 3 + 1] = col.getY(i); base[i * 3 + 2] = col.getZ(i);
          role[i] = roleOf(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
        }
        g.userData = { base, role };
      }
      (isGlow ? out.glow : out.pal).push(g);
    });
    return out;
  })());
  return cache.get(file);
}
function recoloured(g, colours) { // a copy of a PALETTE geometry with role colours swapped for the house's
  const P = Object.fromEntries(ROLES.map((r) => [r, hexRGB(colours[r])])), { base, role } = g.userData;
  const n = role.length, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (role[i] < 0) { col.set(base.subarray(i * 3, i * 3 + 3), i * 3); continue; }
    const e = ROLE_KEYS[role[i]], c = P[e.role];
    for (let j = 0; j < 3; j++) col[i * 3 + j] = toLin(Math.min(1, c[j] * e.k));
  }
  const out = new THREE.BufferGeometry();
  out.setIndex(g.index);
  out.setAttribute("position", g.getAttribute("position"));
  out.setAttribute("normal", g.getAttribute("normal"));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);
function mirrored(g) {            // x -> -x, with the triangle winding flipped so faces still point out
  const m = g.clone().applyMatrix4(MIRROR);
  const idx = m.index.array.slice();
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

const PAL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, name: "PALETTE" });
const glowC = new THREE.Color().setRGB(...M.glow.rgb, THREE.SRGBColorSpace);
const GLOW_MAT = new THREE.MeshStandardMaterial({ color: glowC, emissive: glowC, emissiveIntensity: M.glow.strength, roughness: 0.9, name: "GLOW" });

// assemble: { group (merged, 2 meshes), parts [{file, pal, glow}], offset, tris, bytes }
async function assemble(spec) {
  const use = partsFor(spec);
  const loaded = await Promise.all(use.map((u) => loadPart(u.def.file)));
  const flip = (u, g) => (u.mirror ? mirrored(g) : g);
  const parts = use.map((u, i) => ({ def: u.def, mirror: u.mirror, pal: loaded[i].pal.map((g) => flip(u, recoloured(g, spec.colours))),
    glow: loaded[i].glow.map((g) => flip(u, g)) }));
  const pal = mergeGeometries(parts.flatMap((p) => p.pal));
  const glow = parts.some((p) => p.glow.length) ? mergeGeometries(parts.flatMap((p) => p.glow)) : null;
  // the baked GLBs' pivot: the bounding box's base centre on the origin
  const box = new THREE.Box3().setFromBufferAttribute(pal.getAttribute("position"));
  if (glow) box.union(new THREE.Box3().setFromBufferAttribute(glow.getAttribute("position")));
  const offset = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const group = new THREE.Group();
  group.position.copy(offset);
  group.add(new THREE.Mesh(pal, PAL_MAT));
  if (glow) group.add(new THREE.Mesh(glow, GLOW_MAT));
  const tris = (pal.index.count + (glow ? glow.index.count : 0)) / 3;
  const files = [...new Set(use.map((u) => u.def.file))];
  return { group, parts, offset, box, tris, calls: group.children.length, mirrored: use.filter((u) => u.mirror).length,
    bytes: files.reduce((s, f) => s + M.parts.find((p) => p.file === f).bytes, 0), files, count: use.length };
}

// exploded view: every part its own mesh, pushed away from the house centre
function explodedGroup(asm) {
  const g = new THREE.Group();
  g.position.copy(asm.offset);
  const centre = asm.box.getCenter(new THREE.Vector3());
  for (const p of asm.parts) {
    const pg = new THREE.Group();
    const b = new THREE.Box3();
    for (const geo of [...p.pal, ...p.glow]) b.union(new THREE.Box3().setFromBufferAttribute(geo.getAttribute("position")));
    const d = b.getCenter(new THREE.Vector3()).sub(centre);
    d.y = 0;                                   // spread out sideways and lift by slot, never into the ground
    if (p.def.slot === "walls") d.set(0, 0, 0);
    d.multiplyScalar(0.7);
    d.y += { roof: 4, cross: 5, "hip-gable": 3, "gable-window": 1.5, gable: 3, dormer: 5.5, balcony: 2, "balcony-rail": 3, frieze: -0.3, rail: 0.3, "wing-gable": 2, turret: 1, chimney: 0.5 }[p.def.slot] || 0;
    if (["gable", "wing-gable", "gable-window", "wing-gable-window", "hip-gable"].includes(p.def.slot)) d.z += 2;
    if (["porch", "rail", "frieze"].includes(p.def.slot) || p.def.part.startsWith("boxes-porch")) d.z += { rail: 3.2, frieze: 4.4 }[p.def.slot] || 2;
    pg.position.copy(d);
    for (const geo of p.pal) pg.add(new THREE.Mesh(geo, PAL_MAT));
    for (const geo of p.glow) pg.add(new THREE.Mesh(geo, GLOW_MAT));
    g.add(pg);
  }
  return g;
}

// ---------- main view ----------
function makeScene() {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff6ea, 0xb9a98f, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 10, 7);
  s.add(sun);
  return s;
}
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xece5d8);
const scene = makeScene();
const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshStandardMaterial({ color: 0xd9ccb6, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
const TARGET = new THREE.Vector3(0, 7.5, 0);
cam.position.copy(TARGET).addScaledVector(VIEW_DIR, 62);
const controls = new OrbitControls(cam, canvas);
controls.target.copy(TARGET);
controls.update();

// the kid, for scale, on the porch in front of the door
let kid = null, mixer = null;
loader.loadAsync(`chars/kid-spiky.glb${bust}`).then((gltf) => {
  kid = gltf.scene;
  mixer = new THREE.AnimationMixer(kid);
  const idle = gltf.animations.find((a) => a.name === "idle") || gltf.animations[0];
  if (idle) mixer.clipAction(idle).play();
  kid.traverse((o) => { if (o.name === "bucket") o.scale.setScalar(0); });
  scene.add(kid);
  placeKid();
}).catch((e) => console.error(e));
function placeKid() {
  if (!kid || !current) return;
  const [x, y, z] = M.kid_spot.by_width[state.width][state.porch];   // Blender z-up
  kid.position.set(x, z, -y).add(current.offset);
  kid.visible = ui.kid && !ui.explode;
}

// ---------- state + UI ----------
const state = structuredClone(M.recipes[0].spec);
const ui = { explode: false, street: true, kid: true };
let current = null, shown = null, buildN = 0;

function button(parent, text, onClick, cls = "") {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
}
for (const k of OPTS) for (const v of M.options[k]) button($(k), v, () => set({ [k]: v })).dataset.v = v;
for (const name of M.options.palette) {          // presets: set all four colours at once
  const b = button($("palette"), "", () => set({ palette: name, colours: presetColours(name, state.siding) }), "swatch");
  b.dataset.v = name;
  b.title = name;
  b.style.background = M.palettes[name].body;
  b.style.borderColor = M.palettes[name].roof;
}
for (const role of ROLES) for (const hex of M.swatches[role]) {
  const b = button($(`col-${role}`), "", () => set({ colours: { ...state.colours, [role]: hex } }), "swatch");
  b.dataset.v = hex;
  b.title = hex;
  b.style.background = hex;
}
for (const e of SIDED) {                         // none / left / right / both, each with its reason when ruled out
  const row = document.createElement("div");
  row.className = "side";
  row.innerHTML = `<span>${e}</span>`;
  for (const v of M.options.sides) button(row, v, () => set({ [e]: v }), "").dataset.v = v;
  row.dataset.e = e;
  $("sided").appendChild(row);
}
for (const e of FLAGS) {
  const l = document.createElement("label");
  l.innerHTML = `<input type="checkbox" data-e="${e}"> ${e === "boxes" ? "window boxes" : e}`;
  l.querySelector("input").onchange = (ev) => set({ [e]: ev.target.checked });
  $("extras").appendChild(l);
}
for (const r of M.recipes) {
  const o = document.createElement("option");
  o.value = r.slug;
  o.textContent = r.slug;
  $("recipe").appendChild(o);
}
$("recipe").onchange = (e) => { const r = M.recipes.find((x) => x.slug === e.target.value); if (r) set(structuredClone(r.spec), false); };
$("random").onclick = () => set(randomSpec());
$("explode").onclick = () => { ui.explode = !ui.explode; $("explode").classList.toggle("on", ui.explode); show(); placeKid(); };
$("kidBtn").onclick = () => { ui.kid = !ui.kid; $("kidBtn").classList.toggle("on", ui.kid); placeKid(); };
$("streetBtn").onclick = () => {
  ui.street = !ui.street;
  $("streetBtn").classList.toggle("on", ui.street);
  document.body.classList.toggle("nostreet", !ui.street);
  if (ui.street) buildStreet();
};
$("copy").onclick = async () => {
  const txt = JSON.stringify(specOnly(state));
  $("recipeOut").style.display = "block";
  try { await navigator.clipboard.writeText(txt); $("recipeOut").textContent = `copied:\n${txt}`; }
  catch { $("recipeOut").textContent = txt; }
};

function presetColours(name, siding) {
  const p = { ...M.palettes[name] };
  if (siding === "brick") p.body = M.brick_body;
  return Object.fromEntries(ROLES.map((r) => [r, p[r]]));
}
const SPEC_KEYS = ["width", "roof", "porch", "palette", "rail", "gingerbread", "frieze", "siding", "gable_window", "cross_style", ...EXTRAS];
function specOnly(s) {
  return { ...Object.fromEntries(SPEC_KEYS.map((k) => [k, s[k]])), colours: Object.fromEntries(ROLES.map((r) => [r, s.colours[r]])) };
}
const same = (a, b) => JSON.stringify(specOnly(a)) === JSON.stringify(specOnly(b));

function syncUI() {
  for (const k of [...OPTS, "palette"]) for (const b of $(k).children) b.classList.toggle("on", b.dataset.v === state[k]);
  for (const role of ROLES) for (const b of $(`col-${role}`).children) b.classList.toggle("on", b.dataset.v === state.colours[role]);
  const preset = JSON.stringify(presetColours(state.palette, state.siding)) === JSON.stringify(state.colours);
  $("palname").textContent = preset ? state.palette : `${state.palette} (custom colours)`;
  for (const b of $("cross_style").children) b.disabled = state.roof !== "cross";
  for (const row of $("sided").children) {
    const e = row.dataset.e;
    for (const b of row.querySelectorAll("button")) {
      const why = whyNot(state, e, b.dataset.v);
      b.classList.toggle("on", state[e] === b.dataset.v);
      b.disabled = why.length > 0;
      b.title = why.join("; ");
    }
  }
  for (const inp of $("extras").querySelectorAll("input")) {
    const e = inp.dataset.e, why = whyNot(state, e);
    inp.checked = state[e];
    inp.disabled = why.length > 0;
    inp.parentElement.classList.toggle("off", why.length > 0);
    inp.parentElement.title = why.join("; ");
  }
  const named = M.recipes.find((r) => same(r.spec, state));
  $("recipe").value = named ? named.slug : "";
  for (const s of $("labels").children) s.classList.toggle("on", !!named && s.textContent === named.slug);
}

function randomSpec() {        // like house.pick(): weighted, then repaired to be valid
  const R = Math.random;
  const ch = (a) => a[Math.floor(R() * a.length)];
  const wch = (a, w) => { let r = R() * w.reduce((x, y) => x + y); for (let i = 0; i < a.length; i++) if ((r -= w[i]) < 0) return a[i]; return a[0]; };
  const side = (p) => (R() < p ? wch(["right", "left", "both"], [5, 3, 1]) : "none");
  const s = { width: ch(M.options.width), roof: wch(["gable", "hip", "hip-gable", "cross"], [5, 2, 2, 3]),
    porch: wch(["left", "right", "centre", "wrap"], [3, 2, 3, 3]), palette: ch(M.options.palette) };
  s.turret = s.porch === "left" && R() < 0.6 ? "right" : s.porch === "right" && R() < 0.6 ? "left" : "none";
  s.wing = s.roof !== "cross" ? side(0.4) : "none";
  s.bay = side(0.45);
  s.dormer = R() < 0.5;
  s.chimney = side(0.55);
  s.balcony = R() < 0.45;
  s.boxes = R() < 0.4;
  s.rail = R() < 0.45 ? "fancy" : "plain";
  s.gingerbread = ch(M.options.gingerbread);
  s.frieze = wch(M.options.frieze, [4, 2, 2, 2, 2]);
  s.siding = R() < 0.2 ? "brick" : "clapboard";
  s.gable_window = R() < 0.35 ? "round" : "arched";
  s.cross_style = R() < 0.4 ? "round" : "pointy";
  s.colours = presetColours(s.palette, s.siding);
  if (R() < 0.35) s.colours.porch = ch(M.swatches.porch);   // now and then a porch picked apart from the trim
  return fixUp(s);
}

async function set(patch, fix = true) {
  const sidingWas = state.siding;
  Object.assign(state, patch);
  if (patch.siding && patch.siding !== sidingWas && !patch.colours)   // brick walls default to a brick body
    state.colours = { ...state.colours, body: patch.siding === "brick" ? M.brick_body : M.palettes[state.palette].body };
  if (fix) fixUp(state);
  if (broken(state).length) { console.error("invalid spec", broken(state)); return; }
  syncUI();
  const n = ++buildN;
  $("busy").textContent = "loading parts…";
  const asm = await assemble({ ...state });
  if (n !== buildN) return;   // a newer build superseded this one
  $("busy").textContent = "";
  current = asm;
  show();
  placeKid();
  stats();
}

function show() {
  if (shown) scene.remove(shown);
  if (!current) return;
  shown = ui.explode ? explodedGroup(current) : current.group;
  scene.add(shown);
}

function stats() {
  const a = current;
  const named = M.recipes.find((r) => same(r.spec, state));
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  const rows = [
    ["triangles", `<span class="${a.tris > M.budget ? "warn" : ""}">${a.tris.toLocaleString()}${a.tris > M.budget ? " (over 5,000)" : ""}</span>`],
    ["draw calls", `${a.calls}${ui.explode ? " (merged)" : ""}`],
    ["parts", `${a.count}${a.mirrored ? ` (${a.mirrored} mirrored)` : ""}`],
    ["parts size", kb(a.bytes)],
    ["fetched so far", `${kb(bytesFetched)} · ${cache.size} files`],
  ];
  if (named) rows.push([`${named.slug} baked`, named.tris === a.tris ? `<span class="ok">${named.tris} tris ✓</span>` : `<span class="warn">${named.tris} ≠</span>`]);
  $("stats").innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
}

// ---------- street strip ----------
const scanvas = $("sc");
const srenderer = new THREE.WebGLRenderer({ canvas: scanvas, antialias: true });
srenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
srenderer.setClearColor(0xf3ede3);
const sscene = makeScene();
const scam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800);
const SPACING = 17;
let streetBuilt = false;
for (const r of M.recipes) { const s = document.createElement("span"); s.textContent = r.slug; $("labels").appendChild(s); }
async function buildStreet() {
  if (streetBuilt) return;
  streetBuilt = true;
  const n = M.recipes.length;
  await Promise.all(M.recipes.map(async (r, i) => {
    const asm = await assemble(r.spec);
    const g = new THREE.Group();
    g.add(asm.group);
    g.position.x = (i - (n - 1) / 2) * SPACING;
    g.rotation.y = -Math.atan2(VIEW_DIR.x, VIEW_DIR.z);   // each house turns to the renders' 3/4 view in its slot
    sscene.add(g);
  }));
  stats();
}
scanvas.onclick = (e) => {
  const i = Math.floor((e.offsetX / scanvas.clientWidth) * M.recipes.length);
  const r = M.recipes[i];
  if (r) set({ ...r.spec }, false);
};

// ---------- loop ----------
const clock = new THREE.Clock();
function fit(r, c) {
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.floor(w * r.getPixelRatio()) || c.height !== Math.floor(h * r.getPixelRatio())) r.setSize(w, h, false);
  return [w, h];
}
function frame() {
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  const [w, h] = fit(renderer, canvas);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, cam);
  if (ui.street) {
    const [sw, sh] = fit(srenderer, scanvas);
    const halfW = (M.recipes.length * SPACING) / 2, halfH = (halfW * sh) / sw;
    scam.left = -halfW; scam.right = halfW; scam.top = halfH; scam.bottom = -halfH;
    const look = new THREE.Vector3(0, 8.5 - halfH * 0.12, 0);   // a little room for the labels below
    scam.position.copy(look).add(new THREE.Vector3(0, 0.36, 1).normalize().multiplyScalar(300));
    scam.lookAt(look);
    scam.updateProjectionMatrix();
    srenderer.render(sscene, scam);
  }
  requestAnimationFrame(frame);
}

// self-check: the rules pick each recipe's exact parts
for (const r of M.recipes) {
  const key = (u) => `${u.file}${u.mirror ? "~m" : ""}`;
  const got = partsFor(r.spec).map((u) => key({ file: u.def.file, mirror: u.mirror })).sort().join(), want = r.parts.map(key).sort().join();
  if (got !== want) console.error(`${r.slug}: parts ${got} != manifest ${want}`);
}
window.__houses = { M, state, set, partsFor, get current() { return current; }, get street() { return streetBuilt; }, ui };
syncUI();
await set({}, false);
buildStreet();
frame();
window.__ready = true;
