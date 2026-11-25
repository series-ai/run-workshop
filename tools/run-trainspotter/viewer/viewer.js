// viewer.js: the Trainspotter viewer. Pick a railway, run a train, set the points, the time of
// day and the look. viewer/index.html runs it on the build output; games/trainspotter runs it on
// the published pack.
//
//   import { startViewer } from './viewer.js';   // plus viewer.css
//   await startViewer({ kitBase, catalogue, soundsBase });
//
// kitBase: the folder holding the model folders (railway-track/, steam-locomotives/, ...);
// catalogue: kit.json, when it is not at kitBase; soundsBase: the folder of sound files.
// URL options: ?layout=, ?train=, ?quality=High|Medium|Low, ?time=0..1.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrainKit, TrainFx } from './train-kit.js';
import { LAYOUTS, addTrain, availableConsists, buildDemo, layoutTrains, needsWires, wires } from './demo.js';
import { Pretty } from './pretty.js';
import { TrainAudio } from './train-audio.js';
import { Operations } from './driver.js';

const UI = `
<div id="ui">
  <header id="toggle">
    <span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 20l-2 2M15 20l2 2M8 16v2M16 16v2"/><circle cx="9" cy="13" r="0.6" fill="#fff"/><circle cx="15" cy="13" r="0.6" fill="#fff"/></svg></span>
    <span class="titles"><h1>Trainspotter</h1><small>voxel railway kit</small></span>
    <span id="caret">▾</span>
  </header>
  <details open><summary>Railway and train</summary><div class="rows">
    <label>Railway <select id="layout"></select></label>
    <span id="about"></span>
    <label>Train <select id="consist"></select></label>
    <label>Livery <select id="livery"><option value="">as built</option></select></label>
    <label>Lead paint</label><div class="sw" id="paint"></div>
  </div></details>
  <details open><summary>Driving</summary><div class="rows">
    <label class="range"><span>Speed</span><input id="speed" type="range" min="0" max="200" value="75"></label>
    <div class="two"><button id="brake" class="primary">Brake</button><button id="horn">Horn</button></div>
    <div class="two"><button id="points">Points: straight</button><button id="signal">Signal: danger</button></div>
    <label><span>Sound</span><input id="sound" type="checkbox" checked></label>
    <label><span>Birds and breeze</span><input id="ambience" type="checkbox" checked></label>
    <label><span>Follow train</span><input id="follow" type="checkbox"></label>
  </div></details>
  <details open><summary>Look</summary><div class="rows">
    <label class="range"><span>Time of day</span><input id="tod" type="range" min="0" max="1" step="0.01" value="0.12"></label>
    <div class="seg"><button data-preset="Morning">Morning</button><button data-preset="Noon">Noon</button><button data-preset="Golden hour">Golden</button><button data-preset="Dusk">Dusk</button><button data-preset="Night">Night</button></div>
    <label class="range"><span>Tilt-shift</span><input id="tilt" type="range" min="0" max="4" step="0.05" value="2.2"></label>
    <label class="range"><span>Focus band</span><input id="band" type="range" min="0.02" max="0.45" step="0.01" value="0.1"></label>
    <span class="hint">Tap or click the scene to focus there.</span>
    <label><span>Grass and flowers</span><input id="grass" type="checkbox" checked></label>
    <label><span>Dust in the air</span><input id="dust" type="checkbox" checked></label>
    <label><span>Shadows</span><input id="shadows" type="checkbox" checked></label>
    <label>Quality <select id="quality"><option>High</option><option>Medium</option><option>Low</option></select></label>
  </div></details>
  <details><summary>Effects and wires</summary><div class="rows">
    <label><span>Steam, smoke and sparks</span><input id="fx" type="checkbox" checked></label>
    <label class="range"><span>Effect amount</span><input id="fxk" type="range" min="0" max="2" step="0.1" value="1"></label>
    <label>Overhead wires <select id="wires"><option value="auto">for electrics</option><option value="on">on</option><option value="off">off</option></select></label>
  </div></details>
  <span id="status"></span>
</div>
`;

