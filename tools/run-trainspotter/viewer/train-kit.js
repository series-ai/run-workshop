// train-kit.js: lay track and run trains from the Trainspotter kit in three.js.
//
//   import { TrainKit } from './trainkit.js';
//   const kit = await TrainKit.load('assets/trainspotter/');            // the folder holding the GLB subfolders
//   const layout = await kit.layout(['track-curve-90-r192', 'track-curve-90-r192', 'track-straight-128', ...]);
//   scene.add(layout.group);
//   const train = await kit.consist([{ id: 'steam-express-green' }, { id: 'tender-express' }, { id: 'coach-classic' }]);
//   scene.add(train.group);
//   train.setTrack(layout, layout.edge(0));                             // front coupler at the start of step 0
//   train.speed = 75;                                                   // voxels per second
//   train.update(dt);                                                   // every frame
//   const fx = new TrainFx(scene); fx.attach(train);                    // steam, exhaust, sparks (trainfx.js)
//   fx.update(dt);                                                      // every frame, after train.update
//   train.go(120); train.brake();                                       // smooth speed changes
//
// Path maths live in trackpath.js (no dependencies), so a game on another
// engine can lay track and place cars with the same numbers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Layout, Runner, headingOf, placeConsist, rodPose, rotate } from './trackpath.js';

export * from './trackpath.js';
export { TrainFx, chuffsBetween, chuffInterval } from './train-fx.js';

const RAD = Math.PI / 180;
const SECTIONS = ['stock', 'track', 'civil', 'loads', 'structures', 'props', 'tokens'];

export class TrainKit {
  static async load(base, manifest = null) {
    manifest ??= await (await fetch(base + 'kit.json', { cache: 'no-store' })).json();
    return new TrainKit(base, manifest);
  }

