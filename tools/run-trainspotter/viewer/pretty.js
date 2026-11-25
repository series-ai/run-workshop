// pretty.js: the viewer's look. Warm sun with soft shadows, a gradient sky with haze,
// ambient occlusion, bloom on lamps and lit windows, tilt-shift, colour grading and a
// vignette, drifting dust motes, and a time of day from morning to night.
//
//   const pretty = new Pretty(renderer, scene, camera, { kit, controls });
//   pretty.fit(box);               // shadows and dust sized to the railway's bounds
//   pretty.setTime(0.3);           // 0 morning ... 1 night (or pretty.setPreset('Dusk'))
//   pretty.render(dt);             // every frame, instead of renderer.render
//
// Meshes added later (trains, scenery) are adopted automatically: they cast and receive
// shadows, and their atlas materials get an emissive map of their lamp and window texels.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- times of day
// Keyframes from morning (0) to night (1); setTime interpolates between neighbours.
export const PRESETS = {
  Morning: { t: 0.0, elev: 22, azim: 120, sun: '#ffe2bd', sunI: 2.6, sky: '#8fc0ec', horizon: '#f3dcc0', ground: '#6f7a58', hemiI: 1.15, fog: '#e6d8c6',
    fogD: 0.00012, exposure: 1.0, glow: 0.0, bloom: 0.12, dust: 1.0, windows: 0.0 },
  Noon: { t: 0.25, elev: 58, azim: 160, sun: '#fff6e8', sunI: 3.0, sky: '#6fa8e6', horizon: '#cfe3f3', ground: '#6b7b5a', hemiI: 1.25, fog: '#d5e4ef',
    fogD: 0.00008, exposure: 1.0, glow: 0.0, bloom: 0.1, dust: 0.7, windows: 0.0 },
  'Golden hour': { t: 0.5, elev: 12, azim: 235, sun: '#ffbf7a', sunI: 2.8, sky: '#7fa6d8', horizon: '#ffc58f', ground: '#6a5f4a', hemiI: 0.9, fog: '#f0c79c',
    fogD: 0.00012, exposure: 1.05, glow: 0.2, bloom: 0.18, dust: 1.3, windows: 0.1 },
  Dusk: { t: 0.75, elev: 3, azim: 255, sun: '#ff8f5a', sunI: 1.3, sky: '#3b4f86', horizon: '#e98c6c', ground: '#3b3b44', hemiI: 0.55, fog: '#8a6f80',
    fogD: 0.00014, exposure: 1.15, glow: 0.9, bloom: 0.4, dust: 0.35, windows: 0.45 },
  Night: { t: 1.0, elev: 34, azim: 300, sun: '#9fb7ff', sunI: 0.55, sky: '#0b1328', horizon: '#26324f', ground: '#12141c', hemiI: 0.55, fog: '#1a2236',
    fogD: 0.00012, exposure: 1.3, glow: 1.4, bloom: 0.55, dust: 0.1, windows: 0.6 },
};
const KEYS = Object.values(PRESETS).sort((a, b) => a.t - b.t);

export function mixPreset(t) {
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = (t - a.t) / (b.t - a.t);
  const out = {};
  for (const k of Object.keys(a)) {
    if (typeof a[k] === 'string') out[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), f);
    else out[k] = a[k] + (b[k] - a[k]) * f;
  }
  // the sun's direction swings the short way round
  let d = b.azim - a.azim;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  out.azim = a.azim + d * f;
  return out;
}

export const QUALITY = {
  High: { ao: true, bloom: true, tilt: true, grade: true, shadows: 4096, pixelRatio: 1.5, dust: 700 },
  Medium: { ao: false, bloom: true, tilt: true, grade: true, shadows: 2048, pixelRatio: 1, dust: 450 },
  Low: { ao: false, bloom: false, tilt: false, grade: true, shadows: 0, pixelRatio: 1, dust: 200 },
};