export async function startViewer({ kitBase = '../out/glb/', catalogue = null, soundsBase = '../out/sounds/ogg/' } = {}) {
  document.body.insertAdjacentHTML('afterbegin', UI);
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 8, 30000); // near 8 keeps depth precise enough for flat strips (rivers, roads) just above the ground
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.06; // never under the ground
  controls.minDistance = 60;
  controls.maxDistance = 9000;

  const kit = await TrainKit.load(kitBase, catalogue);
  const small = matchMedia('(max-width: 720px), (pointer: coarse)').matches; // phones and tablets
  const pretty = new Pretty(renderer, scene, camera, { kit, controls, quality: params.get('quality') ?? (small ? 'Medium' : 'High') });
  if (small) $('ui').classList.add('closed'); // the railway first; the panel slides up from the bottom
  $('quality').value = pretty.quality;
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    pretty.resize();
  });


  const fx = new TrainFx(scene);
  // sound effects (the pack's audio folder, Trainspotter Audio; built into out/sounds/ogg by sounds/process.py)
  const audio = new TrainAudio({ base: soundsBase });
  const CONSISTS = availableConsists(kit);
  let world = null; // the railway: {group, layout, signal, plan, trains, wires, ops}
  let train = null, token = 0, running = true;
  window.viewer = { fx, audio, pretty, camera, controls, renderer, get train() { return train; }, get world() { return world; } }; // for scripted checks

  const allTrains = () => [train, ...(world?.trains ?? [])].filter(Boolean);
  function rebuildOps() {
    if (!world) return;
    world.ops = null;
    if (!Operations) return;
    try { world.ops = new Operations(world, { trains: allTrains(), plan: world.plan, kit, main: train }); } catch (e) { console.warn('operations', e); }
    world.ops?.on?.((name, t) => audio.event(name, t));
    for (const [t] of audio.trains) if (!allTrains().includes(t)) audio.detach(t);
    for (const t of allTrains()) audio.attach(t);
  }
  async function updateWires() {
    const mode = $('wires').value;
    const want = mode === 'on' || (mode === 'auto' && needsWires(allTrains()));
    if (want && !world.wires) {
      const w = world;
      w.wires = (await wires(kit, w.layout, w.plan)) ?? new THREE.Group();
      w.group.add(w.wires);
    }
    if (world.wires) world.wires.visible = want;
  }

  /** A low three-quarter view over the railway, like crouching at the edge of a train-set board. */
  function frame(box) {
    const centre = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3()).length();
    controls.target.copy(centre);
    const tall = Math.max(1, 1.25 / camera.aspect); // pull back on portrait screens, so the railway still fits across
    camera.position.copy(centre).add(new THREE.Vector3(-0.62, 0.36, 0.7).normalize().multiplyScalar(span * 0.82 * tall));
    camera.far = Math.max(30000, span * 8);
    camera.updateProjectionMatrix();
  }

  async function setLayout(name) {
    pretty.focusOn(null);
    const my = ++token;
    const group = new THREE.Group();
    const built = await buildDemo(kit, group, { name, grass: $('grass').checked ? pretty.quality : null });
    const trains = await layoutTrains(kit, group, built.layout, built.plan);
    if (my !== token) return;
    if (world) { scene.remove(world.group); for (const t of world.trains) fx.detach(t); }
    if (train) { fx.detach(train); train = null; }
    fx.clear();
    world = { group, ...built, trains, wires: null, ops: null };
    scene.add(group);
    for (const t of trains) fx.attach(t);
    $('about').textContent = built.plan.about ?? '';
    const box = new THREE.Box3().setFromObject(built.layout.group);
    pretty.fit(box);
    frame(box);
    pointsOpen = false;
    $('points').textContent = 'Points: straight';
    await setConsist($('consist').value);
  }

  async function setConsist(name, colours = {}) {
    return setConsistCars(CONSISTS[name].map((c, i) => (i === 0 ? { ...c, ...colours } : c)));
  }
  async function setConsistCars(cars) {
    // the same cars in new colours: repaint them where they are, so the train keeps its place
    const same = train && train.spec?.length === cars.length && cars.every((c, i) => c.id === train.spec[i].id && !!c.flip === !!train.spec[i].flip && c.load === train.spec[i].load);
    if (same) {
      cars.forEach((c, i) => kit.recolour(train.cars[i].group, train.cars[i].entry, c));
      train.spec = cars;
      pretty.adopt(train.group);
      return;
    }
    const my = ++token;
    const w = world;
    const t = await addTrain(kit, w.group, w.layout, cars, w.plan.main.step, w.plan.main.u);
    if (my !== token || w !== world) { w.group.remove(t.group); return; }
    if (train) { w.group.remove(train.group); fx.detach(train); }
    train = t;
    train.spec = cars;
    fx.attach(train);
    running = true;
    $('brake').textContent = 'Brake';
    train.go(Number($('speed').value));
    pretty.adopt(train.group);
    rebuildOps();
    await updateWires();
  }

  const lay = $('layout');
  for (const name of Object.keys(LAYOUTS)) lay.add(new Option(name, name));
  if (params.get('layout') && LAYOUTS[params.get('layout')]) lay.value = params.get('layout');
  lay.onchange = () => setLayout(lay.value);
  const sel = $('consist');
  for (const name of Object.keys(CONSISTS)) sel.add(new Option(name, name));
  if (params.get('train') && CONSISTS[params.get('train')]) sel.value = params.get('train');
  const liv = $('livery');
  function liveries() {
    liv.length = 1;
    const lead = kit.entry(CONSISTS[sel.value][0].id);
    for (const name of Object.keys(lead.liveries ?? {})) liv.add(new Option(name, name));
  }
  liv.onchange = () => {
    // a named preset recolours every car that has it
    const name = liv.value;
    setConsistCars(CONSISTS[sel.value].map((c) => ({ ...c, ...((name && kit.entry(c.id).liveries?.[name]) || {}) })));
  };
  sel.onchange = () => { liveries(); for (const o of sw.children) o.classList.remove('on'); setConsist(sel.value); };
  $('speed').oninput = (e) => { if (train && running) train.go(Number(e.target.value)); };
  $('brake').onclick = (e) => {
    running = !running;
    if (running) train?.go(Number($('speed').value));
    else train?.brake();
    e.target.textContent = running ? 'Brake' : 'Go';
  };
  $('fx').onchange = (e) => { fx.intensity = e.target.checked ? Number($('fxk').value) : 0; if (!e.target.checked) fx.clear(); };
  $('fxk').oninput = (e) => { if ($('fx').checked) fx.intensity = Number(e.target.value); };
  $('wires').onchange = () => updateWires();
  let pointsOpen = false;
  $('points').onclick = (e) => {
    // every set of points on the railway (not the turntable) throws together
    pointsOpen = !pointsOpen;
    world.layout.placed.forEach((pc, i) => {
      if (pc.isSwitch && pc.spec.kind !== 'turntable') world.layout.setSwitch(i, pointsOpen ? 'open' : 'close');
    });
    e.target.textContent = `Points: ${pointsOpen ? 'diverging' : 'straight'}`;
  };
  let clear = false;
  $('signal').onclick = (e) => {
    clear = !clear;
    world.signal?.play(clear ? 'open' : 'close');
    e.target.textContent = `Signal: ${clear ? 'clear' : 'danger'}`;
  };
  const sw = $('paint');
  for (const name of kit.m.swatches) {
    const b = document.createElement('b');
    b.style.background = kit.m.ramps[name][4];
    b.title = name;
    b.onclick = () => {
      for (const o of sw.children) o.classList.toggle('on', o === b);
      setConsist(sel.value, { paint: name });
    };
    sw.appendChild(b);
  }
  // the look
  $('tod').oninput = (e) => pretty.setTime(Number(e.target.value));
  for (const b of document.querySelectorAll('[data-preset]')) {
    b.onclick = () => { pretty.setPreset(b.dataset.preset); $('tod').value = pretty.time; $('tod').show?.(); };
  }
  $('quality').onchange = (e) => pretty.setQuality(e.target.value);
  $('tilt').oninput = (e) => pretty.setTilt(Number(e.target.value));
  $('band').oninput = (e) => pretty.setTiltBand(Number(e.target.value));
  pretty.setTilt(Number($('tilt').value));
  pretty.setTiltBand(Number($('band').value));
  $('dust').onchange = (e) => pretty.setDust(e.target.checked);
  $('grass').onchange = (e) => { if (world?.grass) world.grass.mesh.visible = e.target.checked; else if (e.target.checked) setLayout(lay.value); };
  $('shadows').onchange = (e) => pretty.setShadows(e.target.checked);
  $('toggle').onclick = () => $('ui').classList.toggle('closed');
  if (params.get('time')) { pretty.setTime(Number(params.get('time'))); $('tod').value = pretty.time; }
  // a number beside every slider
  for (const el of document.querySelectorAll('#ui input[type=range]')) {
    const out = document.createElement('output');
    el.after(out);
    const places = Math.min(2, (String(el.step || 1).split('.')[1] ?? '').length);
    el.show = () => (out.textContent = Number(el.value).toFixed(places));
    el.addEventListener('input', el.show);
    el.show();
  }

  $('sound').onchange = (e) => (e.target.checked ? audio.start() : audio.stop());
  $('ambience').onchange = (e) => { audio.ambience = e.target.checked; };
  const firstGesture = () => { if ($('sound').checked && !audio.enabled) audio.start(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, firstGesture, { once: true, capture: true });
  // click (not drag) on the railway: the tilt-shift focus eases to that spot; on a train it rides
  // along with the car; on the sky it goes back to the orbit target
  const ray = new THREE.Raycaster();
  let press = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { press = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!press || e.button !== 0 || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5 || performance.now() - press.t > 350 || !world) return;
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hit = ray.intersectObject(world.group, true).find((h) => h.object.isMesh && shown(h.object));
    if (!hit) { pretty.focusOn(null); return; }
    const car = allTrains().flatMap((t) => t.cars).find((c) => { let o = hit.object; while (o && o !== c.group) o = o.parent; return o; });
    pretty.focusOn(hit.point, car?.group ?? null);
  });
  $('horn').onclick = async () => { if (!audio.enabled) { $('sound').checked = true; await audio.start(); } if (train) audio.horn(train); };
  liveries();
  await setLayout(lay.value);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (world) {
      world.signal?.mixer.update(dt);
      world.layout.update(dt);
      world.ops?.update?.(dt);
      for (const t of world.trains) t.update(dt);
    }
    if (train) {
      train.update(dt);
      $('status').textContent = train.runner.stopped ? 'Stopped at the end of the line' : '';
      if ($('follow').checked) controls.target.lerp(train.cars[0].group.position, 0.08);
    }
    world?.grass?.tick(dt);
    audio.daylight = 1 - (pretty.p?.windows ?? 0) / 0.6; // birds by day, quiet at night
    fx.update(dt);
    audio.update(dt, camera.position);
    controls.update();
    pretty.render(dt);
  });
  return window.viewer;
}
