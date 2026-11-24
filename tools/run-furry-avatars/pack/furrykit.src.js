// furrykit.js: assemble, recolour and animate Furries Unleashed characters in three.js, in the pack's toon look.
//
//   const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
//   const kit = await loadFurryKit('assets/furries-unleashed/kit/', { loader });
//   const fur = await kit.makeFurry('fox');            // a species preset, or your own look (below)
//   scene.add(fur.object);
//   fur.play('trot');
//   // every frame: fur.update(dt)
//
// Mix and match: every part fits every other, so build whatever creature you want. A look is plain data
// (every key optional; a species preset fills the rest):
//   { species: 'fox', head, ears, cheeks, hair, eyes, teeth, tail, feet, tuft, claws, top, bottom,
//     colours: { fur: '#ee7a34', fur_light: '#fff4e4', ... } }
// head:   one of the 23 species heads ('wolf', 'fox', 'dragon', ...); everything else fits every head
// ears, cheeks, hair, tail: a style or 'none'      eyes: a style      feet: 'paws' | 'hooves' | ...
// teeth:  'none' or a style; the helper picks the version fitted to the chosen head's snout
// tuft:   chest fluff (true/false)   claws: finger and toe claws (true/false)   top, bottom: hoodie, shorts
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const CATALOG = /*CATALOG*/{};
export const CLIPS = /*CLIPS*/{};   // name -> { duration, loop }

// The pack's look: toon shading (`steps` bands from the `shadow` level up to full colour) and a dark outline
// (each region's colour times `ink`, `outline` thick in model units). Tune it with fur.setStyle({ ... }).
export const STYLE = { outline: 0.0085, ink: 0.3, steps: 3, shadow: 0.24 };
const NO_OUTLINE = new Set(['iris', 'pupil', 'eye_white', 'mouth']);   // face decals: an outline round them reads as noise

/** The full look for a species preset, with any changes on top. */
export function lookFor(species = 'wolf', changes = {}) {
  const r = CATALOG.species[species];
  if (!r) throw new Error(`no species "${species}" (try ${Object.keys(CATALOG.species).join(', ')})`);
  const look = { species, head: r.head, ears: r.ears, cheeks: r.cheeks, hair: r.hair, eyes: r.eyes, teeth: r.teeth, tail: r.tail,
    feet: r.feet, tuft: r.tuft !== false, claws: true, top: false, bottom: false, colours: { ...r.colours } };
  return { ...look, ...changes, colours: { ...look.colours, ...(changes.colours || {}) } };
}

/** A random, always-valid look: a random species with some parts swapped in from others. */
export function randomLook(rng = Math.random) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const look = lookFor(pick(Object.keys(CATALOG.species)));
  for (const k of ['ears', 'cheeks', 'hair', 'eyes', 'tail', 'feet', 'teeth'])
    if (rng() < 0.35) look[k] = pick([...CATALOG.parts[k], ...(['ears', 'cheeks', 'hair', 'tail', 'teeth'].includes(k) ? ['none'] : [])]);
  return look;
}

/** Which part GLBs a look needs (names relative to the kit folder, without .glb). */
export function partsFor(look) {
  const l = look, out = [];
  const snout = CATALOG.species[l.head]?.snout;
  out.push('head-' + l.head, 'eyes-' + l.eyes, 'feet-' + l.feet);
  for (const k of ['ears', 'cheeks', 'hair', 'tail']) if (l[k] && l[k] !== 'none') out.push(`${k}-${l[k]}`);
  if (l.teeth && l.teeth !== 'none' && snout) out.push(`teeth-${l.teeth}__${snout}`);
  if (l.tuft) out.push('tuft');
  if (l.claws) { out.push('claws'); if (l.feet === 'paws') out.push('claws-paws'); }
  if (l.top) out.push('top');
  if (l.bottom) out.push('bottom');
  return out;
}

/** Give a ready-made character (characters/<species>.glb, loaded yourself) the pack's toon look, in place. */
export function toonify(object, style = {}) {
  const meshes = [];
  object.traverse(o => { if (o.isSkinnedMesh && !o.userData.furryOutline) meshes.push({ mesh: o, src: o.geometry, srcMat: o.material, part: o.name }); });
  const colours = {};
  for (const r of meshes) for (const m of [r.srcMat].flat()) colours[m.name] = '#' + m.color.getHexString();
  toonMeshes(meshes, colours, { ...STYLE, ...style });
  return object;
}

