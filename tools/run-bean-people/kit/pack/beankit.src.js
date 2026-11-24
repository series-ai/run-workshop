// beankit.js: assemble, dress, recolour and animate Bean Squad figures in three.js.
//
//   const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
//   const kit = await loadBeanKit('assets/bean-squad/kit/', { loader });
//   const bean = await kit.makeBean(kit.looks.striker);   // or kit.randomLook(), or your own look
//   scene.add(bean.object);
//   bean.play('run');
//   // every frame: bean.update(dt)
//
// A look is plain data (every key optional):
//   { face, top, head, topper, number, weapon, finish, colours: { body: '#ff7426', top: '#1f1f21', ... } }
// face:   an art face ('x', 'dots', ...) or a screen face ('led-x', 'happy', ...): a screen face swaps the
//         front of the head for a glowing gadget screen
// top:    'none' | 'hoodie' | 'vest' | 'coveralls'        head:   'none' | 'bucket' | 'beanie'
// topper: a head ornament, worn only with no hat and no hood
// number: 'none' or 0-99, a jersey number front and back, shown only on a bare body (no top)
// weapon: 'none' or a toy weapon in the right hand
// finish: 'custom' (use colours.body/arms/hands) or an art-toy finish: 'bone', 'black', 'gold', 'chrome',
//         'clear', 'glow', 'orange', 'olive'
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const CATALOG = /*CATALOG*/{};
export const CLIPS = /*CLIPS*/{};   // name -> { duration, loop, tags, speed (m/s ground speed for gaits) }

export const FINISHES = {
  bone: { color: '#e6ded0', roughness: 0.75, metalness: 0, mark: '#1a181c' },
  black: { color: '#1f1f21', roughness: 0.75, metalness: 0, mark: '#e6ded0' },
  gold: { color: '#ffc35a', roughness: 0.18, metalness: 1, mark: '#1e1912' },
  chrome: { color: '#d9dce2', roughness: 0.08, metalness: 1, mark: '#141418' },
  clear: { color: '#c4dcf2', roughness: 0.05, metalness: 0, opacity: 0.5, mark: '#1a1a1e' },
  glow: { color: '#c9f5b9', roughness: 0.6, metalness: 0, emissive: '#7dff6e', emissiveIntensity: 0.45, mark: '#203020' },
  orange: { color: '#ff7426', roughness: 0.7, metalness: 0, mark: '#1a181c' },
  olive: { color: '#666e4d', roughness: 0.75, metalness: 0, mark: '#e6ded0' },
};

const DEFAULT_LOOK = { face: 'x', top: 'none', head: 'none', topper: 'none', number: 'none', weapon: 'none', finish: 'bone' };

// ready-made looks: a starting point, or a whole cast
export const LOOKS = {
  striker: { face: 'x', number: 9, finish: 'custom', colours: { body: '#ff7426', arms: '#ff7426', hands: '#ff7426', legs: '#1f1f21', number: '#f2f0ea' } },
  goalie: { face: 'happy', number: 1, finish: 'custom', colours: { body: '#2f9e8f', arms: '#2f9e8f', hands: '#f2f0ea', legs: '#1f1f21', number: '#ffcc26', led: '#9dff6b' } },
  skater: { face: 'slits', top: 'hoodie', finish: 'black', colours: { top: '#ff8fb1', legs: '#3d5a80', feet: '#f2f0ea' } },
  hiker: { face: 'dots', top: 'vest', head: 'beanie', finish: 'bone', colours: { top: '#ff5a36', hat: '#ffcc26', legs: '#666e4d' } },
  mechanic: { face: 'tired', top: 'coveralls', head: 'bucket', finish: 'custom', colours: { body: '#8fd8ff', arms: '#8fd8ff', hands: '#8fd8ff', top: '#3d5a80', hat: '#ff7426' }, weapon: 'soaker' },
  royal: { face: 'cool', topper: 'crown', finish: 'gold', colours: { led: '#ffb347', topper: '#ffc35a' } },
  sprout: { face: 'stitch', topper: 'sprout', finish: 'custom', colours: { body: '#b5f0a0', arms: '#b5f0a0', hands: '#b5f0a0', legs: '#2f9e8f', topper: '#5cbf4a' } },
  imp: { face: 'angry', topper: 'horns', number: 66, finish: 'custom', colours: { body: '#d92e2e', arms: '#d92e2e', hands: '#1f1f21', legs: '#1f1f21', topper: '#1f1f21', led: '#ff4d4d' }, weapon: 'plasma' },
  ghost: { face: 'holes', topper: 'halo', finish: 'clear', colours: { legs: '#e6ded0', topper: '#ffd35a' } },
  trooper: { face: 'led-x', top: 'vest', finish: 'olive', colours: { top: '#1f1f21', legs: '#666e4d', led: '#59f2ff' }, weapon: 'rifle' },
  heavy: { face: 'bones', top: 'coveralls', finish: 'chrome', colours: { top: '#ff7426' }, weapon: 'bazooka' },
  glowbug: { face: 'love', topper: 'antenna', finish: 'glow', colours: { led: '#ff6fd8', topper: '#ff6fd8' }, weapon: 'raygun' },
};