  constructor(base, manifest) {
    this.base = base;
    this.m = manifest;
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  /** Catalogue entry for any model id. */
  entry(id) {
    for (const s of SECTIONS) if (this.m[s]?.[id]) return this.m[s][id];
    throw new Error(`unknown model ${id}`);
  }

  _gltf(file) {
    // ?v=<build stamp> (editor builds): a rebuilt kit never comes out of the browser cache
    if (!this.cache.has(file)) this.cache.set(file, this.loader.loadAsync(`${this.base}${file}${this.m.version ? `?v=${this.m.version}` : ''}`));
    return this.cache.get(file);
  }

  /** Any model as {group, entry, mixer, play(clip)}: props, stations, loads, single vehicles. */
  async model(id, colours = {}) {
    const e = this.entry(id);
    const g = await this._gltf(e.file);
    const group = g.scene.clone(true);
    this.recolour(group, e, colours);
    const mixer = new THREE.AnimationMixer(group);
    const play = (name) => {
      const clip = g.animations.find((a) => a.name === name);
      if (!clip) return null;
      mixer.stopAllAction();
      const a = mixer.clipAction(clip);
      a.setLoop(['open', 'close'].includes(name) ? THREE.LoopOnce : THREE.LoopRepeat); // one-shots in the prop vocabulary
      a.clampWhenFinished = true;
      a.reset().play();
      return a;
    };
    return { group, entry: e, mixer, play, clips: g.animations };
  }

  /** Swap a model's paint, trim and accent ramps: {paint: 'red', trim: 'bone', accent: 'gold'}. */
  recolour(group, entry, colours) {
    const swaps = ['paint', 'trim', 'accent'].filter((r) => entry[r] && colours[r] && colours[r] !== entry[r]).map((r) => [entry[r], colours[r]]);
    const done = new Map();
    group.traverse((o) => {
      if (!o.isMesh || !o.material?.map) return;
      // always repaint from the as-built material, so a model can be recoloured again and again
      const base = (o.userData.asBuilt ??= o.material);
      if (!swaps.length) { o.material = base; return; }
      if (!done.has(base)) done.set(base, this._repaint(base, swaps));
      o.material = done.get(base);
    });
  }

  // Recolour a pixel atlas: every texel of a source ramp shade becomes the same
  // shade of the target ramp. Atlases hold exact palette colours; a small
  // tolerance absorbs PNG rounding. Ported from the Wasteland Wheels helper.
  _repaint(material, swaps) {
    const mat = material.clone();
    const img = mat.map.image;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const map = [];
    for (const [from, to] of swaps) this.m.ramps[from].forEach((h, k) => map.push([rgb(h), rgb(this.m.ramps[to][k])]));
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      for (const [a, b] of map) {
        if (Math.abs(d[i] - a[0]) + Math.abs(d[i + 1] - a[1]) + Math.abs(d[i + 2] - a[2]) <= 3) {
          d[i] = b[0];
          d[i + 1] = b[1];
          d[i + 2] = b[2];
          break;
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    for (const k of ['flipY', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'colorSpace', 'generateMipmaps']) tex[k] = mat.map[k];
    mat.map = tex;
    return mat;
  }

  /**
   * Overhead wires for electric running: a catenary mast every `span` along every route of a
   * layout, on whichever side of the track is clear of other tracks (right first). Each mast
   * carries its own run of contact wire, so the runs join into one wire, a polygon round curves.
   * `skip(placedPiece)` leaves pieces out (tunnels, turntables). Returns a THREE.Group.
   */
  async catenary(layout, { span, offset, clearance = 30, skip = () => false } = {}) {
    const e = this.entry('catenary-mast');
    span ??= e.span ?? 64;
    offset ??= e.trackOffset ?? 34;
    const group = new THREE.Group();
    const edges = layout.edges().filter((ed) => !skip(layout.placed[ed.piece]));
    const samples = [];
    edges.forEach((ed, i) => {
      for (let u = 0; u <= ed.route.length; u += 8) samples.push({ p: layout.edgeAt(ed, u).p, i });
    });
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
    const masts = [];
    for (const [i, ed] of edges.entries()) {
      const n = Math.max(1, Math.round(ed.route.length / span));
      for (let k = 0; k < n; k++) {
        const { p, t } = layout.edgeAt(ed, (ed.route.length * (k + 0.5)) / n);
        const len = Math.hypot(t[0], t[2]);
        const right = [-t[2] / len, 0, t[0] / len];
        // the shared start of a switch's two routes already has a mast here: skip
        if (masts.some((m) => d2(m, p) < 16 && Math.abs(m[1] - p[1]) < 4)) continue;
        for (const side of [1, -1]) {
          const q = [p[0] + right[0] * offset * side, p[1], p[2] + right[2] * offset * side];
          const clear = samples.every((smp) => smp.i === i || d2(smp.p, q) > clearance ** 2);
          if (!clear) continue;
          const m = await this.model('catenary-mast');
          m.group.position.set(...q);
          m.group.rotation.y = (headingOf(t[0], t[2]) + (side > 0 ? 0 : 180)) * RAD;
          group.add(m.group);
          masts.push(p);
          break;
        }
      }
    }
    return group;
  }

  /** Lay track: see trackpath.js Layout for the step format. */
  async layout(steps, start) {
    const layout = new TrackLayout(this.m, steps, start);
    await layout._build(this);
    return layout;
  }

  /** A consist: [{id, flip?, paint?, trim?, accent?}, ...], front first. */
  async consist(cars) {
    const made = await Promise.all(cars.map(async (c) => {
      const m = await this.model(c.id, c);
      return new Car(m.group, m.entry, !!c.flip, m);
    }));
    return new Train(made, this.m.contract.railTop);
  }

  /** A trackside model (platform, station) placed beside a layout step like the track it serves, `along` voxels in. */
  async beside(layout, step, id, along = 0, colours = {}) {
    const m = await this.model(id, colours);
    const pc = layout.placed[step];
    const [x, z] = rotate(0, -along, pc.theta);
    m.group.position.set(pc.tx + x, pc.ty, pc.tz + z);
    m.group.rotation.y = pc.theta * RAD;
    return m;
  }
}

class TrackLayout extends Layout {
  async _build(kit) {
    this.group = new THREE.Group();
    this.models = await Promise.all(this.placed.map(async (pc) => {
      const m = await kit.model(pc.name);
      m.group.position.set(pc.tx, pc.ty, pc.tz);
      m.group.rotation.y = pc.theta * RAD;
      this.group.add(m.group);
      return m;
    }));
  }

  /** Set points or a turntable: plays the piece's own open/close clip (blades and lever)
   * and, for a turntable, turns its bridge to the state's angle. */
  setSwitch(i, state) {
    super.setSwitch(i, state);
    const m = this.models?.[i];
    if (!m) return;
    m.play(state);
    const tt = m.entry.turntable;
    if (tt) {
      const bridge = m.group.getObjectByName(tt.bridge);
      if (bridge) bridge.rotation.y = (tt.turn[state] ?? 0) * RAD;
    }
  }

  /** Advance the pieces' own animations (switch blades). */
  update(dt) {
    for (const m of this.models ?? []) m.mixer.update(dt);
  }
}

export class Car {
  constructor(group, entry, flip, model) {
    Object.assign(this, { group, entry, flip, model });
    this.root = group.children[0] ?? group;
    this.bogies = (entry.bogies ?? []).map((n) => group.getObjectByName(n));
    this.wheels = Object.entries(entry.wheels ?? {}).map(([n, r]) => ({ node: group.getObjectByName(n), r })).filter((w) => w.node);
    for (const w of this.wheels) w.rest = w.node.rotation.x;
    // steam motion: one or more rod groups (articulated engines have two), each with both sides
    this.rods = (entry.rods ?? []).flatMap((g) => ['l', 'r'].map((side) => {
      const nodes = Object.fromEntries(['rod', 'mainrod', 'crosshead'].map((k) => [k, group.getObjectByName(`${k}-${side}${g.tag ?? ''}`)]));
      return { side, group: g, r: entry.wheels[g.main], nodes,
        rest: Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, { p: n.position.clone(), rx: n.rotation.x }])) };
    }));
  }

