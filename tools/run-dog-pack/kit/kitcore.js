// The dog kit: breed data, the recolour shader, asset loading and dog assembly
// (body rig + head, ears, tail, coat shells, wearables, held toy), shared by the
// kit viewer (kit/index.html) and the trailer (promo/index.html). Games use
// kit/dogkit.js instead (scripts/package.mjs ships it).
//
//   const kit = await loadKit({ base: 'kit/', scene, redraw, palette: () => 'papercraft' });
//   const dog = kit.makeDog(kit.toSpec(kit.rows[0])); scene.add(dog.group); kit.apply(dog); kit.play(dog, 'trot');
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export async function loadKit({ base = '', scene, redraw = () => {}, query = new URLSearchParams(location.search),
                                palette = () => 'papercraft', makeLabel = null } = {}) {
  // Builds in gallery order (see BREEDS.md). All share one body topology.
  const BUILDS = ['lean', 'shepherd', 'gundog', 'spitz', 'corgi', 'terrier', 'brachy', 'toy',
    'scenthound', 'sighthound', 'mountain', 'mastiff', 'bully', 'spaniel', 'poodle', 'shaggy',
    'toylong', 'lowterrier', 'longlow', 'bulldog', 'bullterrier'];
  // Heads are swappable parts (scripts/build_heads.py). Each build has a default head
  // type until breeds.csv gets a head column.
  // "classic" = the build's own head in the previous style (exported by build_dog.py
  // as heads/classic-<build>.glb); fox/wedge/flat are the two-box papercraft heads.
  // Any of them fits any body.
  const HEAD_FILES = ['fox', 'wedge', 'flat', ...BUILDS.map(b => `classic-${b}`)];
  const HEADS = ['classic', ...HEAD_FILES];
  const HEAD_FOR_BUILD = { corgi: 'fox' };   // everything else: classic
  const headFile = dog => (dog.head === 'classic' ? `classic-${dog.build.replace('legacy:', '')}` : dog.head);
  const EARS = ['prick', 'bat', 'tipped', 'button', 'rose', 'drop', 'long', 'butterfly', 'bell', 'feathered'];
  const TAILS = ['sabre', 'otter', 'whip', 'carrot', 'sickle', 'curl', 'screw', 'plume', 'bob', 'pompom'];
  // Coat shells, and which shell each coat type in breeds.csv uses (wire beards not modelled yet).
  const FURS = ['none', 'ruff', 'puff', 'feathered', 'curly', 'shaggy', 'poodleclip'];
  const COAT_SHELL = { ruff: 'ruff', puff: 'puff', feathered: 'feathered', curly: 'curly', shaggy: 'shaggy',
    corded: 'shaggy', long: 'shaggy', poodleclip: 'poodleclip' };
  // Pattern names used in breeds.csv. region = UV2 projection mask, tile = UV surface texture.
  const PATTERNS = {
    none: null,
    saddle: { region: 'saddle' },
    tuxedo: { region: 'tuxedo' },
    mask: { region: 'mask' },
    points: { region: 'points' },
    piebald: { region: 'piebald' },
    spots: { tile: 'spots' },
    ticking: { tile: 'ticking' },
    merle: { tile: 'merle' },
    brindle: { tile: 'brindle' },
  };
  // Named coat colours used in breeds.csv.
  const COLOURS = {
    black: '#1e1b1a', charcoal: '#3a3838', white: '#f4f1ea', cream: '#efe3c8', fawn: '#d9b98a',
    wheaten: '#dcc28e', yellow: '#e2c48c', lemon: '#e8d090', gold: '#d6a35c', apricot: '#e8b07a',
    orange: '#e09040', tan: '#b8692e', rust: '#a5562a', red: '#b5562b', mahogany: '#6e2e1a',
    sable: '#8a5a30', brown: '#7a4a2a', brindle: '#6a4a30', chocolate: '#5a3a26', liver: '#5a3424',
    grey: '#8c8c8c', silver: '#b9bcc0', slate: '#4e535a', blue: '#6c7a8c', isabella: '#b8a090',
    pink: '#d68f8f',
  };
  const NOSES = ['black', 'liver', 'pink', 'blue', 'isabella'];
  // Body length in metres by size class.
  const SIZE = { XS: 0.32, S: 0.5, M: 0.72, L: 0.95, XL: 1.2 };
  const BUILD_LENGTH = { longlow: 1.2, corgi: 1.1, toylong: 0.9, brachy: 0.9, bulldog: 1.0 };

  const vert = /* glsl */`
    #include <common>
    #include <skinning_pars_vertex>
    attribute vec4 color;
    attribute vec2 uv1;                      // baked dog-space projection (TEXCOORD_1)
    uniform float uvScale;                   // parts: socket scale so spots match the body
    varying vec2 vUv;
    varying vec2 vUv1;
    varying vec3 vNormal;
    varying vec2 vTag;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vUv = uv * uvScale;
      vUv1 = uv1;
      vNormal = normalize(mat3(modelMatrix) * objectNormal);
      vTag = color.rg;                       // r = nose, g = eyes
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }`;
  const frag = /* glsl */`
    uniform vec3 coat, color1, color2, color3, noseColor, eyeColor;
    const vec3 mouthColor = vec3(0.36, 0.13, 0.14);   // inside of the mouth (head back faces)
    uniform sampler2D tex1, tex2, tex3;
    uniform float mode1, mode2, mode3;     // 0 off, 1 region (UV2 projection), 2 tile (UV)
    uniform float isPart;                  // parts take region colours at their socket
    uniform vec2 partUv;
    varying vec2 vUv;
    varying vec2 vUv1;
    varying vec3 vNormal;
    varying vec2 vTag;

    float layer(sampler2D tex, float mode) {
      if (mode < 0.5) return 0.0;
      float t = texture2D(tex, mode < 1.5 ? mix(vUv1, partUv, isPart) : vUv).r;
      float aa = fwidth(t);
      return smoothstep(0.5 - aa, 0.5 + aa, t);
    }

    void main() {
      vec3 c = coat;
      c = mix(c, color1, layer(tex1, mode1));
      c = mix(c, color2, layer(tex2, mode2));
      c = mix(c, color3, layer(tex3, mode3));
      c = mix(c, noseColor, step(0.5, vTag.r));
      c = mix(c, eyeColor, step(0.5, vTag.g));
      if (!gl_FrontFacing) c = mouthColor;
      vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      float sun = max(dot(n, normalize(vec3(0.5, 0.9, 0.6))), 0.0);
      float sky = 0.5 + 0.5 * n.y;
      gl_FragColor = vec4(c * (0.42 + 0.22 * sky + 0.55 * sun), 1.0);
      #include <colorspace_fragment>
    }`;


  // Local dev tool: always fetch fresh assets so rebuilt patterns/models show on refresh.
  const BUST = `?t=${Date.now()}`;
  const texLoader = new THREE.TextureLoader();
  const tex = {};
  for (const p of Object.values(PATTERNS)) {
    if (!p) continue;
    const key = p.region || p.tile;
    const t = texLoader.load(`${base}patterns/${p.region ? 'region' : 'tile'}-${key}.png${BUST}`);
    // Region masks are read through the glTF UV2 set, so use glTF's convention (no vertical flip).
    if (p.region) t.flipY = false;
    else t.wrapS = t.wrapT = THREE.RepeatWrapping;
    tex[key] = t;
  }
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  // ---- data ----
  function parseCsv(text) {
    const [head, ...rows] = text.trim().split('\n').map(l => l.split(','));
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }
  let rows = parseCsv(await (await fetch(`${base}../breeds.csv${BUST}`)).text());
  // ?compare=Pug,Pembroke Welsh Corgi shows those breeds twice: the previous revision
  // (head built into the body, kit/builds-legacy) and the current one (head parts).
  const COMPARE = query.get('compare')?.split(',').map(s => s.trim());
  if (COMPARE) {
    const picked = COMPARE.map(n => rows.find(r => r.breed === n)).filter(Boolean);
    rows = [...picked.map(r => ({ ...r, section: 'previous', legacy: true })),
            ...picked.map(r => ({ ...r, section: 'new' }))];
  }

  // Deterministic random for the Mixed Breed wildcard.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = list => list[Math.floor(rand() * list.length)];

  function toSpec(r) {
    if (r.build === 'any') {
      const layers = [['piebald', pick(Object.keys(COLOURS))]];
      return { name: r.breed, notes: r.notes, build: pick(BUILDS), length: SIZE[r.size], ears: pick(EARS),
               tail: pick(TAILS), fur: pick(FURS), head: pick(HEADS), coat: COLOURS[pick(Object.keys(COLOURS))],
               layers: layers.map(([p, c]) => [p, COLOURS[c]]), nose: COLOURS.black };
    }
    const layers = r.layers ? r.layers.split('|').map(l => l.split(':')).map(([p, c]) => [p, COLOURS[c]]) : [];
    return { name: r.breed, notes: [r.coat !== 'smooth' ? `${r.coat} coat` : '', r.notes].filter(Boolean).join(' · '),
             build: r.legacy ? `legacy:${r.build}` : r.build, legacy: !!r.legacy,
             length: SIZE[r.size] * (BUILD_LENGTH[r.build] || 1), ears: r.ears, tail: r.tail,
             fur: COAT_SHELL[r.coat] || 'none', head: r.head || HEAD_FOR_BUILD[r.build] || 'classic',
             coat: COLOURS[r.base], layers, nose: COLOURS[r.nose] };
  }

  // ---- assets ----
  const gltf = new GLTFLoader();
  const firstMesh = g => { let m; g.scene.traverse(o => { if (o.isMesh && !m) m = o; }); return m.geometry; };
  const builds = {}, parts = {}, heads = {};
  let bodyTris = 0;
  await Promise.all([
    ...[...BUILDS, ...(COMPARE ? BUILDS.map(b => `legacy:${b}`) : [])].map(name =>
      // &dev=1 prefers quick test bakes (build_dog.py --only writes to builds-dev/).
      (name.startsWith('legacy:') ? gltf.loadAsync(`${base}builds-legacy/${name.slice(7)}.glb${BUST}`)
        : query.get('dev')
          ? gltf.loadAsync(`${base}builds-dev/${name}.glb${BUST}`).catch(() => gltf.loadAsync(`${base}builds/${name}.glb${BUST}`))
          : gltf.loadAsync(`${base}builds/${name}.glb${BUST}`)).then(g => {
      const sockets = {};
      g.scene.traverse(o => { if (o.name.startsWith('socket_')) sockets[o.name.slice(7)] = o; });
      const geo = n => g.scene.getObjectByName(n)?.geometry;
      builds[name] = { scene: g.scene, clips: g.animations, sockets,
                       looping: g.scene.getObjectByName('rig')?.userData.looping_clips || [] };
      if (!name.startsWith('legacy:')) bodyTris = geo('dog').index.count / 3;
    })),
    ...HEAD_FILES.map(name => gltf.loadAsync(`${base}heads/${name}.glb${BUST}`).then(g => {
      const sockets = {};
      g.scene.traverse(o => { if (o.name.startsWith('socket_')) sockets[o.name.slice(7)] = o; });
      const geo = n => g.scene.getObjectByName(n)?.geometry;
      const jaw = g.scene.getObjectByName('jaw');
      heads[name] = { geo: geo('head'), jaw: jaw && { geo: jaw.geometry, hinge: jaw.position.clone() },
                      coats: Object.fromEntries(FURS.slice(1).map(c => [c, geo(`coat_${c}`)])), sockets };
    })),
    ...[...EARS.flatMap(e => [`ear-${e}-L`, `ear-${e}-R`]), ...TAILS.map(t => `tail-${t}`)].map(name =>
      gltf.loadAsync(`${base}parts/${name}.glb${BUST}`).then(g => { parts[name] = firstMesh(g); })),
  ]);

  // Wearables (scripts/build_wearables.py, one file per build, skinned to the same
  // bones) and props (scripts/build_props.py). Toys are real size in metres and
  // are held by their socket_grip; harness add-ons are sized for a 0.72 m dog.
  const WEARABLES = ['collar', 'bandana', 'harness', 'vest', 'sweater', 'bags'];
  const wear = {}, toys = {}, addons = {};
  const propList = await (await fetch(`${base}props/props.json${BUST}`)).json();
  const sanitize = THREE.PropertyBinding.sanitizeNodeName;
  // One mesh per prop, materials as a group array, origin moved to the grip point.
  function propMesh(g, at = 'grip') {
    const meshes = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    // Only attributes every piece has (props from different builders can disagree),
    // otherwise the merge fails and the prop vanishes.
    const geos = meshes.map(m => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const common = Object.keys(geos[0].attributes).filter(k => geos.every(g => g.attributes[k]));
    for (const g of geos) for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
    const geo = mergeGeometries(geos, true);
    const grip = g.scene.getObjectByName(`socket_${at}`);
    if (grip) geo.translate(...grip.getWorldPosition(new THREE.Vector3()).negate().toArray());
    geo.computeBoundingBox();
    return { geo, mats: meshes.map(m => Object.assign(m.material, { flatShading: true })) };
  }
  await Promise.all([
    ...BUILDS.map(b => gltf.loadAsync(`${base}wearables/${b}.glb${BUST}`).then(g => { wear[b] = g.scene; }).catch(() => {})),
    ...propList.filter(p => p.holdable && p.category !== 'wear').map(p =>
      gltf.loadAsync(`${base}props/${p.id}.glb${BUST}`).then(g => { toys[p.id] = { ...propMesh(g), label: p.label }; })),
    ...['saddlebag_L', 'saddlebag_R', 'backpack_mini', 'tag_bone'].map(id =>
      gltf.loadAsync(`${base}props/${id}.glb${BUST}`).then(g => { addons[id] = propMesh(g, '-'); })),
  ]);
  const TOY_ORDER = ['ball', ...propList.filter(p => toys[p.id]).map(p => p.id)];

  function makeUniforms() {
    const u = { eyeColor: { value: new THREE.Color('#151313') }, coat: { value: new THREE.Color() },
                noseColor: { value: new THREE.Color() } };
    for (const i of [1, 2, 3]) {
      u[`color${i}`] = { value: new THREE.Color() };
      u[`tex${i}`] = { value: blank };
      u[`mode${i}`] = { value: 0 };
    }
    return u;
  }
  // Body and parts share the colour uniforms; only the part-specific ones differ.
  function material(shared, part) {
    return new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { ...shared, isPart: { value: part ? 1 : 0 }, partUv: { value: new THREE.Vector2() },
                  uvScale: { value: 1 } },
    });
  }

  // A dog is a clone of its build's rig (skinned body + coat shells + sockets on
  // bones), with parts hung on the sockets: tail on socket_tail, the head group
  // on socket_head (head, head fluff, ears on the head's own sockets, and an
  // optional toy on socket_mouth). Every piece shares one set of colour uniforms.
  const toyGeo = new THREE.IcosahedronGeometry(0.2, 1);
  function makeDog(spec) {
    const group = new THREE.Group();
    const shared = makeUniforms();
    const mesh = part => new THREE.Mesh(undefined, material(shared, part));
    const tail = mesh(true), head = mesh(false), headFur = mesh(false), earL = mesh(true), earR = mesh(true);
    const jaw = mesh(false);
    head.material.side = jaw.material.side = THREE.DoubleSide;   // back faces = inside of the mouth
    const toy = new THREE.Mesh(toyGeo, new THREE.MeshLambertMaterial({ color: 0xe8573c, flatShading: true }));
    const headGroup = new THREE.Group();
    headGroup.add(head, jaw, headFur, earL, earR, toy);
    const label = makeLabel ? makeLabel(spec) : new THREE.Object3D();
    const dog = { ...spec, layers: spec.layers.map(l => [...l]), group, bodyMat: material(shared, false),
                  tail: spec.tail, tailMesh: tail, headGroup, head: spec.head, headMesh: head, headFur, ears: spec.ears,
                  earMeshes: { L: earL, R: earR }, jawMesh: jaw, toyMesh: toy, toy: false, held: true, shared, label,
                  rig: null, rigBuild: null, toyMat: toy.material,
                  toyKind: query.get('toyKind') || 'ball',
                  wear: new Set((query.get('wear') || '').split(',').filter(Boolean)),
                  wearObjs: [] };
    for (const m of [tail, head, jaw, headFur, earL, earR, toy]) m.userData.dog = dog;
    return dog;
  }

  function place(mesh, socket, extraScale = 1) {
    mesh.position.copy(socket.position);
    mesh.scale.copy(socket.scale).multiplyScalar(extraScale);
  }

  function attachTo(socket, obj, scale = 1) {
    socket.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.setScalar(scale);
  }

  function buildRig(dog) {
    if (dog.rig) dog.group.remove(dog.rig);
    const rig = SkeletonUtils.clone(builds[dog.build].scene);
    dog.sockets = {};
    dog.coatMeshes = {};
    rig.traverse(o => {
      if (o.name.startsWith('socket_')) dog.sockets[o.name.slice(7)] = o;
      if (o.isMesh) {
        o.material = dog.bodyMat;
        o.frustumCulled = false;
        o.userData.dog = dog;
        if (o.name.startsWith('coat_')) dog.coatMeshes[o.name.slice(5)] = o;
      }
    });
    dog.jawBone = rig.getObjectByName('jaw');
    dog.jawRest = dog.jawBone?.quaternion.clone();
    dog.gripBone = rig.getObjectByName('grip');
    dog.group.add(rig);
    dog.rig = rig;
    dog.rigBuild = dog.build;
    dog.mixer = null;
  }

  function apply(dog) {
    if (dog.rigBuild !== dog.build) buildRig(dog);
    const b = builds[dog.build], h = heads[headFile(dog)], sk = dog.sockets;
    for (const [name, m] of Object.entries(dog.coatMeshes)) m.visible = name === dog.fur;

    dog.tailMesh.geometry = parts[`tail-${dog.tail}`];
    attachTo(sk.tail, dog.tailMesh);
    dog.tailMesh.material.uniforms.partUv.value.fromArray(sk.tail.userData.uv2);
    dog.tailMesh.material.uniforms.uvScale.value = sk.tail.scale.x;

    if (!sk.head) {   // previous revision: head is part of the body, ears sit on the body
      for (const side of ['L', 'R']) {
        const m = dog.earMeshes[side], s = sk[`ear_${side}`];
        m.geometry = parts[`ear-${dog.ears}-${side}`];
        attachTo(s, m);
        m.material.uniforms.partUv.value.fromArray(s.userData.uv2);
        m.material.uniforms.uvScale.value = s.scale.x;
      }
      dog.toyMesh.visible = false;
    } else {
      const hs = sk.head, headScale = hs.scale.x;
      attachTo(hs, dog.headGroup);
      dog.headMesh.geometry = h.geo;
      dog.jawMesh.visible = !!h.jaw;
      if (h.jaw) { dog.jawMesh.geometry = h.jaw.geo; dog.jawMesh.position.copy(h.jaw.hinge); }
      dog.jawMesh.material.uniforms.uvScale.value = headScale;
      dog.headMesh.material.uniforms.uvScale.value = headScale;
      dog.headFur.visible = dog.fur !== 'none' && !!h.coats[dog.fur];
      if (dog.headFur.visible) dog.headFur.geometry = h.coats[dog.fur];
      dog.headFur.material.uniforms.uvScale.value = headScale;
      for (const side of ['L', 'R']) {
        const m = dog.earMeshes[side], s = h.sockets[`ear_${side}`];
        m.geometry = parts[`ear-${dog.ears}-${side}`];
        place(m, s, hs.userData.ear_scale ?? 1);
        m.material.uniforms.partUv.value.fromArray(s.userData.uv2);
        m.material.uniforms.uvScale.value = headScale * m.scale.x;
      }
      dog.mouth = h.sockets.mouth;
      dog.noseSock = h.sockets.nose;
      const kind = toys[dog.toyKind];
      dog.toyMesh.geometry = kind ? kind.geo : toyGeo;
      dog.toyMesh.material = kind ? kind.mats : dog.toyMat;
      if (dog.toyMesh.parent === dog.headGroup || !dog.toy) holdToy(dog);
      dog.toyMesh.visible = dog.toy && !!h.sockets.mouth;
    }

    dog.group.scale.setScalar(dog.length);
    applyWear(dog);
    dog.label.position.set(dog.group.position.x, -0.12, dog.group.position.z + 0.35);
    const u = dog.shared, pal = paletteFn();
    u.coat.value.set(pal(dog.coat));
    u.noseColor.value.set(dog.nose);
    for (const i of [1, 2, 3]) {
      const [name, color] = dog.layers[i - 1] || ['none', '#ffffff'];
      const p = PATTERNS[name];
      u[`color${i}`].value.set(pal(color));
      u[`tex${i}`].value = p ? tex[p.region || p.tile] : blank;
      u[`mode${i}`].value = !p ? 0 : p.region ? 1 : 2;
    }
    redraw();
  }

  // ---- props: jaw + held toy ----
  // Rig protocol: the `jaw` bone's rotation (relative to rest) opens the head
  // part's jaw; the `grip` bone's scale says whether the mouth holds the toy
  // (1 = held, 0 = let go). Engines can read these two bones the same way.
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  const toyFloor = dog => (toys[dog.toyKind] ? -toys[dog.toyKind].geo.boundingBox.min.y : 0.2);

  // ---- wearables: skinned to the dog's own skeleton ----
  // The wearable files carry the build's skeleton; their meshes are rebound to the
  // dog's bones by name (same bind pose), so they follow every clip. Coat refits
  // (`collar@ruff`) are used when the dog wears that coat shell.
  function rebind(src, skeleton) {
    const key = skeleton.bones.map(b => b.name).join();
    src.userData.remap ??= {};
    if (!src.userData.remap[key]) {
      const map = src.skeleton.bones.map(b => skeleton.bones.findIndex(x => x.name === b.name));
      const geo = src.geometry.clone(), si = geo.attributes.skinIndex;
      for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) si.setComponent(i, c, Math.max(0, map[si.getComponent(i, c)]));
      src.userData.remap[key] = geo;
    }
    return src.userData.remap[key];
  }
  // Rest-pose point in dog space -> a child of `bone` at that point.
  function hangOnBone(dog, body, obj, pos, boneName) {
    const i = body.skeleton.bones.findIndex(b => b.name === sanitize(boneName));
    if (i < 0) return;
    const inv = body.skeleton.boneInverses[i];
    obj.position.copy(pos).applyMatrix4(inv);
    obj.quaternion.setFromRotationMatrix(inv);
    body.skeleton.bones[i].add(obj);
    dog.wearObjs.push(obj);
  }
  function applyWear(dog) {
    for (const o of dog.wearObjs) o.removeFromParent();
    dog.wearObjs = [];
    const src = wear[dog.build], body = dog.rig?.getObjectByName('dog');
    if (!src || !body?.isSkinnedMesh) return;
    const items = [...dog.wear].filter(w => w !== 'bags');
    if (dog.wear.has('bags') && !items.some(w => w === 'harness' || w === 'vest')) items.push('harness');
    for (const item of items) {
      const name = src.getObjectByName(`${item}@${dog.fur}`) ? `${item}@${dog.fur}` : item;
      src.getObjectByName(name)?.traverse(o => {
        if (!o.isSkinnedMesh) return;
        const m = new THREE.SkinnedMesh(rebind(o, body.skeleton), o.material);
        m.frustumCulled = false;
        m.userData.dog = dog;
        body.parent.add(m);
        m.bind(body.skeleton, body.bindMatrix);
        dog.wearObjs.push(m);
      });
    }
    // Add-ons on the wearables' sockets, sized for a 0.72 m dog (dog space is length 1).
    const k = 1 / 0.72;
    const socket = (item, point) => {
      const name = src.getObjectByName(`${item}@${dog.fur}`) ? `${item}@${dog.fur}` : item;
      return src.getObjectByName(sanitize(`socket_${name}.${point}`));
    };
    const hang = (id, s) => {
      if (!s || !addons[id]) return;
      const m = new THREE.Mesh(addons[id].geo, addons[id].mats);
      m.scale.setScalar(k);
      m.userData.dog = dog;
      const g = new THREE.Group();
      g.add(m);
      hangOnBone(dog, body, g, s.position, s.userData.bone);
    };
    if (items.includes('collar')) hang('tag_bone', socket('collar', 'tag'));
    if (dog.wear.has('bags')) {
      const holder = items.includes('vest') ? 'vest' : 'harness';
      hang('saddlebag_L', socket(holder, 'pack_L'));
      hang('saddlebag_R', socket(holder, 'pack_R'));
    }
  }

  function holdToy(dog) {
    dog.headGroup.add(dog.toyMesh);
    if (dog.mouth) dog.toyMesh.position.copy(dog.mouth.position);
    // Prop toys are real size: undo the dog's scale and the head-part units.
    dog.toyMesh.scale.setScalar(toys[dog.toyKind] && dog.sockets.head ? 1 / (dog.length * dog.sockets.head.scale.x) : 1);
    dog.held = true;
    dog.toyFly = dog.toyFall = dog.toyThrow = null;
  }
  function releaseToy(dog) {
    dog.toyMesh.getWorldPosition(_v);
    const s = dog.toyMesh.getWorldScale(new THREE.Vector3()).x;
    scene.attach(dog.toyMesh);
    dog.held = false;
    // Keeps the mouth's momentum, so a toss flies and a drop just falls.
    const v = dog.mouthVel || new THREE.Vector3();
    dog.toyFall = { vx: v.x, vy: v.y, vz: v.z, radius: toyFloor(dog) * s, floor: dog.group.position.y };
  }
  function updateProps(dog, dt) {
    if (dog.jawBone && dog.jawRest) {
      _q.copy(dog.jawRest).invert().multiply(dog.jawBone.quaternion);
      dog.jawMesh.rotation.z = 2 * Math.atan2(_q.x + _q.y + _q.z, _q.w) * JAW_SIGN;
    }
    if (!dog.toy) return;
    if (dog.mouth && dt > 0) {   // mouth velocity, handed to the toy when it's let go
      const m = dog.headGroup.localToWorld(dog.mouth.position.clone());
      if (dog.mouthPrev) dog.mouthVel = m.clone().sub(dog.mouthPrev).divideScalar(dt);
      dog.mouthPrev = m;
    }
    const grip = dog.gripBone ? dog.gripBone.scale.x > 0.5 : true;
    if (dog.toyThrow && !dog.held) {   // thrown toy: arc that lands in the mouth at the grab
      const th = dog.toyThrow;
      th.t += dt;
      if (th.ride && th.t < th.delay) {   // treat balanced on the nose until the flip
        dog.headGroup.localToWorld(dog.toyMesh.position.copy(th.ride.position));
        th.from.copy(dog.toyMesh.position);
        return;
      }
      const u = Math.min(1, (th.t - (th.delay || 0)) / (th.T - (th.delay || 0)));
      dog.toyMesh.position.lerpVectors(th.from, th.to, u);
      dog.toyMesh.position.y += Math.sin(Math.PI * u) * th.peak;
      if (u >= 1) dog.toyThrow = null;
    }
    if (grip && !dog.held && !dog.toyFly && !dog.toyThrow) {
      dog.toyFly = { t: 0, from: dog.toyMesh.position.clone() };   // fly/snap into the mouth
    }
    if (!grip && dog.held) releaseToy(dog);
    if (dog.toyFly) {
      dog.toyFly.t += dt / 0.12;
      const target = dog.headGroup.localToWorld(dog.mouth.position.clone());
      dog.toyMesh.position.lerpVectors(dog.toyFly.from, target, Math.min(1, dog.toyFly.t));
      if (dog.toyFly.t >= 1) holdToy(dog);
    } else if (dog.toyFall) {
      const f = dog.toyFall;
      f.vy -= 9.8 * dt;
      dog.toyMesh.position.x += f.vx * dt;
      dog.toyMesh.position.z += f.vz * dt;
      dog.toyMesh.position.y = Math.max(f.floor + f.radius, dog.toyMesh.position.y + f.vy * dt);
      if (dog.toyMesh.position.y <= f.floor + f.radius) {   // bounce, and roll to a stop
        f.vy = -f.vy * 0.35;
        f.vx *= 0.9; f.vz *= 0.9;
      }
    }
  }
  const JAW_SIGN = 1;

  // Clips that start with the mouth empty and grab later (pick_up, jump_catch):
  // put the toy where the mouth will be at the grab, on the floor or thrown.
  function gripTimes(clip) {
    const tr = clip.tracks.find(t => t.name.startsWith('grip') && t.name.endsWith('.scale'));
    if (!tr) return null;
    const v = i => tr.values[i * 3];
    for (let i = 1; i < tr.times.length; i++) if (v(i - 1) < 0.5 && v(i) >= 0.5) return { start: v(0), grab: tr.times[i] };
    return { start: v(0), grab: null };
  }
  function stageToy(dog, clip) {
    if (!dog.toy || !dog.mouth) return;
    const g = gripTimes(clip);
    if (!g || g.start >= 0.5 || g.grab == null) { if (!g || g.start >= 0.5) holdToy(dog); return; }
    dog.mixer.setTime(g.grab);
    dog.rig.updateMatrixWorld(true);
    updateProps(dog, 0);
    const at = dog.headGroup.localToWorld(dog.mouth.position.clone());
    dog.mixer.setTime(0);
    scene.attach(dog.toyMesh);
    dog.held = false;
    dog.toyFall = dog.toyFly = null;
    const r = toyFloor(dog) * dog.toyMesh.getWorldScale(new THREE.Vector3()).x;
    if (clip.name.includes('balance') && dog.noseSock) {
      // Treat on the nose: rides it until the flip, then arcs up into the mouth.
      dog.toyThrow = { from: new THREE.Vector3(), to: at, t: 0, T: g.grab, delay: g.grab - 0.35,
                       peak: dog.length * 0.25, ride: dog.noseSock };
      dog.headGroup.localToWorld(dog.toyMesh.position.copy(dog.noseSock.position));
    } else if (clip.name.includes('catch')) {
      const from = at.clone().add(new THREE.Vector3(dog.length * 1.6, -at.y + dog.group.position.y + r, 0));
      dog.toyThrow = { from, to: at, t: 0, T: g.grab, peak: dog.length * 0.9 };
      dog.toyMesh.position.copy(from);
    } else {
      dog.toyThrow = null;
      dog.toyMesh.position.set(at.x, dog.group.position.y + r, at.z);
    }
  }

  // ---- animation ----
  const clock = new THREE.Clock();
  const playing = new Set();
  function play(dog, name) {
    const b = builds[dog.build];
    const clip = b.clips.find(c => c.name === name);
    if (!dog.mixer) dog.mixer = new THREE.AnimationMixer(dog.rig);
    dog.mixer.stopAllAction();
    if (!clip) { playing.delete(dog); dog.mixer.update(0); redraw(); return; }
    const action = dog.mixer.clipAction(clip);
    action.setLoop(b.looping.includes(name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.reset().play();
    stageToy(dog, clip);
    playing.add(dog);
    clock.getDelta();
  }

  // Papercraft palette: coat colours pushed toward soft pastels (lighter, less
  // saturated), like the concepts. Breed data stays in natural colours.
  function paletteFn() {
    if (palette() !== 'papercraft') return c => c;
    return c => {
      const col = new THREE.Color(c), hsl = {};
      col.getHSL(hsl);
      // Soften mid and light tones; darks (black, liver, chocolate) stay deep.
      const lift = 0.22 * THREE.MathUtils.smoothstep(hsl.l, 0.15, 0.55);
      col.setHSL(hsl.h, hsl.s * (1 - 0.28 * lift / 0.22), hsl.l + (1 - hsl.l) * lift);
      return `#${col.getHexString()}`;
    };
  }

  return { BUILDS, HEAD_FILES, HEADS, HEAD_FOR_BUILD, EARS, TAILS, FURS, COAT_SHELL, PATTERNS, COLOURS, NOSES, SIZE,
           BUILD_LENGTH, rows, COMPARE, toSpec, builds, parts, heads, get bodyTris() { return bodyTris; },
           WEARABLES, toys, addons, propList, TOY_ORDER, makeDog, apply, play, playing, clock, updateProps, holdToy,
           releaseToy, stageToy, gripTimes, paletteFn, propMesh, gltf };
}