const PAL = ['#1f1f21', '#e6ded0', '#ff7426', '#666e4d', '#2a3352', '#8c8f94', '#d92e2e', '#ffcc26', '#4d6b9e', '#b89a6b', '#f2f0ea',
  '#ff8fb1', '#8fd8ff', '#b5f0a0', '#c9a7ff', '#ffe08a', '#ff5a36', '#2f9e8f', '#6b3fa0', '#f4a259', '#3d5a80', '#ef476f', '#06d6a0', '#118ab2'];
const BODY_PAL = ['#e6ded0', '#1f1f21', '#ff7426', '#ff8fb1', '#8fd8ff', '#b5f0a0', '#c9a7ff', '#ffe08a', '#2f9e8f', '#ef476f', '#3d5a80',
  '#f4a259', '#666e4d', '#d92e2e', '#118ab2'];
const DARK = ['#1f1f21', '#3d5a80', '#666e4d', '#2f9e8f', '#118ab2', '#d92e2e', '#ef476f'];
const TOPPER_PAL = { sprout: ['#5cbf4a', '#8fd16a', '#2f9e8f'], crown: ['#ffc35a', '#e6ded0', '#ff8fb1'], antenna: PAL,
  horns: ['#f2f0ea', '#1f1f21', '#d92e2e', '#ffc35a'], flower: ['#ff8fb1', '#ffe08a', '#c9a7ff', '#f2f0ea', '#ff5a36'], halo: ['#ffd35a'] };
const SKIN = ['body', 'arms', 'hands'];

/** A random, always-valid look. Pass your own rng (() => [0, 1)) for repeatable crowds. */
export function randomLook(rng = Math.random, { weapon = false } = {}) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const c = CATALOG;
  const look = {
    face: pick([...c.art_faces, ...c.led_faces]), top: rng() < 0.8 ? pick(c.tops) : 'none',
    head: rng() < 0.35 ? pick(c.heads) : 'none', topper: rng() < 0.55 ? pick(c.toppers) : 'none',
    number: rng() < 0.7 ? Math.floor(rng() * (rng() < 0.5 ? 10 : 100)) : 'none',
    weapon: weapon ? pick(c.weapons) : 'none', finish: pick(['black', 'bone', 'bone', 'black', 'gold', 'clear', 'glow', 'orange', 'olive', 'chrome']),
    colours: {
      legs: pick(PAL), feet: pick(['#e6ded0', '#1f1f21', '#f2f0ea', pick(PAL)]), top: pick(PAL), hat: pick(PAL),
      number: pick(['#f2f0ea', '#ffcc26', '#ff7426', '#59f2ff', '#1f1f21']), bezel: pick(['#1a1a1c', '#e6ded0']),
      led: pick(['#59f2ff', '#ffb347', '#ff4d4d', '#9dff6b', '#ff6fd8']),
      weapon: pick(['#ff7426', '#ffcc26', '#8fd8ff', '#b5f0a0', '#ff8fb1', '#c9a7ff', '#06d6a0', '#ef476f', '#f2f0ea', '#666e4d']),
      weapon_trim: pick(['#f2f0ea', '#ffcc26', '#1f1f21', '#118ab2', '#ff5a36']),
    },
  };
  if (rng() < 0.55) {                       // about half in a free body colour, the rest in a finish
    const b = pick(BODY_PAL);
    look.finish = 'custom';
    for (const k of SKIN) look.colours[k] = b;
    if (rng() < 0.3) look.colours.hands = pick(['#f2f0ea', '#1f1f21', pick(BODY_PAL)]);
    look.colours.mark = DARK.includes(b) ? '#f2f0ea' : '#1a181c';
  }
  if (look.topper !== 'none') look.colours.topper = pick(TOPPER_PAL[look.topper] || PAL);
  if (['black', 'olive'].includes(look.finish) && ['holes', 'bones'].includes(look.face)) look.face = 'x';   // dark marks on dark
  return look;
}

