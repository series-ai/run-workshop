// Boo Brigade avatar kit for three.js: mix-and-match regular kids.
//
// A kid is the base kid (head, face, skin body, the skeleton and every clip) plus one item per
// slot: hair, face (glasses, freckles ...), top, bottom, shoes and prop. Each item has up to four
// colour channels (main, trim, accent, detail) and a few colourways; any colour works. The kid is
// merged into one skinned mesh with one material, so it is one draw call, and recolouring it
// (skin included) is a uniform change.
//
//   import { loadKidKit } from './kidkit.js';
//   const kit = await loadKidKit('assets/kids/kit/');          // the folder with kit.json and the GLBs
//   const kid = await kit.makeKid(kit.looks['kid-spiky']);     // a ready-made look ...
//   const other = await kit.makeKid(kit.randomLook());         // ... or any mix
//   scene.add(kid.object);
//   kid.play('walk');                                          // clips: kit.clips
//   await kid.wear('top', 'raincoat', 'red');                  // swap an item (colourway name or colours)
//   kid.paint('top', 'main', '#3a7bd5');                       // recolour one channel
//   kid.setSkin(3);                                            // a skin tone index or any colour
//   // every frame:  kid.update(dt);
//
// A look is { skin, hair, face, top, bottom, shoes, prop }, each slot { item, way } or
// { item, colours: [main, trim, accent, detail] } (hex strings; fewer is fine). kit.items lists
// every slot's items with their channel names and colourways.
//
// Plain glTF loaders can open any of the GLBs: they show the item in its first colourway.
// The compressed shipping copies (scripts/compress.mjs) need a loader with the meshopt decoder:
//   const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
//   const kit = await loadKidKit('assets/kids/kit/', { loader });
// Clips change the face (mouths, brows, closed eyes) by scaling switch bones, as in the
// ready-made kids; nothing else is needed for that.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CH = ['main', 'trim', 'accent', 'detail'];

