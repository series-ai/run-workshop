// The kid builder: one kid from the avatar kit (kit/kidkit.js) to dress and recolour, or a crowd
// of random ones. The panel is drawn from kit.json straight away; the 3D fills in as pieces load.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadKidKit } from "./kit/kidkit.js";

const $ = (id) => document.getElementById(id);
const CH = ["main", "trim", "accent", "detail"];
const KIT = "./kit/";

// ---------- 3D ----------
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb9a98f, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 10, 7);
scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
cam.position.set(9, 7.5, 17);
const controls = new OrbitControls(cam, canvas);
controls.target.set(0, 2.6, 0);
controls.enableDamping = true;
controls.update();

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  cam.aspect = r.width / r.height;
  cam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

// ---------- state ----------
let kit = null, kid = null, crowd = [], clip = "idle", crowdOn = false;
const ui = {};  // slot -> { items: Map, ways: el, chans: [{row, name, sw, input}] }

// the panel's skeleton: every slot's section is laid out from kit.json before any GLB loads
const catalog = await (await fetch(KIT + "kit.json")).json();
buildPanel(catalog);
kit = await loadKidKit(KIT);
kid = await kit.makeKid(structuredClone(kit.looks["kid-spiky"]));
scene.add(kid.object);
kid.play(clip);
$("loading").style.opacity = 0;
syncPanel();

function chip(parent, text, onClick) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = onClick;
  parent.appendChild(b);
  return b;
}

function swatches(parent, colours, onPick) {
  return Object.entries(colours).map(([name, hex]) => {
    const i = document.createElement("i");
    i.style.background = hex;
    i.title = name;
    i.dataset.hex = hex;
    i.onclick = () => onPick(hex);
    parent.appendChild(i);
    return i;
  });
}

function buildPanel(cat) {
  for (const c of cat.clips) chip($("clips"), c, () => setClip(c)).dataset.clip = c;
  for (const slug of Object.keys(cat.looks)) chip($("looks"), slug.replace("kid-", ""), () => setLook(structuredClone(kit.looks[slug])));
  swatches($("skins"), Object.fromEntries(cat.skinTones.map((t, i) => [`tone ${i + 1}`, t])), (hex) => {
    kid?.setSkin(cat.skinTones.indexOf(hex));
    syncPanel();
  });
  for (const slot of cat.slots) {
    const sec = document.createElement("section");
    sec.className = "slot";
    sec.innerHTML = `<label>${slot[0].toUpperCase() + slot.slice(1)}</label>`;
    sec.dataset.slot = slot;
    const items = document.createElement("div");
    items.className = "row";
    sec.appendChild(items);
    const ways = document.createElement("div");
    ways.className = "row ways";
    sec.appendChild(ways);
    const u = (ui[slot] = { items: new Map(), ways, chans: [] });
    for (const name of Object.keys(cat.items[slot])) u.items.set(name, chip(items, name, () => wear(slot, name)));
    const sug = slot === "hair" ? { ...cat.suggest.hair, ...cat.suggest.cloth } : cat.suggest.cloth;
    for (const ch of CH) {  // a row per channel (unused ones are hidden; they sit below the chips, so no tapped chip moves)
      const row = document.createElement("div");
      row.className = "chan off";
      const name = document.createElement("span");
      const sw = document.createElement("div");
      sw.className = "sw";
      const input = document.createElement("input");
      input.type = "color";
      const pick = (hex) => { kid.paint(slot, ch, hex); syncPanel(); };
      swatches(sw, sug, pick);
      input.oninput = (e) => pick(e.target.value);
      row.append(name, sw, input);
      sec.appendChild(row);
      u.chans.push({ row, name, sw, input });
    }
    $("slots").appendChild(sec);
  }
  $("random").onclick = () => (crowdOn ? makeCrowd() : setLook(kit.randomLook()));
  $("crowd").onclick = () => toggleCrowd();
  $("copy").onclick = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(kid.toJSON()));
    $("copy").textContent = "Copied";
    setTimeout(() => ($("copy").textContent = "Copy look"), 1200);
  };
}

function syncPanel() {
  if (!kid) return;
  const look = kid.look;
  for (const i of $("skins").children) i.classList.toggle("on", i.dataset.hex === kit.skinTones[look.skin]);
  for (const b of $("clips").children) b.classList.toggle("on", b.dataset.clip === clip);
  for (const slot of kit.slots) {
    const u = ui[slot], cur = look[slot], it = kit.items[slot][cur.item];
    for (const [name, b] of u.items) b.classList.toggle("on", name === cur.item);
    u.ways.replaceChildren();
    for (const [w, cs] of Object.entries(it.ways)) {
      if (w === "-") continue;
      const b = chip(u.ways, w, () => { kid.paint(slot, w); syncPanel(); });
      b.classList.toggle("on", cs.every((c, k) => c === cur.colours[k]));
    }
    CH.forEach((ch, k) => {
      const c = u.chans[k], label = it.channels[ch];
      c.row.classList.toggle("off", !label);
      c.name.textContent = label || "";
      c.input.value = cur.colours[k];
      for (const i of c.sw.children) i.classList.toggle("on", i.dataset.hex === cur.colours[k]);
    });
  }
}

async function wear(slot, item) {
  if (crowdOn) toggleCrowd();
  await kid.wear(slot, item, kid.look[slot].item === item ? kid.look[slot].colours : undefined);
  syncPanel();
}

async function setLook(look) {
  if (crowdOn) toggleCrowd();
  const next = await kit.makeKid(look);
  next.object.position.copy(kid.object.position);
  scene.add(next.object);
  next.play(clip);
  kid.dispose();
  kid = next;
  syncPanel();
}

function setClip(c) {
  clip = c;
  for (const k of [kid, ...crowd]) k?.play(c);
  syncPanel();
}

async function makeCrowd() {
  for (const k of crowd) k.dispose();
  crowd = [];
  const n = innerWidth < 760 ? 9 : 16, cols = Math.ceil(Math.sqrt(n));
  const kids = await Promise.all(Array.from({ length: n }, () => kit.makeKid(kit.randomLook())));
  kids.forEach((k, i) => {
    k.object.position.set(((i % cols) - (cols - 1) / 2) * 4.2, 0, (Math.floor(i / cols) - (cols - 1) / 2) * 4.2);
    k.play(clip);
    k.action.time = Math.random() * k.action.getClip().duration;
    scene.add(k.object);
  });
  crowd = kids;
  $("crowdbar").textContent = `${n} random kids · ${n} draw calls`;
}

async function toggleCrowd() {
  crowdOn = !crowdOn;
  $("crowd").classList.toggle("on", crowdOn);
  kid.object.visible = !crowdOn;
  if (crowdOn) {
    controls.target.set(0, 2.6, 0);
    cam.position.set(20, 18, 34);
    await makeCrowd();
  } else {
    for (const k of crowd) k.dispose();
    crowd = [];
    $("crowdbar").textContent = "";
    cam.position.set(9, 7.5, 17);
  }
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  for (const k of [kid, ...crowd]) k?.update(dt);
  controls.update();
  renderer.render(scene, cam);
});