  /** Play one of the model's own clips, whole (every part it moves). */
  play(name) {
    if (this.hasPanto && (name === 'open' || name === 'close')) this.pantoUp = name === 'open';
    return this.model.play(name);
  }

  get hasPanto() {
    let found = false;
    this.group.traverse((o) => { if (o.name.startsWith('panto')) found = true; });
    return found;
  }

  /** Raise (true) or lower (false) the pantograph, leaving the doors alone. */
  setPantograph(up) {
    this.pantoUp = !!up;
    return this._playParts(up ? 'open' : 'close', 'panto');
  }

  /** Open (true) or close (false) the doors, leaving the pantograph alone. */
  setDoors(open) {
    this.doorsOpen = !!open;
    return this._playParts(open ? 'open' : 'close', 'door-');
  }

  // The open / close clips move doors and pantographs together; these play the
  // part of a clip whose tracks animate nodes starting with `prefix`.
  _sub(name, prefix) {
    this._subs ??= new Map();
    const key = `${name}:${prefix}`;
    if (!this._subs.has(key)) {
      const clip = this.model.clips.find((c) => c.name === name);
      const tracks = clip ? clip.tracks.filter((t) => t.name.split('.')[0].startsWith(prefix)) : [];
      this._subs.set(key, tracks.length ? new THREE.AnimationClip(key, -1, tracks) : null);
    }
    return this._subs.get(key);
  }

  _playParts(name, prefix) {
    const clip = this._sub(name, prefix);
    if (!clip) return null;
    const other = this._sub(name === 'open' ? 'close' : 'open', prefix);
    if (other) this.model.mixer.existingAction(other)?.stop();
    const a = this.model.mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.reset().play();
    return a;
  }

  pose(p, rolled) {
    this.lastPose = p;
    this.group.position.set(...p.pos);
    this.group.rotation.set(0, p.yaw * RAD, 0, 'YXZ');
    this.group.rotation.x = p.pitch * RAD; // pitch is nose-up positive; +X rotation lifts a -Z nose
    this.bogies.forEach((b, i) => { if (b) b.rotation.y = p.bogieYaw[i] * RAD; });
    const sign = this.flip ? 1 : -1; // wheels roll backwards relative to a reversed car
    const roll = sign * rolled + (this.rollOffset ?? 0); // rollOffset keeps the wheels' angle when the train reverses
    for (const w of this.wheels) w.node.rotation.x = w.rest + roll / w.r;
    for (const { side, group, r, nodes, rest } of this.rods) {
      const q = rodPose(roll / r, group, r, side === 'l' ? 0 : Math.PI / 2);
      nodes.rod.position.set(rest.rod.p.x, rest.rod.p.y + q.rod[0], rest.rod.p.z + q.rod[1]);
      nodes.mainrod.position.set(rest.mainrod.p.x, rest.mainrod.p.y + q.main[0], rest.mainrod.p.z + q.main[1]);
      nodes.mainrod.rotation.x = rest.mainrod.rx + q.main[2];
      nodes.crosshead.position.set(rest.crosshead.p.x, rest.crosshead.p.y, rest.crosshead.p.z + q.crosshead);
    }
  }
}