export async function loadKidKit(base, { loader = new GLTFLoader() } = {}) {
  if (!base.endsWith('/')) base += '/';
  const catalog = await (await fetch(base + 'kit.json')).json();
  const slots = catalog.slots;
  const files = new Map();  // file -> Promise<geometry with kitChan, in the base skeleton's bone order>
  const baseGltf = await loader.loadAsync(base + 'base.glb');
  const baseMesh = findSkinned(baseGltf.scene);
  const boneNames = baseMesh.skeleton.bones.map(b => b.name);
  const baseGeo = prepare(baseMesh, -1);
  const clips = Object.fromEntries(baseGltf.animations.map(a => [a.name, a]));

  // a piece's geometry: positions, normals, colours, skinning, and kitChan, the palette slot each
  // vertex reads (0: its own fixed colour, 1: skin, 2 + 4 * slot + channel: the item's channels)
  function prepare(mesh, slotIndex) {
    const src = mesh.geometry;
    const g = new THREE.BufferGeometry();
    g.setIndex(src.index ? src.index.clone() : null);
    g.setAttribute('position', src.attributes.position.clone());
    g.setAttribute('normal', src.attributes.normal.clone());
    const n = src.attributes.position.count;
    const col = new Float32Array(n * 3), chan = new Float32Array(n);
    const c = src.attributes.color, uv = src.attributes.uv;
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.getX(i); col[i * 3 + 1] = c.getY(i); col[i * 3 + 2] = c.getZ(i);
      const code = Math.round(uv.getX(i));
      chan[i] = code <= 1 ? code : 2 + slotIndex * 4 + (code - 2);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('kitChan', new THREE.BufferAttribute(chan, 1));
    // joints: the piece's own bone order -> the base skeleton's
    const own = mesh.skeleton.bones.map(b => boneNames.indexOf(b.name));
    const si = src.attributes.skinIndex, idx = new Uint16Array(n * 4);
    for (let i = 0; i < n * 4; i++) idx[i] = own[si.array[i]];
    g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    const sw = src.attributes.skinWeight, wt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) wt[i * 4 + k] = sw.getComponent(i, k);
    g.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
    return g;
  }

  function piece(file, slot) {
    if (!files.has(file)) {
      files.set(file, loader.loadAsync(base + file).then(gl => prepare(findSkinned(gl.scene), slots.indexOf(slot))));
    }
    return files.get(file);
  }

  function colours(slot, item, spec) {
    const it = catalog.items[slot][item];
    const ways = it.ways, first = Object.keys(ways)[0];
    let cs = spec?.colours ?? ways[spec?.way ?? first] ?? ways[first];
    cs = cs.length ? cs : ['#ffffff'];
    return CH.map((_, i) => cs[Math.min(i, cs.length - 1)]);
  }

  function normalise(look) {
    const out = { skin: look.skin ?? 1 };
    for (const slot of slots) {
      const s = typeof look[slot] === 'string' ? { item: look[slot] } : (look[slot] ?? { item: Object.keys(catalog.items[slot])[0] });
      out[slot] = { item: s.item, colours: colours(slot, s.item, s) };
    }
    return out;
  }

  function randomLook(rng = Math.random) {
    const pick = a => a[Math.floor(rng() * a.length)];
    const look = { skin: Math.floor(rng() * catalog.skinTones.length) };
    for (const slot of slots) {
      const names = Object.keys(catalog.items[slot]);
      const item = slot === 'face' && rng() < 0.55 ? 'none' : pick(names);
      look[slot] = { item, way: pick(Object.keys(catalog.items[slot][item].ways)) };
    }
    return look;
  }

  async function makeKid(look) {
    const kid = new Kid(normalise(look));
    await kid._build();
    return kid;
  }

  class Kid {
    constructor(look) {
      this.look = look;
      this.object = SkeletonUtils.clone(baseGltf.scene);
      const holder = findSkinned(this.object);
      this.skeleton = holder.skeleton;
      this.mesh = null;
      this._holder = holder;
      holder.visible = false;  // the base's own mesh is replaced by the merged kid
      this.palette = Array.from({ length: 2 + slots.length * 4 }, () => new THREE.Color());
      this.material = kidMaterial(this.palette);
      this.mixer = new THREE.AnimationMixer(this.object);
      this.action = null;
      this._applyColours();
    }

    async _build() {
      const look = this.look, items = catalog.items;
      const jobs = [];
      for (const slot of slots) {
        const it = items[slot][look[slot].item];
        if (it.file) jobs.push(piece(it.file, slot));
        if (it.bib && !items.top[look.top.item].outer) jobs.push(piece(it.bib, slot));
      }
      const geos = [baseGeo, ...(await Promise.all(jobs))];
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingSphere();
      const h = this._holder;
      const mesh = new THREE.SkinnedMesh(merged, this.material);
      mesh.name = 'kid';
      mesh.position.copy(h.position); mesh.quaternion.copy(h.quaternion); mesh.scale.copy(h.scale);
      mesh.bind(this.skeleton, h.bindMatrix);
      mesh.frustumCulled = false;  // the clips move it out of its bind-pose bounds
      mesh.castShadow = mesh.receiveShadow = true;
      if (this.mesh) { this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); }
      h.parent.add(mesh);
      this.mesh = mesh;
    }

    _applyColours() {
      const L = this.look, tone = L.skin;
      this.palette[1].set(typeof tone === 'number' ? catalog.skinTones[tone] : tone);
      slots.forEach((slot, s) => L[slot].colours.forEach((hex, c) => this.palette[2 + s * 4 + c].set(hex)));
    }

    /** Put on another item: `colours` is a colourway name, an array of colours, or nothing (its first colourway). */
    async wear(slot, item, colours) {
      const spec = typeof colours === 'string' ? { way: colours } : Array.isArray(colours) ? { colours } : {};
      this.look[slot] = { item, colours: kit.colours(slot, item, spec) };
      this._applyColours();
      await this._build();
    }

    /** Recolour one channel of a slot ('main', 'trim', 'accent' or 'detail'), or all of them with a colourway name. */
    paint(slot, channel, colour) {
      const cs = this.look[slot].colours;
      if (channel in catalog.items[slot][this.look[slot].item].ways && colour === undefined) {
        this.look[slot].colours = kit.colours(slot, this.look[slot].item, { way: channel });
      } else {
        cs[CH.indexOf(channel)] = colour;
      }
      this._applyColours();
    }

    setSkin(tone) { this.look.skin = tone; this._applyColours(); }

    play(name, { fade = 0.2, loop = name !== 'death' } = {}) {
      const clip = clips[name];
      if (!clip) throw new Error(`no clip ${name}`);
      const next = this.mixer.clipAction(clip);
      next.reset();
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      next.clampWhenFinished = !loop;
      if (this.action && this.action !== next) next.crossFadeFrom(this.action, fade, false);
      next.play();
      this.action = next;
      return next;
    }

    update(dt) { this.mixer.update(dt); }

    /** The look as plain data (save it, send it, rebuild it with kit.makeKid). */
    toJSON() { return JSON.parse(JSON.stringify(this.look)); }

    dispose() {
      this.mixer.stopAllAction();
      this.mesh?.geometry.dispose();
      this.material.dispose();
      this.object.removeFromParent();
    }
  }

  const kit = {
    slots, items: catalog.items, looks: catalog.looks, clips: Object.keys(clips), skinTones: catalog.skinTones,
    suggest: catalog.suggest, makeKid, randomLook, colours,
  };
  return kit;
}

function findSkinned(root) {
  let m = null;
  root.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  return m;
}

// A standard material whose vertex colour is either the vertex's own (fixed details) or one of the
// kid's palette slots (skin and the items' channels), chosen per vertex by kitChan.
function kidMaterial(palette) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.kitPal = { value: palette };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float kitChan;
        flat varying int vKitChan;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKitChan = int(kitChan + 0.5);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 kitPal[${palette.length}];
        flat varying int vKitChan;`)
      .replace('#include <color_fragment>', `
        diffuseColor.rgb *= vKitChan == 0 ? vColor.rgb : kitPal[vKitChan];`);
  };
  m.customProgramCacheKey = () => `kidkit${palette.length}`;
  return m;
}