/** Which part GLBs a look needs (paths relative to the kit folder). */
export function partsFor(look) {
  const c = CATALOG, l = { ...DEFAULT_LOOK, ...look };
  const screen = !c.art_faces.includes(l.face), hood = c.hooded.includes(l.top);
  const parts = [screen ? 'screen' : 'face-' + l.face];
  if (l.top !== 'none') parts.push(hood && screen ? `top-${l.top}-screen` : 'top-' + l.top);
  if (l.head !== 'none' && !hood) parts.push(screen ? `head-${l.head}-screen` : 'head-' + l.head);
  if (l.topper !== 'none' && l.head === 'none' && !hood) parts.push('topper-' + l.topper);
  if (l.number !== 'none' && l.number !== null && l.top === 'none') parts.push(`num-${String(l.number).length}-body`);
  if (l.weapon && l.weapon !== 'none') parts.push('weapons/' + l.weapon);
  return parts;
}

export async function loadBeanKit(dir, { loader } = {}) {
  if (!loader) throw new Error('loadBeanKit needs { loader }: a GLTFLoader with setMeshoptDecoder(MeshoptDecoder)');
  if (dir && !dir.endsWith('/')) dir += '/';
  const gltfs = new Map(), textures = new Map();
  const glb = name => {
    if (!gltfs.has(name)) gltfs.set(name, loader.loadAsync(`${dir}${name}.glb`));
    return gltfs.get(name);
  };
  const texLoader = new THREE.TextureLoader();
  const tex = path => {                     // a texture, starting its load once; tex(path).userData.ready resolves when loaded
    if (!textures.has(path)) {
      const t = new THREE.Texture();
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false;
      t.userData.ready = texLoader.loadAsync(dir + path).then(loaded => { t.image = loaded.image; t.needsUpdate = true; return t; });
      textures.set(path, t);
    }
    return textures.get(path);
  };
  const texturesFor = look => {             // the screen face and jersey digits a look shows
    const out = [];
    if (!CATALOG.art_faces.includes(look.face)) out.push(tex(`faces/${look.face}.png`));
    if (look.number !== 'none' && look.number !== null && look.top === 'none')
      for (const d of String(look.number)) out.push(tex(`numbers/num-${d}.png`));
    return out;
  };
  const base = await glb('base');
  const clips = Object.fromEntries(base.animations.map(a => [a.name, a]));

  class Bean {
    constructor() {
      this.object = cloneSkinned(base.scene);
      this.bones = {};
      this.mats = [];
      this.object.traverse(o => {
        if (o.isBone) this.bones[o.name] = o;
        if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; this.mats.push(o.material); }
      });
      this.rig = this.object.getObjectByName('rig') || this.object;
      this.mixer = new THREE.AnimationMixer(this.object);
      this.parts = [];
      this.inPlace = false;
      this.look = { ...DEFAULT_LOOK, colours: {} };
    }

    /** Change any part of the look; re-dresses and recolours. */
    async set(changes) {
      const colours = { ...this.look.colours, ...(changes.colours || {}) };
      this.look = { ...this.look, ...changes, colours };
      const want = partsFor(this.look);
      const [loaded] = await Promise.all([Promise.all(want.map(glb)), ...texturesFor(this.look).map(t => t.userData.ready)]);
      for (const m of this.parts) { m.removeFromParent(); m.material.dispose(); }
      this.parts = [];
      for (const g of loaded) {
        g.scene.traverse(src => {
          if (!src.isSkinnedMesh) return;
          const m = new THREE.SkinnedMesh(src.geometry, src.material.clone());
          m.name = src.name;
          m.castShadow = true;
          m.bind(new THREE.Skeleton(src.skeleton.bones.map(b => this.bones[b.name]), src.skeleton.boneInverses), src.bindMatrix);
          this.rig.add(m);
          this.parts.push(m);
        });
      }
      this.paint();
      return this;
    }

    /** Recolour by slot (see CATALOG.slots, plus 'led'): bean.paint({ top: '#3a7bd5' }). */
    paint(colours = {}) {
      Object.assign(this.look.colours, colours);
      const l = this.look, fin = FINISHES[l.finish];
      const col = { ...CATALOG.defaults, ...(fin ? { mark: fin.mark } : {}), ...l.colours };
      if (fin) for (const k of SKIN) col[k] = fin.color;          // a finish owns the body colour; 'custom' uses colours
      const all = [...this.mats, ...this.parts.map(m => m.material)];
      for (const m of all) {
        const slot = Object.keys(CATALOG.slots).find(k => CATALOG.slots[k].includes(m.name));
        if (slot && col[slot]) m.color.set(col[slot]);
        if (SKIN.includes(m.name)) {
          m.roughness = fin ? fin.roughness : 0.7;
          m.metalness = fin ? fin.metalness : 0;
          m.transparent = !!fin?.opacity;
          m.opacity = fin?.opacity ?? 1;
          m.depthWrite = !m.transparent;
          m.emissive.set(fin?.emissive || '#000000');
          m.emissiveIntensity = fin?.emissiveIntensity ?? 1;
        }
        if (m.name === 'seam') { m.transparent = true; m.opacity = 0.3; m.depthWrite = false; }
        if (['num', 'numL', 'numR'].includes(m.name)) {
          const n = String(l.number), d = m.name === 'numR' ? n[1] : n[0];
          m.map = tex(`numbers/num-${d}.png`);
          m.alphaTest = 0.5;
          m.transparent = false;
        }
        if (m.name === 'screen') {
          m.emissiveMap = tex(`faces/${l.face}.png`);
          m.emissive.set(col.led);
          m.emissiveIntensity = 2.4;
        }
        m.needsUpdate = true;
      }
      return this;
    }

    /** Play a clip, cross-fading from the current one. One-shots hold their last frame unless loop: true. */
    play(name, { fade = 0.15, loop, timeScale = 1 } = {}) {
      const clip = clips[name];
      if (!clip) throw new Error(`no clip "${name}"`);
      const a = this.mixer.clipAction(clip);
      const repeat = loop ?? CLIPS[name]?.loop ?? true;
      a.reset();
      a.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.timeScale = timeScale;
      if (this.current && this.current !== a) this.current.fadeOut(fade);
      a.fadeIn(this.current ? fade : 0).play();
      this.current = a;
      this.clip = name;
      return a;
    }

    update(dt) {
      this.mixer.update(dt);
      if (this.inPlace) { const r = this.bones.root; r.position.x = 0; r.position.z = 0; }
    }

    dispose() {
      this.mixer.stopAllAction();
      this.object.removeFromParent();
      for (const m of [...this.mats, ...this.parts.map(p => p.material)]) m.dispose();
    }
  }

  return {
    catalog: CATALOG,
    clips: CLIPS,
    animations: clips,
    looks: LOOKS,
    finishes: FINISHES,
    randomLook,
    partsFor,
    /** Build a figure from a look (see the top of this file). */
    async makeBean(look = {}) {
      const b = new Bean();
      await b.set({ ...DEFAULT_LOOK, ...look, colours: { ...(look.colours || {}) } });
      b.play('idle');
      return b;
    },
  };
}