export class Train {
  constructor(cars, railTop) {
    this.cars = cars;
    this.railTop = railTop;
    this.group = new THREE.Group();
    for (const c of cars) this.group.add(c.group);
    this.speed = 0; // voxels per second; set it directly, or use go() / brake() for a smooth change
    this.target = null; // speed go() / brake() are heading for
    this.acceleration = 40; // voxels/s² for go()
    this.braking = 70; // voxels/s² for brake()
    this.accel = 0; // smoothed change of speed, voxels/s² (effects read it)
    this.rolled = 0;
    this.prevRolled = 0;
  }

  /** Accelerate smoothly to `speed`. */
  go(speed) {
    this.target = speed;
  }

  /** Brake smoothly to a stand. */
  brake() {
    this.target = 0;
  }

  get length() {
    return this.cars.reduce((a, c) => a + c.entry.L, 0);
  }

  /** Distance along the track from the front coupler back to the rear coupler, as last placed. */
  get tailDistance() {
    const last = this.cars[this.cars.length - 1];
    const p = last?.lastPose;
    if (!p) return this.length;
    const { couplers: c, guides: g } = last.entry;
    return p.d[1] + (last.flip ? g[0] - c.f : c.r - g[1]);
  }

  /**
   * Turn the train round where it stands: the rear car leads, every car runs the other way
   * round (its flip toggles), and the cursor moves to the old rear coupler facing back along
   * the track the train came over. Speed drops to zero.
   */
  reverse() {
    if (!this.runner) return;
    this.runner = this.runner.reversed(this.tailDistance);
    this.runner.keep = this.length * 2 + 512;
    for (const c of this.cars) {
      const signOld = c.flip ? 1 : -1;
      c.rollOffset = (c.rollOffset ?? 0) + 2 * signOld * this.rolled;
      c.flip = !c.flip;
    }
    this.cars.reverse();
    this.speed = 0;
    this.target = 0;
    this.accel = 0;
    this.prevRolled = this.rolled;
    this.update(0);
  }

  /** Put the lead car's front coupler `u` along `edge` (from layout.edge()). The train backs onto the track behind it. */
  setTrack(layout, edge, u = 0) {
    this.layout = layout;
    this.runner = new Runner(layout, edge, u);
    this.runner.keep = this.length * 2 + 512;
    this.runner.backfill(this.length + 512);
    this.update(0);
  }

  update(dt) {
    if (!this.runner) return;
    const before = this.speed;
    if (this.target !== null) {
      const rate = this.target < this.speed ? this.braking : this.acceleration;
      const step = rate * dt;
      this.speed = Math.abs(this.target - this.speed) <= step ? this.target : this.speed + Math.sign(this.target - this.speed) * step;
    }
    const moved = this.runner.advance(Math.max(0, this.speed * dt));
    if (this.runner.stopped) this.speed = 0;
    if (dt > 0) this.accel += ((this.speed - before) / dt - this.accel) * Math.min(1, dt * 8);
    this.prevRolled = this.rolled;
    this.rolled += moved;
    const poses = placeConsist(this.runner, this.cars.map((c) => ({ couplers: c.entry.couplers, guides: c.entry.guides, flip: c.flip })), this.railTop);
    this.cars.forEach((c, i) => c.pose(poses[i], this.rolled));
    for (const c of this.cars) c.model.mixer.update(dt);
  }

  /** The whole consist as one static GLB, posed where it stands. */
  async exportGLB() {
    return new GLTFExporter().parseAsync(this.group, { binary: true });
  }
}