// ---------------------------------------------------------------- the toon look

// welded normals: average the face normals of every corner at the same position (smooth shading bands)
const smoothCache = new WeakMap();
function smoothGeometry(src) {
  if (smoothCache.has(src)) return smoothCache.get(src);
  const g = src.index ? src.toNonIndexed() : src.clone();
  const pos = g.attributes.position, n = pos.count, sum = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const key = i => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const f = c.sub(b).cross(a.sub(b));   // area-weighted face normal
    for (let k = 0; k < 3; k++) {
      const h = key(i + k);
      if (!sum.has(h)) sum.set(h, new THREE.Vector3());
      sum.get(h).add(f);
    }
  }
  const out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) v.copy(sum.get(key(i))).normalize().toArray(out, i * 3);
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  smoothCache.set(src, g);
  return g;
}

const ramps = new Map();
function ramp(steps, shadow) {
  const key = steps + ':' + shadow;
  if (!ramps.has(key)) {
    const n = Math.max(2, Math.round(steps)), v = Array.from({ length: n }, (_, i) => Math.round(255 * (shadow + (1 - shadow) * i / (n - 1))));
    const t = new THREE.DataTexture(new Uint8Array(v.flatMap(x => [x, x, x, 255])), n, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    ramps.set(key, t);
  }
  return ramps.get(key);
}

// toon materials in the region colours, smooth normals, and an outline hull per mesh ({ mesh, src, srcMat, part, outline })
function toonMeshes(meshes, col, s) {
  const gradient = ramp(s.steps, s.shadow);
  for (const r of meshes) {
    const regions = [r.srcMat].flat().map(m => m.name);
    const mats = regions.map(region => {
      const m = new THREE.MeshToonMaterial({ color: new THREE.Color(col[region] || '#ff00ff'), gradientMap: gradient });
      m.name = region;
      return m;
    });
    for (const old of [r.mesh.material].flat()) if (![r.srcMat].flat().includes(old)) old.dispose();
    r.mesh.material = Array.isArray(r.srcMat) ? mats : mats[0];
    r.mesh.geometry = smoothGeometry(r.src);
    // the outline: an inverted hull pushed out along the smooth normals (teeth keep theirs: they sit on pale fur)
    if (r.outline) { r.outline.removeFromParent(); [r.outline.material].flat().forEach(m => m.dispose()); r.outline = null; }
    if (s.outline > 0 && (r.part.startsWith('teeth') || !regions.every(x => NO_OUTLINE.has(x)))) {
      const lineMats = regions.map(region => {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col[region] || '#000').multiplyScalar(s.ink), side: THREE.BackSide });
        m.onBeforeCompile = sh => {
          sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${s.outline.toFixed(5)};`);
        };
        m.customProgramCacheKey = () => 'furry-outline-' + s.outline;
        return m;
      });
      const line = new THREE.SkinnedMesh(smoothGeometry(r.src), Array.isArray(r.srcMat) ? lineMats : lineMats[0]);
      line.bind(r.mesh.skeleton, r.mesh.bindMatrix);
      line.frustumCulled = false;
      line.userData.furryOutline = true;
      r.mesh.add(line);
      r.outline = line;
    }
  }
}

// ---------------------------------------------------------------- the kit

export async function loadFurryKit(dir, { loader } = {}) {
  if (!loader) throw new Error('loadFurryKit needs { loader }: a GLTFLoader with setMeshoptDecoder(MeshoptDecoder)');
  if (dir && !dir.endsWith('/')) dir += '/';
  const gltfs = new Map();
  const glb = name => {
    if (!gltfs.has(name)) gltfs.set(name, loader.loadAsync(`${dir}${name}.glb`));
    return gltfs.get(name);
  };
  const base = await glb('base');
  const clips = Object.fromEntries(base.animations.map(a => [a.name, a]));

  class Furry {
    constructor() {
      this.object = cloneSkinned(base.scene);
      this.bones = {};
      this.meshes = [];
      this.object.traverse(o => {
        if (o.isBone) this.bones[o.name] = o;
        if (o.isSkinnedMesh) this.meshes.push({ mesh: o, src: o.geometry, srcMat: o.material, part: 'base' });
      });
      this.rig = this.meshes[0]?.mesh.parent || this.object;
      this.mixer = new THREE.AnimationMixer(this.object);
      this.style = { ...STYLE };
      this.look = null;
    }

    /** Change any part of the look (or { species } for another preset); re-dresses and recolours. */
    async set(changes) {
      if (changes.species && changes.species !== this.look?.species) changes = lookFor(changes.species, changes);
      const colours = { ...(this.look?.colours || {}), ...(changes.colours || {}) };
      this.look = { ...(this.look || lookFor('wolf')), ...changes, colours };
      const loaded = await Promise.all(partsFor(this.look).map(glb));
      for (const r of this.meshes.filter(r => r.part !== 'base')) {
        r.mesh.removeFromParent();
        for (const m of [r.mesh.material, r.outline?.material].flat()) m?.dispose?.();
      }
      this.meshes = this.meshes.filter(r => r.part === 'base');
      for (const g of loaded) g.scene.traverse(src => {
        if (!src.isSkinnedMesh) return;
        const m = new THREE.SkinnedMesh(src.geometry, src.material);
        m.name = src.name;
        m.castShadow = true;
        m.bind(new THREE.Skeleton(src.skeleton.bones.map(b => this.bones[b.name]), src.skeleton.boneInverses), src.bindMatrix);
        this.rig.add(m);
        this.meshes.push({ mesh: m, src: src.geometry, srcMat: src.material, part: src.name });
      });
      this.setStyle();
      return this;
    }

    /** Recolour by region (CATALOG.regions): fur.paint({ fur: '#3a7bd5', hair: '#ff6fd8' }). */
    paint(colours = {}) {
      Object.assign(this.look.colours, colours);
      return this.setStyle();
    }

    /** Tune the toon look: fur.setStyle({ outline: 0.012, steps: 2 }) (see STYLE). */
    setStyle(style = {}) {
      this.style = { ...this.style, ...style };
      toonMeshes(this.meshes, { ...CATALOG.defaults, ...this.look.colours }, this.style);
      return this;
    }

    /** Play a clip, cross-fading from the current one. One-shots hold their last frame unless loop: true. */
    play(name, { fade = 0.15, loop, timeScale = 1 } = {}) {
      const clip = clips[name];
      if (!clip) throw new Error(`no clip "${name}"`);
      const a = this.mixer.clipAction(clip);
      const repeat = loop ?? CLIPS[name]?.loop ?? false;
      a.reset();
      a.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.timeScale = timeScale;
      if (this.current && this.current !== a) this.current.fadeOut(fade);
      a.fadeIn(this.current && this.current !== a ? fade : 0).play();
      this.current = a;
      this.clip = name;
      return a;
    }

    /** Swing-trail windows of the current clip (or a named one): [{ paw: 'L'|'R', start, end }] in seconds. */
    trails(name = this.clip) {
      return (CATALOG.trails[name] || []).map(w => ({ paw: w.bone, start: w.start, end: w.end }));
    }

    /** World position of a paw's claw tips ('L' or 'R'): attach slash FX here during a trail window. */
    clawTip(paw, target = new THREE.Vector3()) {
      const a = this.bones['hand' + paw].getWorldPosition(new THREE.Vector3());
      this.bones['fingers' + paw].getWorldPosition(target);
      return target.add(target.clone().sub(a).multiplyScalar(1.2));
    }

    update(dt) { this.mixer.update(dt); }

    dispose() {
      this.mixer.stopAllAction();
      this.object.removeFromParent();
      for (const r of this.meshes) for (const m of [r.mesh.material, r.outline?.material].flat()) m?.dispose?.();
    }
  }

  return {
    catalog: CATALOG,
    clips: CLIPS,
    animations: clips,
    style: STYLE,
    lookFor,
    randomLook,
    partsFor,
    toonify,
    /** Build a character from a species name or a look (see the top of this file). */
    async makeFurry(look = 'wolf') {
      const f = new Furry();
      await f.set(typeof look === 'string' ? lookFor(look) : look.species ? lookFor(look.species, look) : { ...lookFor('wolf'), ...look });
      f.play('idle');
      return f;
    },
  };
}
