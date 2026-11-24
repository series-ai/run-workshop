// Wasteland Wheels kit helper: assemble a vehicle from kit GLBs and drive its
// suspension, squash/stretch and wheels. Same motion model as kit/clips.py.
//
//   const kit = await WheelsKit.load('path/to/glb/');            // reads kit.json
//   const v = await kit.build({ body: 'icecream', front: 'monster', rear: 'monster',
//                               roof: 'cone', hood: null, stacks: 'stack', bumper: 'roo-bar',
//                               paint: 'sky', trim: 'bone', accent: 'red',   // any kit.json paint
//                               trailers: [{ type: 'tanker', wheels: 'steel', paint: 'red' }, { type: 'cattle' }] });  // trailer paint/trim/accent default to the truck's
//   const glb = await v.exportGLB();  // ArrayBuffer: the build with every clip baked
//   scene.add(v.group);
//   v.play('accelerate');   // idle | move | accelerate | brake ; v.drop() bounces it
//   v.update(dt);           // every frame
//
// front/rear: an axle module kind (monster, tractor, wire, steel) each, or
// 'treads' for both. Different drops tip the body so every wheel touches the ground.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const V_MOVE = 70; // voxels/s, as in clips.py

// Accelerate and brake: a spring-damper chasing the drive force's targets,
// the same springs as drop() (kit/clips.py has the identical sim).
const K_H = 90, C_H = 5, K_P = 140, C_P = 7, K_S = 200, C_S = 9, SUB = 8, FPS = 30;
function accelForce(t) {
  if (t < 0.1) return [-1.6 * Math.min(1, t / 0.06), -1 * Math.min(1, t / 0.06), 0.97, 0];
  const a = t < 0.34 ? 1 : Math.exp(-(t - 0.34) / 0.05);
  const v = V_MOVE * (1 - Math.exp(-(t - 0.1) / 0.16));
  return [-0.8 * a, 11 * a, 1 + 0.16 * a, v * (1 + 0.6 * a)];
}
function brakeForce(t) {
  const stop = 0.18, a = t < stop ? 1 : 0;
  return [-2.2 * a, -11 * a, 1 - 0.18 * a, V_MOVE * Math.max(0, 1 - t / stop) ** 1.2];
}
function simulate(force, T) {
  let h = 0, hv = 0, p = 0, pv = 0, s = 1, sv = 0;
  const dt = 1 / (FPS * SUB), out = [];
  for (let f = 0; f <= Math.round(T * FPS); f++) {
    const v = force(f / FPS)[3];
    out.push([h, p, (1 / Math.sqrt(s)) * (1 - 0.004 * hv), s, v]);
    for (let k = 0; k < SUB; k++) {
      const [th, tp, ts] = force((f * SUB + k) * dt);
      hv += (K_H * (th - h) - C_H * hv) * dt; h += hv * dt;
      pv += (K_P * (tp - p) - C_P * pv) * dt; p += pv * dt;
      sv += (K_S * (ts - s) - C_S * sv) * dt; s += sv * dt;
    }
  }
  return out;
}
const sampled = (frames) => (t) => {
  const x = Math.min(Math.max(t * FPS, 0), frames.length - 1), i = Math.min(Math.floor(x), frames.length - 2), u = x - i;
  return frames[i].map((a, k) => a + (frames[i + 1][k] - a) * u);
};

// t -> [heave, pitch°, sy, sz, ground speed]
export const MOTIONS = {
  idle: { T: 1, loop: true, f(t) {
    const fr = Math.round(t * 30);
    const shake = [0, 0.35, 0.12][fr % 3], lope = Math.floor(fr / 5) % 2 === 0 ? 0.25 : 0;
    return [shake + lope, 0.25 * (shake - 0.15), 1, 1, 0];
  } },
  move: { T: 1, loop: true, f(t) {
    let bump = 0, pitch = 0;
    for (const at of [0.1, 0.6]) { const u = t - at; if (u >= 0 && u < 0.3) bump += 1.4 * Math.sin((Math.PI * u) / 0.3) * Math.exp(-4 * u); }
    for (const [at, s] of [[0.18, 1], [0.68, -1]]) { const u = t - at; if (u >= 0 && u < 0.3) pitch += s * 1.2 * Math.sin((Math.PI * u) / 0.3); }
    return [bump, pitch, 1 - 0.02 * bump, 1, V_MOVE];
  } },
  accelerate: { T: 1.8, loop: false, next: 'move', f: sampled(simulate(accelForce, 1.8)) },
  brake: { T: 1.8, loop: false, next: 'idle', f: sampled(simulate(brakeForce, 1.8)) },
};

