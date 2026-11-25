// grass.js: swaying voxel grass and wild flowers over the green parts of a scene (three.js).
//
//   const grass = grassField(root, { area: [x0, z0, x1, z1], avoid: trackPoints, quality: 'High' });
//   root.add(grass.mesh);
//   grass.tick(dt);                      // every frame: the wind
//
// Tufts are crossed pixel-art cards whose normals all point straight up, so they light exactly
// like the ground under them. They go only where the top surface of the scene is grass-green
// (ground planes, baseboard tops, plateaus, grassy terraces): never on track (avoid), roads,
// water, rock, snow or textured models. One instanced draw call; patchy, with flower meadows.
import * as THREE from 'three';

const PX = 16; // pixels per card side
const GRASS_TILES = 8, FLOWER_TILES = 6, TILES = GRASS_TILES + FLOWER_TILES;
const CARD = 12; // card size in voxels (a person is 36)
const SPACING = { High: 11, Medium: 15, Low: 22 };
const BLADES = ['#3f6b2a', '#4f7f33', '#5c8f3a', '#6c9f42', '#7fb04a', '#94c056'];
const PETALS = ['#f4d03f', '#f7f4ea', '#f28ab2', '#a57ad8', '#e0533d', '#78b3ee'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise, 0..1, for patches and meadows. */
function noise2(seed) {
  const h = (i, j) => {
    let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = s(x - i), fz = s(z - j);
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}

/** The card atlas: grass tufts, then flowers, one 16 px tile each, on transparent pixels. */
function atlas(seed = 7) {
  const c = document.createElement('canvas');
  c.width = PX * TILES;
  c.height = PX;
  const g = c.getContext('2d');
  const r = rng(seed);
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, PX - 1 - y, 1, 1); };
  const blade = (x0, h, lean) => {
    for (let y = 0; y < h; y++) {
      const x = Math.round(x0 + lean * (y / h) ** 2);
      const k = Math.min(BLADES.length - 1, Math.floor((y / h) * BLADES.length * 0.9 + r() * 1.3));
      if (x >= 0 && x < PX) px(x, y, BLADES[k]);
    }
  };
  for (let t = 0; t < GRASS_TILES; t++) {
    g.save();
    g.translate(t * PX, 0);
    const n = 5 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) blade(1 + r() * (PX - 2), 5 + Math.floor(r() * (PX - 5)), (r() - 0.5) * 6);
    g.restore();
  }
  for (let t = 0; t < FLOWER_TILES; t++) {
    g.save();
    g.translate((GRASS_TILES + t) * PX, 0);
    for (let k = 0; k < 3; k++) blade(2 + r() * (PX - 4), 4 + Math.floor(r() * 6), (r() - 0.5) * 4);
    const petal = PETALS[t % PETALS.length];
    const heads = 1 + Math.floor(r() * 2);
    for (let k = 0; k < heads; k++) {
      const x = 4 + Math.floor(r() * (PX - 8)), h = 8 + Math.floor(r() * 6);
      for (let y = 0; y < h; y++) px(x, y, y < 3 ? BLADES[1] : BLADES[3]);
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) px(x + dx, h + dy, petal);
      px(x, h, t % 2 ? '#f6c24a' : '#fff3c2');
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  return tex;
}

/** Two crossed upright cards, base at y = 0, every normal straight up. */
function cardGeometry() {
  const pos = [], uv = [], nrm = [], idx = [];
  const h = CARD / 2;
  [[1, 0], [0, 1]].forEach(([ax, az], q) => {
    const b = q * 4;
    for (const [s, y, u, v] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, CARD, 1, 1], [-1, CARD, 0, 1]]) {
      pos.push(s * h * ax, y, s * h * az);
      uv.push(u, v);
      nrm.push(0, 1, 0);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** The highest surface under a point: { y, color, textured, up } or null. Boxes are tested exactly; meshes by a ray. */
class Surfaces {
  constructor(root, cell = 128) {
    this.cell = cell;
    this.grid = new Map();
    this.wide = []; // meshes too big for the grid (ground planes)
    root.updateMatrixWorld(true);
    const m = new THREE.Matrix4(), box = new THREE.Box3(), col = new THREE.Color();
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const geo = o.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const textured = !!o.material?.map;
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          m.premultiply(o.matrixWorld);
          box.copy(geo.boundingBox).applyMatrix4(m);
          if (o.instanceColor) o.getColorAt(i, col); else col.setRGB(1, 1, 1);
          col.multiply(o.material.color ?? new THREE.Color(1, 1, 1));
          this._insert(box, { box: true, m: m.clone(), inv: m.clone().invert(), bb: geo.boundingBox, color: col.clone(), textured });
        }
      } else {
        box.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
        if (box.max.x - box.min.x > 6000 || box.max.z - box.min.z > 6000) this.wide.push(o);
        else this._insert(box, { mesh: o });
      }
    });
    this.ray = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
    this.p = new THREE.Vector3();
    this.q = new THREE.Vector3();
  }

  _insert(box, item) {
    const c = this.cell;
    for (let i = Math.floor(box.min.x / c); i <= Math.floor(box.max.x / c); i++) {
      for (let j = Math.floor(box.min.z / c); j <= Math.floor(box.max.z / c); j++) {
        const k = `${i},${j}`;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(item);
      }
    }
  }

  at(x, z) {
    const list = this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? [];
    let best = null;
    const meshes = [...this.wide];
    for (const it of list) {
      if (it.mesh) { meshes.push(it.mesh); continue; }
      const p = this.p.set(x, 0, z).applyMatrix4(it.inv);
      if (p.x < it.bb.min.x || p.x > it.bb.max.x || p.z < it.bb.min.z || p.z > it.bb.max.z) continue;
      const y = this.q.set(p.x, it.bb.max.y, p.z).applyMatrix4(it.m).y;
      if (!best || y > best.y) best = { y, color: it.color, textured: it.textured, up: 1 };
    }
    this.ray.set(this.p.set(x, 5000, z), this.down);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    if (hit && (!best || hit.point.y > best.y + 0.01)) {
      const mat = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
      const up = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y : 1;
      best = { y: hit.point.y, color: mat?.color ?? new THREE.Color(1, 1, 1), textured: !!mat?.map, up };
    }
    return best;
  }
}

