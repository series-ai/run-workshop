// Figure-8 dirt track and racers for the Wasteland Wheels editor.
//
//   const track = new Figure8();            scene.add(track.group);
//   const race = new Race(track, vehicles); race.update(dt) every frame
//
// Racers brake into the loops and power out of them (that drives the body's
// pitch, lean and squash through Vehicle.drive), keep to their own lane, and
// tow their trailers, which swing in behind like real trailers (each axle
// follows its hitch at a fixed distance).
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class Figure8 {
  constructor({ radius = 430, spread = 760, road = 300 } = {}) {
    // Classic figure 8: two loops of `radius` centred at z = +-spread, joined by
    // two straights that cross at the origin. Order: straight Y (T2 -> T3),
    // far loop, straight X (T4 -> T1), near loop; the two straights go in
    // separate meshes so the crossing doesn't z-fight.
    const R = radius, D = spread, sb = R / D, cb = Math.sqrt(1 - sb * sb);
    const T1 = [D * cb * sb, D * cb * cb], T2 = [-T1[0], T1[1]], T3 = [T1[0], -T1[1]], T4 = [-T1[0], -T1[1]];
    const pts = [], step = 3;
    const line = (a, b) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
      for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(a[0] + ((b[0] - a[0]) * i) / n, 0, a[1] + ((b[1] - a[1]) * i) / n));
    };
    const arc = (cz, a0, a1) => {
      const n = Math.ceil((Math.abs(a1 - a0) * R) / step);
      for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(new THREE.Vector3(R * Math.cos(a), 0, cz + R * Math.sin(a))); }
    };
    const ang = (p, cz) => Math.atan2(p[1] - cz, p[0]);
    line(T2, T3);
    arc(-D, ang(T3, -D), ang(T4, -D) - 2 * Math.PI);  // round the far loop (clockwise)
    this.split = pts.length;
    line(T4, T1);
    arc(D, ang(T1, D), ang(T2, D) + (ang(T2, D) < ang(T1, D) ? 2 * Math.PI : 0));  // round the near loop
    const N = pts.length;
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i <= N; i++) this.cum.push(this.cum[i - 1] + pts[i % N].distanceTo(pts[i - 1]));
    this.total = this.cum[N];
    this.road = road;
    this.startS = Math.hypot(T2[0], T2[1]) * 0.35;  // on the first straight, before the crossing
    this.group = this._mesh();
  }

  // Point, unit tangent, left normal and signed curvature at distance s.
  at(s) {
    const N = this.pts.length;
    s = ((s % this.total) + this.total) % this.total;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const u = (s - this.cum[lo]) / (this.cum[lo + 1] - this.cum[lo]);
    const a = this.pts[lo], b = this.pts[(lo + 1) % N];
    const p = a.clone().lerp(b, u);
    const tan = b.clone().sub(a).normalize();
    const c = this.pts[(lo + 2) % N], prev = this.pts[(lo - 1 + N) % N];
    const t2 = c.clone().sub(b).normalize(), t0 = a.clone().sub(prev).normalize();
    const turn = -Math.atan2(t0.x * t2.z - t0.z * t2.x, t0.x * t2.x + t0.z * t2.z);  // + = turning right (to the vehicle's -x)
    const curv = turn / (prev.distanceTo(a) + a.distanceTo(b) + b.distanceTo(c));
    const left = new THREE.Vector3().crossVectors(UP, tan).normalize();
    return { p, tan, left, curv };
  }

  _mesh() {
    const g = new THREE.Group();
    // pixel dirt: ruts, pebbles, tyre marks (nearest filtering, like the kit)
    const c = document.createElement('canvas');
    c.width = 32; c.height = 64;
    const x = c.getContext('2d');
    const shades = ['#7d5f40', '#735637', '#86684a', '#6b4f33'];
    for (let i = 0; i < 32; i++) for (let j = 0; j < 64; j++) { x.fillStyle = shades[(i * 7 + j * 13 + ((i * j) % 5)) % 4]; x.fillRect(i, j, 1, 1); }
    x.fillStyle = '#5a412a';
    for (const r of [3, 4, 11, 12, 19, 20, 27, 28]) x.fillRect(r, 0, 1, 64);  // ruts
    x.fillStyle = '#a3866a';
    for (let k = 0; k < 18; k++) x.fillRect((k * 11) % 32, (k * 29) % 64, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    // two halves so the crossing doesn't z-fight
    const N = this.pts.length, half = this.road / 2;
    for (const [a, b, off] of [[0, this.split, 0], [this.split, N, -2]]) {
      const pos = [], uv = [], idx = [];
      for (let i = a; i <= b; i++) {
        const { p, left } = this.at(this.cum[i % N] + (i === N ? this.total - 1e-3 : 0));
        for (const side of [-1, 1]) {
          const q = p.clone().addScaledVector(left, side * half);
          pos.push(q.x, 0.4 - off * 0.05, q.z);
          uv.push(side < 0 ? 0 : 1, this.cum[i % N] / 96);
        }
        if (i < b) { const k = (i - a) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      g.add(m);
    }
    // tyre-stack barriers along both edges (not across the crossing)
    const tyre = new THREE.CylinderGeometry(9, 9, 6, 10);
    const spots = [];
    for (let s = 0; s < this.total; s += 34) {
      const { p, left } = this.at(s);
      for (const side of [-1, 1]) {
        const q = p.clone().addScaledVector(left, side * (half + 12));
        if (q.length() < this.road * 1.3) continue;
        let onRoad = false;  // skip stacks that would sit on the other branch
        for (let k = 0; k < this.pts.length; k += 6) if (this.pts[k].distanceTo(q) < half + 6) { onRoad = true; break; }
        if (!onRoad) spots.push([q, (spots.length >> 1) % 2]);
      }
    }
    const inst = new THREE.InstancedMesh(tyre, new THREE.MeshLambertMaterial({ flatShading: true }), spots.length * 2);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    spots.forEach(([q, alt], k) => {
      for (let h = 0; h < 2; h++) {
        mtx.makeTranslation(q.x, 3 + h * 6, q.z);
        inst.setMatrixAt(k * 2 + h, mtx);
        inst.setColorAt(k * 2 + h, col.set(h === 1 && alt ? '#b8321f' : h === 1 ? '#e8e0cc' : '#2a2a2c'));
      }
    });
    inst.castShadow = inst.receiveShadow = true;
    g.add(inst);
    // chequered start line
    const sc = document.createElement('canvas');
    sc.width = 16; sc.height = 2;
    const sx = sc.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { sx.fillStyle = (i + j) % 2 ? '#111' : '#eee'; sx.fillRect(i, j, 1, 1); }
    const st = new THREE.CanvasTexture(sc);
    st.magFilter = THREE.NearestFilter;
    const start = this.at(this.startS);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(this.road, 14), new THREE.MeshLambertMaterial({ map: st, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(start.tan.x, start.tan.z);
    line.position.set(start.p.x, 0.6, start.p.z);
    g.add(line);
    return g;
  }
}

const LANES = [-0.37, -0.12, 0.12, 0.37];  // fractions of the road width
const WIDE = 84;  // two racers closer than this side to side would touch

class Racer {
  constructor(track, vehicle, lane, vmax, s0, name, seed) {
    Object.assign(this, { track, v: vehicle, lane, vmax, s: s0, name, speed: 0, laps: 0, dist: 0, seed });  // starts behind the line: lap 1 on crossing it
    this.target = lane;
    this.laneV = 0;
    this.lean = 0;
    this.holder = new THREE.Group();
    this.holder.add(vehicle.group);
    this.yaw = 0;
    // how far the rig reaches ahead of and behind its origin (trailers included)
    const box = new THREE.Box3().setFromObject(vehicle.group);
    this.front = -box.min.z;
    this.back = box.max.z;
    this.place(0);
    vehicle.group.updateMatrixWorld(true);
    for (const t of vehicle.trailers) {
      t.Aw = t.root.getWorldPosition(new THREE.Vector3());
      t.len = Math.abs(t.c.z);
    }
  }

  place(slip) {
    const { p, tan, left } = this.track.at(this.s);
    this.holder.position.copy(p).addScaledVector(left, this.lane);
    // nose into a lane change: the heading leans toward the sideways slide
    this.yaw = Math.atan2(-tan.x, -tan.z) + slip;
    this.holder.rotation.y = this.yaw;
  }

  // Signed along-track distances (the lap wraps): gapTo(o) > 0 when o is
  // fully ahead of my nose; behind(o) > 0 when o is fully behind my tail.
  // Both negative: we overlap along the track (side by side).
  rel(o) {
    const T = this.track.total;
    let d = (((o.s - this.s) % T) + T) % T;
    return d > T / 2 ? d - T : d;
  }

  gapTo(o) { return this.rel(o) - o.back - this.front; }

  behind(o) { return -this.rel(o) - this.back - o.front; }

  update(dt, race) {
    const tr = this.track, mul = race.speed;
    // pace wanders a little so the order keeps changing
    const pace = 1 + 0.08 * Math.sin(race.time * 0.37 + this.seed * 2.1) + 0.04 * Math.sin(race.time * 1.13 + this.seed);
    // slow for the tightest bend in the next stretch, accelerate out of it
    let k = 0;
    for (let d = 0; d < 260; d += 26) k = Math.max(k, Math.abs(tr.at(this.s + d).curv));
    let target = this.vmax * mul * pace * Math.max(0.45, Math.min(1, 1 - k * 220));
    // traffic: someone slower ahead in my lane? slide into a free lane, else follow
    const look = 220 + this.speed * 0.8;
    const ahead = race.racers.filter((o) => o !== this && Math.abs(o.lane - this.lane) < WIDE && this.rel(o) > 0 && this.gapTo(o) < look)
      .sort((a, b) => this.gapTo(a) - this.gapTo(b))[0];
    if (ahead && ahead.speed < this.speed + 20 && this.target === this.lane) {
      // a lane is free if nobody is in it (or heading into it) anywhere near me
      const free = (lane) => race.racers.every((o) => o === this
        || (Math.abs(o.lane - lane) >= WIDE && Math.abs(o.target - lane) >= WIDE)
        || this.gapTo(o) > look * 0.6 || this.behind(o) > 90);
      const options = LANES.map((f) => f * tr.road).filter((l) => Math.abs(l - this.lane) > 10 && free(l))
        .sort((a, b) => Math.abs(a - this.lane) - Math.abs(b - this.lane));
      if (options.length) this.target = options[0];
    }
    if (ahead && Math.abs(this.target - this.lane) < 10) target = Math.min(target, ahead.speed + Math.max(-60, this.gapTo(ahead) - 40) * 0.8);  // stuck: tuck in behind
    // never slide into someone alongside: hold the lane change until it's clear
    const blocked = race.racers.some((o) => o !== this && this.gapTo(o) < 30 && this.behind(o) < 30
      && Math.abs(o.lane - this.lane) < WIDE + 10 && Math.sign(o.lane - this.lane) === Math.sign(this.target - this.lane));
    if (blocked) this.target = LANES.map((f) => f * tr.road).reduce((p, l) => (Math.abs(l - this.lane) < Math.abs(p - this.lane) ? l : p));
    const a = Math.max(-320 * mul, Math.min(170 * mul, (target - this.speed) * 2.5));
    this.speed = Math.max(0, this.speed + a * dt);
    // lane slide: a critically damped spring toward the target lane
    const w = 4.2;
    const latA = w * w * (this.target - this.lane) - 2 * w * this.laneV;
    this.laneV += latA * dt;
    this.lane += this.laneV * dt;
    if (Math.abs(this.target - this.lane) < 1 && Math.abs(this.laneV) < 2) { this.lane = this.target; this.laneV = 0; }
    this.before = this.s;
    this.s += this.speed * dt;
    this.dist += this.speed * dt;
    this.a = a;
    this.latA = latA;
  }

  // After every racer has moved (and been kept apart): pose the rig.
  render(dt) {
    const tr = this.track, a = this.a, latA = this.latA;
    if (Math.floor((this.before - tr.startS) / tr.total) < Math.floor((this.s - tr.startS) / tr.total)) this.laps++;
    const slip = Math.atan2(this.laneV, Math.max(40, this.speed));  // + lane is to the vehicle's right: yaw right
    this.place(slip);
    // sideways accel: the bend plus the lane slide (+ = turning right)
    const lat = this.speed * this.speed * tr.at(this.s).curv + latA;
    this.v.drive(dt, this.speed, a, lat);
    if (this.v.isBike) {  // bikes lean the whole machine into the turn, about the tyre contact line
      const want = Math.max(-0.6, Math.min(0.6, Math.atan(lat / 140)));
      this.lean += (want - this.lean) * Math.min(1, dt * 6);
      this.holder.rotation.z = this.lean;
    }
    // trailers: each axle trails its hitch at a fixed distance (a tractrix)
    this.v.group.updateMatrixWorld(true);
    for (const t of this.v.trailers) {
      const H = t.prev.getWorldPosition(new THREE.Vector3());
      const dir = new THREE.Vector3(H.x - t.Aw.x, 0, H.z - t.Aw.z).normalize();
      t.Aw.set(H.x - dir.x * t.len, 0, H.z - dir.z * t.len);
      let rel = Math.atan2(-dir.x, -dir.z) - this.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      t.yaw = rel;
      this.v.placeTrailer(t);
    }
  }
}

export class Race {
  constructor(track, vehicles, names) {
    this.track = track;
    this.speed = 1;  // the speed slider: scales every racer's pace
    this.time = 0;
    const grid = [0, 3, 1, 2];
    this.racers = vehicles.map((v, i) => new Racer(track, v, LANES[grid[i % 4]] * track.road, 300 + ((i * 37) % 70), track.startS - 30 - i * 60, names[i], i + 1));
    this.group = new THREE.Group();
    for (const r of this.racers) this.group.add(r.holder);
  }

  update(dt) {
    this.time += dt;
    for (const r of this.racers) r.update(dt, this);
    // hard rule: nobody drives through anybody. A follower overlapping (or
    // nose-to-tail closer than 12) someone in its lane drops back behind them
    // and matches their speed.
    for (let pass = 0; pass < 3; pass++) {
      for (const f of this.racers) for (const l of this.racers) {
        if (f === l || Math.abs(f.lane - l.lane) >= WIDE - 4 || f.rel(l) < 0) continue;
        const gap = f.gapTo(l);
        if (gap < 12) {
          f.s -= 12 - gap;
          f.dist -= 12 - gap;
          f.speed = Math.min(f.speed, l.speed);
        }
      }
    }
    for (const r of this.racers) r.render(dt);
  }

  standings() { return [...this.racers].sort((a, b) => b.dist - a.dist); }

  lap(r) { return Math.max(1, r.laps); }
}