// ---------------------------------------------------------------- shaders
const TiltShiftShader = {
  uniforms: { tDiffuse: { value: null }, delta: { value: new THREE.Vector2(1 / 1024, 0) }, focus: { value: 0.5 }, band: { value: 0.17 },
    amount: { value: 1.0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  // a separable 17-tap Gaussian blur whose radius grows smoothly outside a sharp band around `focus`
  // (taps at half spacing, so strong settings stay smooth instead of ghosting)
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 delta; uniform float focus, band, amount; varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - focus);
      float k = amount * smoothstep(band, band + 0.12 + band * 1.6, d) * 1.5; // a thin band ramps fast, a wide one gently
      if (k < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 s = delta * k * 0.5;
      vec4 c = texture2D(tDiffuse, vUv);
      float wsum = 1.0;
      for (int i = 1; i <= 8; i++) {
        float w = exp(-float(i * i) / 22.0);
        c += (texture2D(tDiffuse, vUv + float(i) * s) + texture2D(tDiffuse, vUv - float(i) * s)) * w;
        wsum += 2.0 * w;
      }
      gl_FragColor = c / wsum;
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, warmth: { value: 0.04 }, saturation: { value: 1.12 }, contrast: { value: 1.06 },
    vignette: { value: 0.42 }, lift: { value: 0.012 }, aspect: { value: 1.5 }, grain: { value: 1.6 / 255.0 }, time: { value: 0 } },
  vertexShader: TiltShiftShader.vertexShader,
  // runs after OutputPass, on display-referred colour
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float warmth, saturation, contrast, vignette, lift, aspect, grain, time; varying vec2 vUv;
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031 + time); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c += vec3(warmth, warmth * 0.35, -warmth * 0.6) * (0.4 + 0.6 * c);       // warm the mids and highlights
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c = c * (1.0 - lift) + lift * vec3(0.55, 0.6, 0.75);                       // a touch of cool in the shadows
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
      c += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 71.3) - 1.0) * grain;  // triangular dither: no banding in skies and haze
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const SkyShader = {
  uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, sunSize: { value: 0.9995 } },
  vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: /* glsl */`
    uniform vec3 top, horizon, ground, sunDir, sunColor; uniform float sunSize; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.65)) : mix(horizon, ground, smoothstep(0.0, 0.12, -h));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      c += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6);                // the glow round the sun
      c += sunColor * smoothstep(sunSize, sunSize + 0.0004, s) * 2.0;           // the disc
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const DustShader = {
  uniforms: { time: { value: 0 }, focus: { value: new THREE.Vector3() }, box: { value: new THREE.Vector3(700, 220, 700) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, color: { value: new THREE.Color('#fff1d6') }, brightness: { value: 1 },
    scale: { value: 600 }, size: { value: 2.2 } },
  vertexShader: /* glsl */`
    uniform float time, scale, size; uniform vec3 focus, box;
    attribute vec3 seed; varying float vFade; varying vec3 vWorld;
    void main() {
      // slow wind plus a gentle swirl, wrapped into a box that follows the camera's focus
      vec3 p = position + vec3(time * 4.0, time * 0.6, time * 1.5)
             + vec3(sin(time * 0.21 + seed.x * 6.28), sin(time * 0.17 + seed.y * 6.28) * 0.6, cos(time * 0.19 + seed.z * 6.28)) * 18.0;
      vec3 lo = focus - box * 0.5;
      p = lo + mod(p - lo, box);
      vec3 edge = min(p - lo, lo + box - p) / box;
      vFade = smoothstep(0.0, 0.12, min(min(edge.x, edge.y), edge.z)) * (0.55 + 0.45 * seed.x);
      vWorld = p;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_PointSize = size * (0.6 + seed.y) * scale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color, sunDir; uniform float brightness; varying float vFade; varying vec3 vWorld;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.0, length(q));
      // motes catch the light: brighter when you look toward the sun
      vec3 view = normalize(vWorld - cameraPosition);
      float glint = 0.35 + 1.6 * pow(max(dot(view, normalize(sunDir)), 0.0), 3.0);
      gl_FragColor = vec4(color * a * vFade * glint * brightness * 0.5, 1.0);
    }`,
};

// ---------------------------------------------------------------- emissive lamps and windows
// Fixed lamp ramps glow in their own colour; window glass glows warm at night.
const LAMPS = [['sand', [7]], ['ember', [6, 7]], ['gold', [7]], ['toxic', [4, 5]], ['plasma', [5, 6, 7]]];
const GLASS = [['navy', [2, 3, 4, 5, 6]]];
const WINDOW_GLOW = [255, 196, 120];

function hexRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Two canvases from an atlas image: lamp texels (own colour) and window texels (warm), the rest black. */
function emissiveMaps(image, ramps) {
  const w = image.width, h = image.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const src = ctx.getImageData(0, 0, w, h).data;
  const pick = (list) => list.flatMap(([r, shades]) => (ramps[r] ? shades.map((s) => hexRgb(ramps[r][s])) : []));
  const lamps = pick(LAMPS), glass = pick(GLASS);
  // atlas texels are exact palette colours; a tolerance of 1 absorbs rounding without catching
  // neighbouring ramps (bone 6 is only 3 away from sand 7)
  const near = (d, i, cols) => cols.some((q) => Math.abs(d[i] - q[0]) + Math.abs(d[i + 1] - q[1]) + Math.abs(d[i + 2] - q[2]) <= 1);
  const lampImg = ctx.createImageData(w, h), winImg = ctx.createImageData(w, h);
  let lit = 0, win = 0;
  for (let i = 0; i < src.length; i += 4) {
    lampImg.data[i + 3] = winImg.data[i + 3] = 255;
    if (near(src, i, lamps)) {
      lampImg.data[i] = src[i]; lampImg.data[i + 1] = src[i + 1]; lampImg.data[i + 2] = src[i + 2];
      lit++;
    } else if (near(src, i, glass)) {
      winImg.data[i] = WINDOW_GLOW[0]; winImg.data[i + 1] = WINDOW_GLOW[1]; winImg.data[i + 2] = WINDOW_GLOW[2];
      win++;
    }
  }
  const toCanvas = (img) => { const k = document.createElement('canvas'); k.width = w; k.height = h; k.getContext('2d').putImageData(img, 0, 0); return k; };
  return { lamps: lit ? toCanvas(lampImg) : null, windows: win ? toCanvas(winImg) : null };
}

// ---------------------------------------------------------------- the look
export class Pretty {
  constructor(renderer, scene, camera, { kit = null, controls = null, quality = 'High' } = {}) {
    Object.assign(this, { renderer, scene, camera, kit, controls });
    this.time = 0;
    this.clock = 0;
    this.tiltAmount = 2.2;
    this.dustOn = true;
    this.shadowsOn = true;
    this.box = new THREE.Box3(new THREE.Vector3(-800, 0, -800), new THREE.Vector3(800, 200, 800));
    this._adoptTimer = 0;
    this.fadeU = { colour: { value: new THREE.Color() }, centre: { value: new THREE.Vector2() }, range: { value: new THREE.Vector2(2000, 8000) } };
    this._emissive = new Map(); // atlas image -> {lamps, windows} textures
    this._mats = new Set();

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // lights
    this.hemi = new THREE.HemisphereLight('#9cc3e6', '#6b7b5a', 1.2);
    this.sun = new THREE.DirectionalLight('#fff0dc', 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 3;
    this.fill = new THREE.DirectionalLight('#9fb8ff', 0.35); // a cool bounce from the other side
    scene.add(this.hemi, this.sun, this.sun.target, this.fill);
    this.lamps = []; // a few point lights at lamp posts near the focus, at dusk and night
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffc98a', 0, 110, 2);
      l.visible = false;
      scene.add(l);
      this.lamps.push(l);
    }

    // sky dome and haze
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ ...SkyShader, uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
      side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.sky.userData.prettySkip = true;
    scene.add(this.sky);
    scene.background = null;
    scene.fog = new THREE.FogExp2('#d5e4ef', 0.0002);

    // dust motes
    this.dust = this._makeDust(QUALITY.High.dust);
    scene.add(this.dust);

    this._buildComposer();
    this.setQuality(quality);
    this.setTime(0.12);
  }

  _makeDust(n) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { pos[i] = (Math.random() - 0.5) * 4000; seed[i] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    const m = new THREE.ShaderMaterial({ ...DustShader, uniforms: THREE.UniformsUtils.clone(DustShader.uniforms), transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.userData.prettySkip = true;
    return p;
  }

  _buildComposer() {
    const { renderer, scene, camera } = this;
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.aoPass = new GTAOPass(scene, camera, size.x, size.y);
    this.aoPass.updateGtaoMaterial({ radius: 9, distanceExponent: 1.4, thickness: 3, scale: 1.0, samples: 12 });
    this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.aoPass.blendIntensity = 0.85;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.15, 0.55, 0.92);
    this.outputPass = new OutputPass();
    this.tiltH = new ShaderPass(TiltShiftShader);
    this.tiltV = new ShaderPass(TiltShiftShader);
    this.gradePass = new ShaderPass(GradeShader);
    for (const p of [this.renderPass, this.aoPass, this.bloomPass, this.outputPass, this.tiltH, this.tiltV, this.gradePass]) this.composer.addPass(p);
  }

  setQuality(name) {
    const q = QUALITY[name] ?? QUALITY.High;
    this.quality = name;
    this.q = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.aoPass.enabled = q.ao;
    this.bloomPass.enabled = q.bloom;
    this.tiltH.enabled = this.tiltV.enabled = q.tilt && this.tiltAmount > 0;
    this.gradePass.enabled = q.grade;
    this.setShadows(this.shadowsOn);
    this.dust.geometry.setDrawRange(0, q.dust);
    this.resize();
  }

  setShadows(on) {
    this.shadowsOn = on;
    const size = this.q?.shadows ?? 2048;
    this.sun.castShadow = on && size > 0;
    if (size > 0 && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Half-height of the sharp band round the focus, as a fraction of the screen (0.02 thin .. 0.45 wide). */
  setTiltBand(band) {
    this.tiltBand = band;
    for (const p of [this.tiltH, this.tiltV]) p.uniforms.band.value = band;
  }

  /**
   * Tilt-shift focus: ease the sharp band to a world point (say, where the user clicked), or pass
   * null to follow the orbit target again. The point stays in focus as the camera moves; give
   * the object it lies on (a train car) and the focus rides along with it.
   */
  focusOn(point, object = null) {
    this.focusGoal = point ? point.clone() : null;
    this.focusObject = point && object ? { object, local: object.worldToLocal(point.clone()) } : null;
  }

  setTilt(amount) {
    this.tiltAmount = amount;
    this.tiltH.enabled = this.tiltV.enabled = this.q.tilt && amount > 0;
  }

  setDust(on) {
    this.dustOn = on;
    this.dust.visible = on;
  }

  resize() {
    const s = this.renderer.getSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(s.x, s.y);
    this.tiltH.uniforms.delta.value.set(1 / (s.x * pr), 0);
    this.tiltV.uniforms.delta.value.set(0, 1 / (s.y * pr));
    this.gradePass.uniforms.aspect.value = s.x / s.y;
    this.dust.material.uniforms.scale.value = s.y * pr * 0.5;
  }

  /** Size the shadow camera, haze and dust to a railway's bounds. */
  fit(box) {
    this.box.copy(box);
    const size = box.getSize(new THREE.Vector3());
    // ground marked userData.horizonFade melts into the sky's horizon beyond the railway
    const c = box.getCenter(new THREE.Vector3()), reach = Math.max(size.x, size.z) * 0.5 + 700;
    this.fadeU.centre.value.set(c.x, c.z);
    this.fadeU.range.value.set(reach, reach + 6500);
    // ambient occlusion only round the railway: far off, grazing flat ground picks up false
    // occlusion, which would leave the faded ground a shade darker than the sky it meets
    this.aoPass.setSceneClipBox(box.clone().expandByVector(new THREE.Vector3(500, 400, 500)));
    const r = Math.max(size.x, size.z) * 0.62 + 120;
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = r * 6;
    cam.updateProjectionMatrix();
    this.span = Math.max(size.x, size.z);
    this.setTime(this.time);
  }

  setPreset(name) {
    this.setTime(PRESETS[name].t);
  }

  /** 0 morning, 0.25 noon, 0.5 golden hour, 0.75 dusk, 1 night. */
  setTime(t) {
    this.time = t;
    const p = mixPreset(t);
    this.p = p;
    const e = THREE.MathUtils.degToRad(p.elev), a = THREE.MathUtils.degToRad(p.azim);
    this.sunDir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).normalize();
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.fill.intensity = 0.25 + 0.2 * (1 - p.windows);
    this.hemi.color.copy(p.sky).lerp(new THREE.Color('#ffffff'), 0.25);
    this.hemi.groundColor.copy(p.ground);
    this.hemi.intensity = p.hemiI;
    const u = this.sky.material.uniforms;
    u.top.value.copy(p.sky); u.horizon.value.copy(p.horizon); u.ground.value.copy(p.ground).lerp(p.horizon, 0.35);
    this.fadeU.colour.value.copy(p.horizon); // the far ground becomes the sky at the horizon
    u.sunDir.value.copy(this.sunDir);
    u.sunColor.value.copy(p.sun).multiplyScalar(t > 0.9 ? 0.35 : 1); // at night it's the moon
    this.scene.fog.color.copy(p.fog);
    this.scene.fog.density = p.fogD * (1600 / Math.max(800, this.span ?? 1600));
    this.renderer.toneMappingExposure = p.exposure;
    this.bloomPass.strength = p.bloom;
    this.bloomPass.threshold = p.glow > 0.5 ? 0.82 : 0.95;
    const du = this.dust.material.uniforms;
    du.brightness.value = p.dust;
    du.color.value.copy(p.sun).lerp(new THREE.Color('#ffffff'), 0.4);
    du.sunDir.value.copy(this.sunDir);
    const warm = t < 0.6 ? 0.04 : t < 0.85 ? 0.06 : 0.0;
    this.gradePass.uniforms.warmth.value = warm;
    this.gradePass.uniforms.vignette.value = 0.38 + 0.2 * p.windows;
    for (const m of this._mats) this._applyGlow(m);
  }

  // ---------------------------------------------------------------- adopting meshes
  /** Make an object's meshes cast and receive shadows and glow where they have lamps. */
  adopt(root) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.prettySkip || o.userData.prettyDone === o.material) return;
      o.userData.prettyDone = o.material;
      if (o.userData.horizonFade) this._horizonFade(o.material);
      const big = o.geometry?.boundingSphere ? o.geometry.boundingSphere.radius > 2500 : false;
      o.castShadow = !big;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) this._prepare(m);
    });
  }

  /** Fade a ground material, with distance from the railway, into the sky's horizon colour (after fog). */
  _horizonFade(m) {
    if (m.userData.horizonFade) return;
    m.userData.horizonFade = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.fadeColour = this.fadeU.colour;
      sh.uniforms.fadeCentre = this.fadeU.centre;
      sh.uniforms.fadeRange = this.fadeU.range;
      sh.vertexShader = 'varying vec3 vFadeW;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  vFadeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform vec3 fadeColour; uniform vec2 fadeCentre, fadeRange; varying vec3 vFadeW;\n' + sh.fragmentShader.replace('#include <fog_fragment>',
        '#include <fog_fragment>\n  float fadeK = smoothstep(fadeRange.x, fadeRange.y, length(vFadeW.xz - fadeCentre));\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, fadeColour, fadeK * fadeK * (3.0 - 2.0 * fadeK));');
    };
    m.customProgramCacheKey = () => 'horizon-fade';
    m.needsUpdate = true;
  }

  _prepare(m) {
    if (!m || this._mats.has(m) || !m.map?.image || !('emissive' in m) || !this.kit) return;
    const img = m.map.image;
    let maps = this._emissive.get(img);
    if (!maps) {
      const c = emissiveMaps(img, this.kit.m.ramps);
      const tex = (canvas) => {
        if (!canvas) return null;
        const t = new THREE.CanvasTexture(canvas);
        for (const k of ['flipY', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'generateMipmaps']) t[k] = m.map[k];
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      maps = { lamps: tex(c.lamps), windows: tex(c.windows) };
      this._emissive.set(img, maps);
    }
    m.userData.prettyMaps = maps;
    this._mats.add(m);
    this._applyGlow(m);
  }

  _applyGlow(m) {
    const maps = m.userData.prettyMaps;
    if (!maps) return;
    const p = this.p;
    // lamps glow a little even by day; windows only light up as it gets dark. A material with
    // both shares one intensity (the larger), so window strength must sit on the lamps' scale:
    // otherwise a cab car's windows bloom and the windows-only cars behind it stay dull.
    const lampI = 0.15 + p.glow;
    const winI = p.windows * 2.4;
    const useWin = winI > 0.05 && maps.windows;
    const map = useWin && maps.lamps ? null : useWin ? maps.windows : maps.lamps;
    if (useWin && maps.lamps) {
      // both: combine once into a canvas per atlas (lamps over windows)
      if (!maps.both) {
        const a = maps.lamps.image, b = maps.windows.image;
        const c = document.createElement('canvas');
        c.width = a.width; c.height = a.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(b, 0, 0);
        ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(a, 0, 0);
        maps.both = new THREE.CanvasTexture(c);
        for (const k of ['flipY', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'generateMipmaps', 'colorSpace']) maps.both[k] = maps.lamps[k];
      }
      m.emissiveMap = maps.both;
      m.emissiveIntensity = Math.max(lampI, winI);
    } else {
      m.emissiveMap = map;
      m.emissiveIntensity = useWin ? winI : lampI;
    }
    m.emissive.set(m.emissiveMap ? '#ffffff' : '#000000');
    m.needsUpdate = true;
  }

  // ---------------------------------------------------------------- per frame
  _placeLampLights() {
    const night = this.p.glow > 0.5;
    const focus = this.controls?.target ?? new THREE.Vector3();
    const posts = [];
    if (night) {
      this.scene.traverse((o) => {
        if (o.name === 'lamp-post' && o.parent && !o.parent.name?.startsWith('lamp-post')) posts.push(o);
      });
    }
    const wp = new THREE.Vector3();
    posts.sort((a, b) => a.getWorldPosition(wp).distanceToSquared(focus) - b.getWorldPosition(new THREE.Vector3()).distanceToSquared(focus));
    this.lamps.forEach((l, i) => {
      const post = posts[i];
      l.visible = !!post;
      if (post) {
        post.getWorldPosition(l.position);
        l.position.y += 46;
        l.intensity = 2200 * Math.min(1, (this.p.glow - 0.5) / 0.9);
      }
    });
  }

  render(dt) {
    this.clock += dt;
    this._adoptTimer -= dt;
    if (this._adoptTimer <= 0) {
      this._adoptTimer = 0.5;
      this.adopt(this.scene);
      this._placeLampLights();
    }
    const focus = this.controls?.target ?? new THREE.Vector3();
    // sun and its shadow camera follow the focus, so shadows stay sharp where you look
    const reach = (this.span ?? 1600) * 1.2 + 400;
    const centre = this.box.getCenter(new THREE.Vector3());
    this.sun.target.position.copy(centre);
    this.sun.position.copy(centre).addScaledVector(this.sunDir, reach);
    this.fill.position.copy(centre).add(new THREE.Vector3(-this.sunDir.x, 0.6, -this.sunDir.z).multiplyScalar(reach));
    this.sky.position.copy(this.camera.position);
    this.sky.scale.setScalar(this.camera.far * 0.9);
    const du = this.dust.material.uniforms;
    du.time.value = this.clock;
    du.focus.value.copy(focus);
    const d = this.camera.position.distanceTo(focus);
    du.box.value.set(Math.min(1600, d * 1.4), Math.min(420, d * 0.5), Math.min(1600, d * 1.4));
    du.size.value = 1.6 + d / 900;
    // tilt-shift: focus band on a clicked point (focusOn), else the orbit target; it eases across
    // in world space, so a click glides the sharp band over rather than snapping it
    if (this.focusObject) {
      const { object, local } = this.focusObject;
      if (object.parent) this.focusGoal.copy(object.localToWorld(local.clone()));
      else this.focusOn(null); // the train was taken away
    }
    const goal = this.focusGoal ?? focus;
    this.focusNow ??= goal.clone();
    this.focusNow.lerp(goal, 1 - Math.exp(-Math.min(dt, 0.1) * 5));
    const ndc = this.focusNow.clone().project(this.camera);
    const fy = ndc.z < 1 ? THREE.MathUtils.clamp((ndc.y + 1) / 2, 0.06, 0.94) : 0.5;
    for (const p of [this.tiltH, this.tiltV]) {
      p.uniforms.focus.value = fy;
      p.uniforms.amount.value = this.tiltAmount;
    }
    this.gradePass.uniforms.time.value = this.clock % 10;
    this.composer.render(dt);
  }
}