const HSL = {};
function grassy(s) {
  if (!s || s.textured || s.up < 0.8) return false;
  s.color.getHSL(HSL, THREE.SRGBColorSpace);
  return HSL.h > 0.17 && HSL.h < 0.45 && HSL.s > 0.2 && HSL.l > 0.15 && HSL.l < 0.75;
}

/**
 * Grass and flowers over root's green surfaces inside area [x0, z0, x1, z1], kept `clear` voxels
 * from every point in avoid (track samples). Returns { mesh, tick(dt), count }.
 */
export function grassField(root, { area, avoid = [], clear = 34, quality = 'High', seed = 11, soft = true } = {}) {
  const spacing = SPACING[quality] ?? SPACING.High;
  const surfaces = new Surfaces(root);
  const near = new Map(); // track points by 64-cell, for the clearance test
  for (const p of avoid) {
    const k = `${Math.floor(p[0] / 64)},${Math.floor(p[2] / 64)}`;
    if (!near.has(k)) near.set(k, []);
    near.get(k).push(p);
  }
  const offTrack = (x, z) => {
    const i = Math.floor(x / 64), j = Math.floor(z / 64);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
      for (const p of near.get(`${a},${b}`) ?? []) if ((p[0] - x) ** 2 + (p[2] - z) ** 2 < clear * clear) return false;
    }
    return true;
  };
  const r = rng(seed), patches = noise2(seed), meadows = noise2(seed + 17), rim = noise2(seed + 29);
  const [x0, z0, x1, z1] = area;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  // soft: a rounded, noisy edge that thins out to nothing, instead of the area's straight sides
  const edge = (x, z) => {
    if (!soft) return true;
    const rho = ((Math.abs(x - cx) / hx) ** 4 + (Math.abs(z - cz) / hz) ** 4) ** 0.25;
    const reach = 0.72 + 0.22 * rim(x / 210, z / 210);
    return r() > THREE.MathUtils.smoothstep(rho, reach - 0.2, reach + 0.04);
  };
  const items = [];
  const tintRef = new THREE.Color('#6c9f42');
  for (let z = z0; z < z1; z += spacing) {
    for (let x = x0; x < x1; x += spacing) {
      const px = x + (r() - 0.5) * spacing, pz = z + (r() - 0.5) * spacing;
      const patch = patches(px / 260, pz / 260);
      if (patch < 0.32 + r() * 0.2) continue; // clumps and bare bits, like real grass
      if (!edge(px, pz)) continue;
      if (!offTrack(px, pz)) continue;
      const s = surfaces.at(px, pz);
      if (!grassy(s)) continue;
      const flower = meadows(px / 340, pz / 340) > 0.62 ? r() < 0.35 : r() < 0.03;
      items.push({ x: px, y: s.y, z: pz, flower, size: 0.65 + patch * 0.6 + r() * 0.25, color: s.color });
    }
  }

  const geo = cardGeometry();
  const variant = new Float32Array(items.length);
  const mat = new THREE.MeshLambertMaterial({ map: atlas(seed), alphaTest: 0.5, side: THREE.DoubleSide });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aVariant;\nuniform float uTime;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv.x = (vMapUv.x + aVariant) / ${TILES.toFixed(1)};`)
      .replace('#include <project_vertex>', `
  vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
  vec2 wp = instanceMatrix[3].xz;
  float bend = position.y / ${CARD.toFixed(1)}; bend *= bend;
  float gust = sin(uTime * 1.3 + wp.x * 0.011 + wp.y * 0.007) * 0.65 + sin(uTime * 2.9 + wp.x * 0.037 - wp.y * 0.021) * 0.35;
  mvPosition.xz += vec2(0.8, 0.45) * gust * bend * 2.4;
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
    // both faces lit as the ground is: the normal always points up
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  mat.customProgramCacheKey = () => 'voxel-grass';
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), at = new THREE.Vector3();
  const white = new THREE.Color(1, 1, 1), tint = new THREE.Color();
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, r() * Math.PI);
    sc.setScalar(it.size);
    m.compose(at.set(it.x, it.y, it.z), q, sc);
    mesh.setMatrixAt(i, m);
    variant[i] = it.flower ? GRASS_TILES + Math.floor(r() * FLOWER_TILES) : Math.floor(r() * GRASS_TILES);
    // grass takes on the green of the ground under it; flowers keep their own colours
    tint.copy(it.color).multiply(new THREE.Color(1 / tintRef.r, 1 / tintRef.g, 1 / tintRef.b));
    tint.setRGB(THREE.MathUtils.clamp(tint.r, 0.6, 1.4), THREE.MathUtils.clamp(tint.g, 0.6, 1.4), THREE.MathUtils.clamp(tint.b, 0.6, 1.4));
    mesh.setColorAt(i, it.flower ? white : tint.lerp(white, 0.35));
  });
  geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variant, 1));
  mesh.count = items.length;
  mesh.frustumCulled = false; // one mesh spans the whole railway
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.prettySkip = true; // lit as ground; no emissive or shadow casting from the viewer's look
  mesh.name = 'grass';
  return { mesh, count: items.length, tick: (dt) => { uTime.value += dt; }, setTime: (t) => { uTime.value = t; } };
}