export class WheelsKit {
  // manifest: the kit catalogue (the packaged wheelskit.js has it built in;
  // the editor reads the build's kit.json)
  static async load(base, manifest = null) {
    manifest ??= await (await fetch(base + 'kit.json', { cache: 'no-store' })).json();
    return new WheelsKit(base, manifest);
  }

  constructor(base, manifest) {
    this.base = base;
    this.m = manifest;
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  _scene(path) {
    // ?v=<build stamp> (editor builds): a rebuilt kit never comes out of the browser cache
    if (!this.cache.has(path)) this.cache.set(path, this.loader.loadAsync(`${this.base}${path}${this.m.version ? `?v=${this.m.version}` : ''}`));
    return this.cache.get(path).then((g) => g.scene.clone(true));
  }

  async build(loadout) {
    const info = this.m.bodies[loadout.body];
    const cls = info.class, wb = this.m.wheelbase[cls];
    const treads = loadout.front === 'treads' || loadout.rear === 'treads';
    const [bodyScene, ...mods] = await Promise.all([
      this._scene(`bodies/body-${loadout.body}.glb`),
      ...(treads ? [this._scene(`wheels/treads-${cls}.glb`)]
        : [this._scene(`wheels/wheels-${loadout.front}-f.glb`), this._scene(`wheels/wheels-${loadout.rear}-r.glb`)]),
    ]);
    const group = new THREE.Group();
    const bodyRoot = bodyScene.children[0];
    const bodyMesh = bodyRoot.getObjectByName('body');
    const swaps = [[info.paint, loadout.paint], [info.trim, loadout.trim], [info.accent, loadout.accent]];
    bodyMesh.traverse((o) => { if (o.isMesh) this._repaint(o, swaps); });  // bikes: body is a node over scaled meshes
    group.add(bodyRoot);
    const sock = (n) => bodyRoot.getObjectByName(n);
    const local = (n) => { const s = sock(n); return s.position.clone().applyQuaternion(s.parent.quaternion).add(s.parent.position); };

    // modules hang from the body root (not the squashing mesh), counter-rotated upright
    const dropF = treads ? this.m.treads[cls].drop : this.m.wheels[loadout.front].drop;
    const dropR = treads ? dropF : this.m.wheels[loadout.rear].drop;
    // tip toward the smaller wheels (capped); the lower axle hangs on longer struts
    const lim = Math.sin(THREE.MathUtils.degToRad(this.m.maxPitch));
    const s = Math.max(-lim, Math.min(lim, (dropF - dropR) / wb));
    const pitch = Math.asin(s);
    const h = Math.max(dropF - (wb / 2) * s, dropR + (wb / 2) * s);
    const ext = { f: h + (wb / 2) * s - dropF, r: h - (wb / 2) * s - dropR };
    const modules = [];
    const attach = (scene, socket, z, spring, extra = 0) => {
      const root = scene.children[0];
      root.position.copy(local(socket));
      root.rotation.x = -pitch;
      bodyRoot.add(root);
      const ground = root.children.filter((c) => /^(axle|track)-/.test(c.name));
      const springs = root.children.filter((c) => c.name.startsWith('spring-'));
      const wheels = [];
      root.traverse((o) => {
        if (!o.name.startsWith('wheel-')) return;
        const box = new THREE.Box3().setFromObject(o, true);
        o.updateMatrixWorld(true);
        wheels.push({ node: o, r: Math.max(1, (box.max.y - box.min.y) / 2), rest: o.quaternion.clone() });
      });
      modules.push({ root, z, spring, extra, ground: ground.map((g) => ({ node: g, y: g.position.y })), springs, wheels });
    };
    if (treads) attach(mods[0], 'socket-belly', 0, 0);
    else {
      attach(mods[0], 'socket-axle-f', -wb / 2, this.m.wheels[loadout.front].spring, ext.f);
      attach(mods[1], 'socket-axle-r', wb / 2, this.m.wheels[loadout.rear].spring, ext.r);
      if (sock('socket-axle-s')) {  // a sidecar wheel: the rear wheel's kind, as a single
        const kind = loadout.rear.startsWith('mono-') ? loadout.rear : `mono-${loadout.rear}`;
        const z = local('socket-axle-s').z;
        attach(await this._scene(`wheels/wheels-${kind}-t.glb`), 'socket-axle-s', z, 0, h - z * s - this.m.wheels[kind].drop);
      }
    }
    bodyRoot.position.set(0, h, 0);
    bodyRoot.rotation.x = pitch;

    // bolt-ons ride the body mesh, so they squash with it
    const parts = [];
    const SLOTS = { roof: 'socket-roof', hood: 'socket-hood', bumper: 'socket-front' };
    for (const [slot, socket] of Object.entries(SLOTS)) {
      if (loadout[slot] && sock(socket)) parts.push([`parts/${slot}-${loadout[slot]}.glb`, socket]);
    }
    if (loadout.stacks) for (const s of ['l', 'r']) if (sock(`socket-stack-${s}`)) parts.push([`parts/stacks-${loadout.stacks}.glb`, `socket-stack-${s}`]);
    const scenes = await Promise.all(parts.map(([p]) => this._scene(p)));
    scenes.forEach((s, i) => {
      const part = s.children[0];
      const roles = this.m.partPaint[parts[i][0].slice(6, -4)] || {};  // parts/<slot>-<name>.glb
      const swaps = Object.entries(roles).map(([role, ramp]) => [ramp, loadout[role]]);
      part.traverse((o) => { if (o.isMesh) this._repaint(o, swaps); });
      if (parts[i][1].startsWith('socket-stack-')) part.traverse((o) => { o.name = parts[i][1].slice(-1) + '-' + o.name; });  // unique names for export
      part.scale.setScalar(info.partScale || 1);  // bolt-ons on a bike shrink with it
      sock(parts[i][1]).add(part);
    });

    const v = new Vehicle(group, bodyRoot, bodyMesh, modules, h, pitch);
    // a single wheel on both axles: a motorcycle (it leans into turns rather than rolling out)
    v.isBike = !treads && !sock('socket-axle-s') && !!this.m.wheels[loadout.front].single && !!this.m.wheels[loadout.rear].single;
    await this._hitchTrailers(v, loadout, sock('socket-hitch'));
    return v;
  }
}

// Trailers hitched in a line: each pivots on its own axle so its coupler
// meets the hitch in front; a riser post on the drawbar makes up the height
// difference at rest, so every trailer sits level whatever pulls it.
WheelsKit.prototype._hitchTrailers = async function (v, loadout, hitch) {
  const list = loadout.trailers || [];
  const loaded = await Promise.all(list.map((t) => Promise.all([this._scene(`bodies/trailer-${t.type}.glb`), this._scene(`wheels/wheels-${t.wheels || 'steel'}-t.glb`)])));
  v.pose(0, 0, 1, 1, 0);
  let prev = hitch;
  loaded.forEach(([ts, ms], i) => {
    const t = list[i], info = this.m.trailers[t.type];
    const root = ts.children[0];
    const body = root.getObjectByName('body');
    // a trailer's own colours, else the truck's
    this._repaint(body, [[info.paint, t.paint || loadout.paint], [info.trim, t.trim || loadout.trim], [info.accent, t.accent || loadout.accent]]);
    const at = (n) => { const s = root.getObjectByName(n); return s.position.clone().applyQuaternion(s.parent.quaternion).add(s.parent.position); };
    const mod = ms.children[0];
    mod.position.copy(at('socket-axle-t'));
    root.add(mod);
    const coupler = at('socket-coupler'), riser = root.getObjectByName('riser');
    const wheels = [];
    mod.traverse((o) => {
      if (!o.name.startsWith('wheel-')) return;
      const box = new THREE.Box3().setFromObject(o, true);
      wheels.push({ node: o, r: Math.max(1, (box.max.y - box.min.y) / 2), rest: o.quaternion.clone() });
    });
    const tag = `t${i + 1}-`;
    root.traverse((o) => { o.name = tag + o.name; });  // unique names for export
    v.group.add(root);
    const drop = this.m.wheels[t.wheels || 'steel'].drop;
    // rest: level, coupler on the hitch -> riser length and trailer position
    v.group.updateMatrixWorld(true);
    const H = v.group.worldToLocal(prev.getWorldPosition(new THREE.Vector3()));
    const s = (H.y - drop - coupler.y) / this.m.riser;
    riser.scale.y = Math.abs(s) < 0.05 ? 0.05 : s;
    const tr = { root, mod, wheels, drop, prev, c: new THREE.Vector3(0, coupler.y + this.m.riser * s, coupler.z), hitch: root.getObjectByName(tag + 'socket-hitch') };
    v.trailers.push(tr);
    v.placeTrailer(tr);
    prev = tr.hitch;
  });
};

// Recolour a body's pixel atlas: every texel of a source paint ramp shade
// becomes the same shade of the target ramp (colours are exact palette
// entries; a small tolerance absorbs PNG rounding).
WheelsKit.prototype._repaint = function (mesh, swaps) {
  swaps = swaps.filter(([from, to]) => to && to !== from && this.m.ramps[from] && this.m.paints[to]);
  if (!swaps.length) return;
  const mat = mesh.material.clone();
  const img = mat.map.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const map = [];
  for (const [from, to] of swaps) this.m.ramps[from].forEach((h, k) => map.push([rgb(h), rgb(this.m.paints[to][k])]));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    for (const [a, b] of map) {
      if (Math.abs(d[i] - a[0]) + Math.abs(d[i + 1] - a[1]) + Math.abs(d[i + 2] - a[2]) <= 3) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; break; }
    }
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  for (const k of ['flipY', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'colorSpace', 'generateMipmaps']) tex[k] = mat.map[k];
  mat.map = tex;
  mesh.material = mat;
};

class Vehicle {
  constructor(group, bodyRoot, bodyMesh, modules, h, pitch) {
    Object.assign(this, { group, bodyRoot, bodyMesh, modules, h, pitch });
    this.trailers = [];
    this.clip = 'idle';
    this.t = 0;
    this.rolled = 0;
    this.bounce = { y: 0, v: 0, p: 0, w: 0 };
  }

  play(name) { this.clip = name; this.t = 0; }

  drop(height = 14) { this.bounce.y = height; this.bounce.v = 0; this.bounce.w = -40; }

  update(dt) {
    const mo = MOTIONS[this.clip];
    this.t += dt;
    if (this.t >= mo.T) {
      if (mo.loop) this.t %= mo.T;
      else { this.clip = mo.next; this.t = 0; }
    }
    let [o, p, sy, sz, v] = MOTIONS[this.clip].f(this.t);
    // live drop: a spring-damper on heave and pitch, gravity-stiff and lightly damped
    const b = this.bounce;
    b.v += (-90 * b.y - 5 * b.v) * dt; b.y += b.v * dt;
    b.w += (-140 * b.p - 7 * b.w) * dt; b.p += b.w * dt;
    o += b.y; p += b.p;
    sy *= 1 + Math.max(-0.12, Math.min(0.08, b.v * 0.004)); // stretch rising, squash landing
    this.rolled += v * dt;
    this.pose(o, p, sy, sz, this.rolled);
  }

  // Put every part where the motion says: body heave/pitch/squash, upright
  // modules, axles on the ground, springs stretched, wheels rolled.
  // roll: lean in degrees (+ lifts the vehicle's left side, +x).
  pose(o, p, sy, sz, rolled, roll = 0) {
    const sx = 1 / Math.sqrt(sy * sz);
    const pr = this.pitch + THREE.MathUtils.degToRad(p), rr = THREE.MathUtils.degToRad(roll);
    this.bodyRoot.position.y = this.h + o;
    this.bodyRoot.rotation.set(pr, 0, rr);
    this.bodyMesh.scale.set(sx, sy, sz);
    const upright = this.bodyRoot.quaternion.clone().invert();
    for (const m of this.modules) {
      m.root.quaternion.copy(upright);
      const rise = o - m.z * (Math.sin(pr) - Math.sin(this.pitch)) + m.extra;
      for (const g of m.ground) g.node.position.y = g.y - rise;
      if (m.spring) for (const s of m.springs) s.scale.y = Math.max(0.2, (m.spring + rise + s.position.x * Math.sin(rr)) / m.spring);
      for (const w of m.wheels) w.node.quaternion.copy(w.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -rolled / w.r));
    }
    for (const t of this.trailers) {
      this.placeTrailer(t);
      for (const w of t.wheels) w.node.quaternion.copy(w.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -rolled / w.r));
    }
  }

  // Pitch a trailer about its axle so its coupler sits on the hitch in front.
  placeTrailer(t) {
    this.group.updateMatrixWorld(true);
    const H = this.group.worldToLocal(t.prev.getWorldPosition(new THREE.Vector3()));
    const a = t.c.y, b = -t.c.z, k = H.y - t.drop;  // a cos(th) + b sin(th) = k
    const R = Math.hypot(a, b), phi = Math.atan2(b, a);
    const d = Math.acos(Math.max(-1, Math.min(1, k / R)));
    const th = Math.abs(phi - d) < Math.abs(phi + d) ? phi - d : phi + d;
    // straight behind the hitch, then swung about it by the trailer's yaw (racing)
    const off = new THREE.Vector3(0, t.drop - H.y, -(t.c.y * Math.sin(th) + t.c.z * Math.cos(th))).applyAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw || 0);
    t.root.rotation.set(th, t.yaw || 0, 0, 'YXZ');
    t.root.position.copy(H).add(off);
    t.mod.rotation.x = -th;
  }

  // Racing: no clip; the drive force from the track (speed, forward and
  // sideways acceleration in voxels/s and voxels/s²) drives spring-dampers on
  // pitch, roll and length squash, over the road-bump heave of `move`.
  drive(dt, speed, aLong, aLat) {
    const d = this.driveState || (this.driveState = { p: 0, pv: 0, r: 0, rv: 0, s: 1, sv: 0, t: 0 });
    const clamp = (x, a) => Math.max(-a, Math.min(a, x));
    const tp = clamp(aLong * 0.03, 11), tr = this.isBike ? 0 : clamp(-aLat * 0.02, 8), ts = 1 + clamp(aLong * 0.0005, 0.14);
    for (let k = 0; k < 4; k++) {
      const h = dt / 4;
      d.pv += (K_P * (tp - d.p) - C_P * d.pv) * h; d.p += d.pv * h;
      d.rv += (K_P * (tr - d.r) - C_P * d.rv) * h; d.r += d.rv * h;
      d.sv += (K_S * (ts - d.s) - C_S * d.sv) * h; d.s += d.sv * h;
    }
    d.t = (d.t + dt * Math.min(1.6, speed / V_MOVE)) % 1;
    const [bump, bp] = MOTIONS.move.f(d.t);
    const b = this.bounce;
    b.v += (-90 * b.y - 5 * b.v) * dt; b.y += b.v * dt;
    this.rolled += speed * dt;
    this.pose(bump * Math.min(1, speed / V_MOVE) + b.y, d.p + bp, 1 / Math.sqrt(d.s), d.s, this.rolled, d.r);
  }

  // Sample every clip at `fps` into three.js AnimationClips (TRS tracks on
  // the moving nodes), then put the vehicle back at rest.
  bake(fps = 30) {
    const nodes = [this.bodyRoot, this.bodyMesh];
    for (const m of this.modules) nodes.push(m.root, ...m.ground.map((g) => g.node), ...m.springs, ...m.wheels.map((w) => w.node));
    for (const t of this.trailers) nodes.push(t.root, t.mod, ...t.wheels.map((w) => w.node));
    const clips = [];
    for (const [name, mo] of Object.entries(MOTIONS)) {
      const n = Math.round(mo.T * fps);
      const times = [], rec = nodes.map(() => ({ p: [], q: [], s: [] }));
      let rolled = 0, prev = mo.f(0)[4];
      for (let f = 0; f <= n; f++) {
        const t = f / fps;
        const [o, p, sy, sz, v] = mo.f(t);
        if (f) rolled += ((prev + v) / 2) / fps;
        prev = v;
        if (name === 'move') rolled = (V_MOVE * t);  // whole turns per loop are not exact per wheel; keep it continuous
        this.pose(o, p, sy, sz, rolled);
        times.push(t);
        nodes.forEach((nd, i) => { rec[i].p.push(...nd.position.toArray()); rec[i].q.push(...nd.quaternion.toArray()); rec[i].s.push(...nd.scale.toArray()); });
      }
      const tracks = [];
      nodes.forEach((nd, i) => {
        for (let k = 4; k < rec[i].q.length; k += 4) {  // keep quaternions sign-continuous
          const dot = rec[i].q[k] * rec[i].q[k - 4] + rec[i].q[k + 1] * rec[i].q[k - 3] + rec[i].q[k + 2] * rec[i].q[k - 2] + rec[i].q[k + 3] * rec[i].q[k - 1];
          if (dot < 0) for (let c = 0; c < 4; c++) rec[i].q[k + c] *= -1;
        }
        tracks.push(new THREE.VectorKeyframeTrack(`${nd.name}.position`, times, rec[i].p));
        tracks.push(new THREE.QuaternionKeyframeTrack(`${nd.name}.quaternion`, times, rec[i].q));
        tracks.push(new THREE.VectorKeyframeTrack(`${nd.name}.scale`, times, rec[i].s));
      });
      clips.push(new THREE.AnimationClip(name, mo.T, tracks));
    }
    this.pose(0, 0, 1, 1, 0);
    this.rolled = 0;
    return clips;
  }

  async exportGLB() {
    const clip = this.clip, t = this.t;
    const animations = this.bake();
    const glb = await new GLTFExporter().parseAsync(this.group, { binary: true, animations });
    this.clip = clip; this.t = t;
    return glb;
  }
}
