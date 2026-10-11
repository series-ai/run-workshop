// Read back the complete effect terms from the running production shaders.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const fs = require("node:fs");
const R = require("./experiment-runtime.cjs");
const path = require("node:path");
const esbuild = require("esbuild");
async function probe(url, out) {
  const release = R.gpuLock("R38 complete shader probes");
  let r;
  try {
    r = await R.open(url, out);
    const module2 = await esbuild.build({ stdin: { contents: 'export * from "three";', resolveDir: path.resolve(__dirname, "../..") }, bundle: true, platform: "browser", format: "esm", write: false });
    await r.page.route("**/__structured-light-audit-three.mjs", (route) => route.fulfill({ contentType: "text/javascript", body: module2.outputFiles[0].text }));
    await r.page.evaluate(() => window.__skyriver.suspend());
    const report = await r.page.evaluate(async () => {
      const T = await import("/__structured-light-audit-three.mjs");
      const s = window.__skyriver.scene, renderer = s.renderer;
      const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e3);
      camera.position.set(0, 0, 10);
      const target = new T.WebGLRenderTarget(256, 256, { type: T.FloatType, format: T.RGBAFormat, depthBuffer: false });
      const plane = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial());
      plane.frustumCulled = false;
      scene.add(plane);
      const plots = {};
      function keep(name, p) {
        plots[name] = Array.from(p);
      }
      function draw(m) {
        plane.material = m;
        renderer.setRenderTarget(target);
        renderer.setClearColor(0, 0);
        renderer.clear();
        renderer.render(scene, camera);
        const p = new Float32Array(256 * 256 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 256, 256, p);
        return p;
      }
      function summary(p) {
        let sum = 0, sq = 0, max = 0, edge = 0, edgeRGBA = [0, 0, 0, 0], innerGradient = 0;
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const q = (y * 256 + x) * 4, v = Math.max(p[q], p[q + 1], p[q + 2]);
          sum += v;
          sq += v * v;
          max = Math.max(max, v);
          if (x < 2 || x > 253 || y < 2 || y > 253) {
            edge = Math.max(edge, v);
            for (let c = 0; c < 4; c++) edgeRGBA[c] = Math.max(edgeRGBA[c], p[q + c]);
          }
          if (x < 13 || x > 242 || y < 13 || y > 242) {
            if (x > 0) innerGradient = Math.max(innerGradient, Math.abs(v - Math.max(p[q - 4], p[q - 3], p[q - 2])));
            if (y > 0) innerGradient = Math.max(innerGradient, Math.abs(v - Math.max(p[q - 1024], p[q - 1023], p[q - 1022])));
          }
        }
        const mean = sum / 65536;
        return { mean, max, std: Math.sqrt(Math.max(0, sq / 65536 - mean * mean)), edge, edgeRGBA, outerGradientPeakFraction: max ? Math.max(edge, innerGradient) / max : 0 };
      }
      function cvTiles(p, normalize, centerOnly = false) {
        let tiles = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
          if (centerOnly && (tx < 2 || tx > 5 || ty < 2 || ty > 5)) continue;
          let sum = 0, sq = 0;
          for (let y = ty * 32; y < (ty + 1) * 32; y++) for (let x = tx * 32; x < (tx + 1) * 32; x++) {
            let v = p[(y * 256 + x) * 4];
            if (normalize) v = normalize(v, x, y);
            sum += v;
            sq += v * v;
          }
          const mean = sum / 1024;
          tiles.push(Math.sqrt(Math.max(0, sq / 1024 - mean * mean)) / Math.max(mean, 1e-10));
        }
        tiles.sort((a, b) => a - b);
        return { minimum: tiles[0], median: tiles[Math.floor(tiles.length / 2)] };
      }
      const vertex = "varying vec2 probeUv;void main(){probeUv=uv;gl_Position=vec4(position.xy,0,1);}";
      const tower = s.scene.getObjectByName("skyriver.city.towers").material, tf = tower.fragmentShader;
      const heroStart = tf.indexOf("  vec3 heroSpill ="), heroEnd = tf.indexOf("  // --- window grid", heroStart), heroTerm = tf.slice(heroStart, heroEnd);
      const heroPrefix = tf.slice(0, tf.indexOf("void main()"));
      function cityProbe(body2, grid = false) {
        const m = tower.clone();
        m.vertexShader = `varying vec3 vWorldPos;varying float vIsSide;varying float vSeed;uniform float uProbeDistance;void main(){vWorldPos=${grid ? "vec3((uv.x-.5)*96.0,(uv.y-.5)*96.0,uProbeDistance)" : "vec3(uProbeDistance,0,0)"};vIsSide=1.0;vSeed=.23;gl_Position=vec4(position.xy,0,1);}`;
        m.fragmentShader = heroPrefix + "void main(){float contactAo=1.0;float wet=.8;float paneStepMask=1.0;float fresnel=.9;vec3 color=vec3(0);" + heroTerm + body2 + "}";
        m.uniforms.uProbeDistance = { value: 0 };
        m.uniforms.uHeroCount.value = 1;
        m.uniforms.uHeroBlades.value[0].set(0, 0, 0, 150);
        m.uniforms.uHeroColors.value[0].setRGB(1, 0, 1);
        m.uniforms.uHeroWeight.value[0] = 1;
        m.depthTest = false;
        m.fog = false;
        m.toneMapped = false;
        return m;
      }
      const city = cityProbe("gl_FragColor=vec4(color,1);"), cityRange = [];
      for (const d of [0, 25, 50, 100, 125, 150, 175, 195, 199, 199.5, 200, 200.5, 225]) {
        city.uniforms.uProbeDistance.value = d;
        cityRange.push({ distance: d, ...summary(draw(city)) });
      }
      city.uniforms.uProbeDistance.value = 50;
      city.uniforms.uHeroCount.value = 0;
      const cityOff = summary(draw(city));
      city.dispose();
      const noiseCity = cityProbe("gl_FragColor=vec4(heroSpill,1);", true);
      noiseCity.uniforms.uProbeDistance.value = 50;
      const noiseP = draw(noiseCity);
      keep("cityNoiseRgba", noiseP);
      const hasRange = tf.includes("localAreaLight(");
      const cityNoise = cvTiles(noiseP, (v, x) => {
        const wx = ((x + 0.5) / 256 - 0.5) * 96, d = Math.hypot(wx, 50);
        const response = hasRange ? 7200 / (7200 + 4 * Math.PI * d * d) : Math.exp(-d / 60);
        return v / response;
      });
      plots.cityNoise = Array.from(noiseP.filter((_, i) => i % 4 === 0));
      noiseCity.dispose();
      const wetStart = tf.indexOf("  // T6R: the wet sheen"), wetNew = tf.indexOf("  // Overcast reflection"), wetAt = Math.max(wetStart, wetNew), wetEnd = tf.indexOf("  // Wet arrises:", wetAt);
      const sheenTerm = tf.slice(wetAt, wetEnd);
      const neutral = tower.clone();
      neutral.vertexShader = "varying vec3 vWorldPos;varying float vSeed;varying float vIsSide;void main(){vWorldPos=vec3(uv*8.0,0);vSeed=.23;vIsSide=1.0;gl_Position=vec4(position.xy,0,1);}";
      neutral.fragmentShader = heroPrefix + "void main(){float wet=.8;float fresnel=.9;float paneStepMask=1.0;" + sheenTerm + "gl_FragColor=vec4(wetSheen,1);}";
      neutral.depthTest = false;
      neutral.fog = false;
      neutral.toneMapped = false;
      const sheen = draw(neutral), sheenStats = summary(sheen);
      keep("facadeNeutral", sheen);
      let maxChroma = 0;
      for (let i = 0; i < sheen.length; i += 4) maxChroma = Math.max(maxChroma, Math.max(sheen[i], sheen[i + 1], sheen[i + 2]) - Math.min(sheen[i], sheen[i + 1], sheen[i + 2]));
      neutral.dispose();
      const washAt = tf.indexOf("  float megaMatch ="), washTerm = tf.slice(washAt, tf.lastIndexOf("\n}"));
      function washProbe(grid = false) {
        const m = tower.clone();
        m.vertexShader = `varying vec3 vWorldPos;varying vec2 vSurf;varying vec2 vFaceHalf;varying vec3 vTint;varying float vIsSide;varying float vSeed;varying float vDistrict;uniform float uProbeDistance;void main(){float x=${grid ? "(uv.x-.5)*96.0" : "0.0"};float y=842.5-uProbeDistance${grid ? "+(uv.y-.5)*96.0" : ""};vWorldPos=vec3(x,y,-200);vSurf=vec2(x,y);vFaceHalf=vec2(200,840);vTint=vec3(.12,.12,.12);vIsSide=1.0;vSeed=.23;vDistrict=0.0;gl_Position=vec4(position.xy,0,1);}`;
        m.fragmentShader = heroPrefix + "void main(){float vFogDepth=400.0;gl_FragColor=vec4(0,0,0,1);" + washTerm + "}";
        m.uniforms.uProbeDistance = { value: 0 };
        m.uniforms.uMegaTint.value.setRGB(0.12, 0.12, 0.12);
        for (const v of m.uniforms.uMegaWash.value) v.set(0, 0, 200, 0.7);
        m.uniforms.uDistrictColour.value = 0;
        m.depthTest = false;
        m.fog = false;
        m.toneMapped = false;
        return m;
      }
      const wm = washProbe(), washRange = [];
      for (const d of [0, 25, 50, 100, 125, 150, 175, 195, 199, 199.5, 200, 200.5, 225]) {
        wm.uniforms.uProbeDistance.value = d;
        washRange.push({ distance: d, ...summary(draw(wm)) });
      }
      for (const v of wm.uniforms.uMegaWash.value) v.w = 0;
      const washOff = summary(draw(wm));
      wm.dispose();
      const wn = washProbe(true);
      wn.uniforms.uProbeDistance.value = 50;
      const washPixels = draw(wn);
      keep("landmarkWash", washPixels);
      const washHasRange = tf.includes("ledgeResponse");
      const washNoise = cvTiles(washPixels, (v, x, y) => {
        if (!washHasRange) {
          const wy = 792.5 + ((y + 0.5) / 256 - 0.5) * 96;
          return v / ((0.02 + 0.3 * Math.exp(-(wy / 300 - Math.floor(wy / 300)) * 5.5)) * 0.6);
        }
        const h = 50 - ((y + 0.5) / 256 - 0.5) * 96, d = Math.hypot(1.3, h), t = Math.max(0, Math.min(1, (d - 100) / 100));
        return v / (2400 / (2400 + 4 * Math.PI * d * d) * (1 - t * t * (3 - 2 * t)));
      });
      wn.dispose();
      const towerMesh = s.city.towerMesh, trimMesh = s.city.trimMesh, ta = towerMesh.geometry.getAttribute("aTint"), ts = towerMesh.geometry.getAttribute("aSize"), tk = trimMesh.geometry.getAttribute("aKind"), sz = trimMesh.geometry.getAttribute("aSize"), mega = tower.uniforms.uMegaTint.value, mat = new T.Matrix4(), tm = new T.Matrix4(), rimStages = [];
      for (let i = 0; i < towerMesh.count; i++) {
        if (Math.hypot(ta.getX(i) - mega.r, ta.getY(i) - mega.g, ta.getZ(i) - mega.b) > 0.02) continue;
        towerMesh.getMatrixAt(i, mat);
        const e = mat.elements, cx = e[12], cy = e[13], cz = e[14], top = cy + ts.getY(i) / 2, ux = new T.Vector3(e[0], e[1], e[2]).normalize(), uz = new T.Vector3(e[8], e[9], e[10]).normalize();
        const rims = [];
        for (let j = 0; j < trimMesh.count; j++) {
          if (tk.getX(j) !== 9 || Math.abs(sz.getY(j) - 6) > 0.01) continue;
          trimMesh.getMatrixAt(j, tm);
          const q = tm.elements;
          if (Math.abs(q[13] - top - 2.5) > 0.03) continue;
          const delta = new T.Vector3(q[12] - cx, q[13] - cy, q[14] - cz), lx = delta.dot(ux), lz = delta.dot(uz), dx = Math.abs(Math.abs(lx) - ts.getX(i) / 2 - 1.3), dz = Math.abs(Math.abs(lz) - ts.getZ(i) / 2 - 1.3);
          if (dx < 0.03 && Math.abs(lz) < 0.03 || dz < 0.03 && Math.abs(lx) < 0.03) rims.push({ index: j, center: [q[12], q[13], q[14]], local: [lx, q[13] - cy, lz], size: [sz.getX(j), sz.getY(j), sz.getZ(j)], offsetError: Math.min(dx, dz) });
        }
        rimStages.push({ tower: i, center: [cx, cy, cz], size: [ts.getX(i), ts.getY(i), ts.getZ(i)], top, rims });
      }
      const volume = s.volumePass.raymarchMaterial, vf = volume.fragmentShader, vm = volume.clone();
      const prefix = vf.slice(0, vf.indexOf("void main()"));
      vm.vertexShader = "varying vec3 vProbeWorld;uniform float uProbeDistance;void main(){vProbeWorld=vec3(uProbeDistance,0,0);gl_Position=vec4(position.xy,0,1);}";
      vm.fragmentShader = "varying vec3 vProbeWorld;" + prefix + "void main(){gl_FragColor=vec4(localRadiance(vProbeWorld),1);}";
      vm.uniforms.uProbeDistance = { value: 0 };
      vm.uniforms.uLightCount.value = 1;
      vm.uniforms.uLightPosition.value[0].set(0, 0, 0, 0);
      vm.uniforms.uLightAxis.value[0].set(0, 1, 0, 150);
      vm.uniforms.uLightColor.value[0].set(1, 0, 1, 1);
      vm.uniforms.uLightShape.value[0].set(7200, 200, 0, 0);
      vm.uniforms.uDeckGlow.value.set(0, 0, 0);
      vm.uniforms.uDistrictTint.value.set(1, 1, 1);
      vm.uniforms.uScatterGain.value = 1;
      vm.uniforms.uScatterScale.value = 1;
      vm.depthTest = false;
      vm.fog = false;
      vm.toneMapped = false;
      const volumeRange = [];
      for (const d of [0, 25, 50, 100, 125, 150, 175, 195, 199, 199.5, 200, 200.5, 225]) {
        vm.uniforms.uProbeDistance.value = d;
        volumeRange.push({ distance: d, ...summary(draw(vm)) });
      }
      vm.uniforms.uProbeDistance.value = 50;
      vm.uniforms.uLightCount.value = 0;
      const volumeOff = summary(draw(vm));
      vm.uniforms.uLightCount.value = 1;
      vm.vertexShader = "varying vec3 vProbeWorld;void main(){vProbeWorld=vec3((uv.x-.5)*96.0,(uv.y-.5)*96.0,50);gl_Position=vec4(position.xy,0,1);}";
      vm.needsUpdate = true;
      const volumeNoisePixels = draw(vm);
      keep("volumeNoise", volumeNoisePixels);
      const volumeNoise = cvTiles(volumeNoisePixels, (v, x) => {
        const wx = ((x + 0.5) / 256 - 0.5) * 96, d = Math.hypot(wx, 50);
        return v / (7200 / (7200 + 4 * Math.PI * d * d));
      });
      vm.dispose();
      const plume = s.scene.getObjectByName("skyriver.shuttle.plume"), plumeRows = [];
      for (const kind of [0, 1, 2, 3]) {
        const m = plume.material.clone();
        m.depthTest = false;
        m.fog = false;
        m.toneMapped = false;
        m.uniforms.uVisibilityFadeEnabled.value = 0;
        m.uniforms.uTime.value = 0;
        m.vertexShader = `varying vec2 vTS;varying float vKind;varying float vWakeDistance;void main(){vTS=${kind === 1 || kind === 2 ? "uv*2.0-1.0" : "vec2(uv.x,uv.y*2.0-1.0)"};vKind=${kind}.0;vWakeDistance=0.0;gl_Position=vec4(position.xy,0,1);}`;
        m.blending = T.NoBlending;
        const raw = summary(draw(m));
        m.blending = T.AdditiveBlending;
        m.transparent = true;
        const visiblePixels = draw(m);
        keep("plume" + kind, visiblePixels);
        const visible = summary(visiblePixels);
        let noise32 = null;
        if (kind !== 2) {
          m.fragmentShader = m.fragmentShader.replace("color *= lightBreakup( vec3( vTS.x * 96.0, vTS.y * 48.0, uTime * 0.6 ), vKind + 0.31 );", "color *= 1.0;");
          m.needsUpdate = true;
          const envelope = draw(m);
          keep("plumeEnvelope" + kind, envelope);
          noise32 = cvTiles(visiblePixels, (v, x, y) => v / Math.max(envelope[(y * 256 + x) * 4], 1e-12), true);
        }
        plumeRows.push({ kind, raw, visible, noise32, blend: "SRC_ALPHA, ONE" });
        m.dispose();
      }
      const sign = s.scene.getObjectByName("skyriver.city.signs"), sm = sign.material.clone();
      sm.fog = false;
      sm.toneMapped = false;
      sm.depthTest = false;
      sm.uniforms.uTime.value = 0;
      sm.vertexShader = "varying vec2 vSignUv;varying vec2 vLocal;varying vec3 vSignColor;varying float vSignKind;varying float vSignSeed;varying vec3 vSignNormal;varying vec3 vWorldPos;varying vec2 vSignSize;varying float vMargin;varying vec4 vAtlas;varying vec4 vDistrictTint;void main(){vLocal=(uv*2.0-1.0)*vec2(22,50);vSignUv=vLocal/vec2(24,80)+.5;vSignColor=vec3(1,0,1);vSignKind=0.0;vSignSeed=.23;vSignNormal=vec3(0,0,1);vWorldPos=vec3(vLocal,0);vSignSize=vec2(24,80);vMargin=10.0;vAtlas=vec4(0);vDistrictTint=vec4(1,1,1,0);gl_Position=vec4(position.xy,0,1);}";
      const signPixels = draw(sm);
      keep("sign", signPixels);
      const signEdge = summary(signPixels);
      sm.uniforms.uIntensity.value = 0;
      sm.uniforms.uHalo.value = 1;
      const haloOn = draw(sm);
      sm.uniforms.uHalo.value = 0;
      const haloPlate = draw(sm);
      const haloDelta = haloOn.map((v, i) => i % 4 === 3 ? 1 : Math.max(0, v - haloPlate[i]));
      keep("signHalo", haloDelta);
      const edgeStart = sm.fragmentShader.includes("smoothstep( 0.65, 0.95, edge.x )") ? 0.65 : 0.7, edgeEnd = edgeStart === 0.65 ? 0.95 : 1;
      const signNoise = cvTiles(haloDelta, (v, x, y) => {
        const lx = ((x + 0.5) / 256 * 2 - 1) * 22, ly = ((y + 0.5) / 256 * 2 - 1) * 50;
        const step = (a, b, x2) => {
          const t = Math.max(0, Math.min(1, (x2 - a) / (b - a)));
          return t * t * (3 - 2 * t);
        };
        const ex = Math.abs(lx) / 22, ey = Math.abs(ly) / 50, inside = Math.abs(lx) <= 12 && Math.abs(ly) <= 40 ? 1 : 0;
        const envelope = Math.exp(-((lx / 17) ** 2 + (ly / 45) ** 2) * 1.4) * (1 - step(edgeStart, edgeEnd, ex)) * (1 - step(edgeStart, edgeEnd, ey)) * (1 - inside * 0.5);
        return v / envelope;
      }, true);
      sm.uniforms.uHalo.value = 1;
      sm.vertexShader = sm.vertexShader.replace("vSignColor=vec3(1,0,1);", "vSignColor=vec3(0);");
      sm.needsUpdate = true;
      const signOff = summary(draw(sm));
      sm.dispose();
      const rain = s.scene.getObjectByName("skyriver.rain").material.clone();
      rain.depthTest = false;
      rain.fog = false;
      rain.toneMapped = false;
      rain.vertexShader = vertex.replaceAll("probeUv", "vRainUv");
      rain.uniforms.uRainOn.value = 0;
      rain.uniforms.uTime.value = 0;
      rain.uniforms.uBoost.value = 0;
      const boostOff = draw(rain);
      rain.uniforms.uBoost.value = 1;
      const boostOn = draw(rain);
      keep("boost", boostOn);
      let boostDifference = 0, boostMax = 0;
      for (let i = 0; i < boostOn.length; i += 4) {
        const v = Math.max(Math.abs(boostOn[i] - boostOff[i]), Math.abs(boostOn[i + 1] - boostOff[i + 1]), Math.abs(boostOn[i + 2] - boostOff[i + 2]));
        boostDifference += v;
        boostMax = Math.max(boostMax, v);
      }
      const boostScratch = { meanDifference: boostDifference / 65536, maxDifference: boostMax };
      rain.dispose();
      const wetMatch = tf.match(/float wet = [\s\S]*?;/);
      const wetProbe = tower.clone();
      wetProbe.vertexShader = "varying vec3 vWorldPos;varying vec2 vSurf;varying float vSeed;varying float vFaceId;varying float vUp;void main(){vWorldPos=vec3(uv*8.0,0);vSurf=vec2(0);vSeed=.23;vFaceId=0.0;vUp=0.0;gl_Position=vec4(position.xy,0,1);}";
      wetProbe.fragmentShader = heroPrefix + "void main(){float fineDetail=1.0;float runnel=.9;" + wetMatch[0] + "gl_FragColor=vec4(vec3(wet),1);}";
      wetProbe.fog = false;
      wetProbe.depthTest = false;
      wetProbe.toneMapped = false;
      const wetPixels = draw(wetProbe);
      keep("wetMicro", wetPixels);
      const wetMicro = summary(wetPixels);
      wetProbe.dispose();
      const originalHull = s.scene.getObjectByName("skyriver.shuttle.hull"), body = originalHull.clone();
      body.geometry = originalHull.geometry;
      body.material = originalHull.material.clone();
      body.material.fog = false;
      body.material.toneMapped = false;
      let hullShader;
      body.material.onBeforeCompile = (shader, r2) => {
        originalHull.material.onBeforeCompile(shader, r2);
        hullShader = shader;
        if (shader.uniforms.uPickupCount) shader.uniforms.uPickupCount.value = 0;
      };
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      scene.remove(plane);
      scene.add(body);
      const hc = new T.PerspectiveCamera(45, 1, 0.1, 100);
      hc.position.set(12, -12, 22);
      hc.lookAt(0, 0, 0);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, hc);
      const hp = new Float32Array(256 * 256 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 256, 256, hp);
      const hullOff = summary(hp);
      keep("hullOff", hp);
      const huePixels = [];
      for (let i = 0; i < hp.length; i += 4) {
        const [r2, g, b] = hp.slice(i, i + 3);
        if (r2 > 5e-3 && b > 5e-3 && g < Math.min(r2, b) * 0.3) huePixels.push(i / 4);
      }
      scene.remove(body);
      scene.add(plane);
      const hullPositions = [], hullNormals = [], hullLamps = [];
      const hg = originalHull.geometry, hi = hg.index, hpAttr = hg.getAttribute("position"), hn = hg.getAttribute("normal"), hcolor = hg.getAttribute("color");
      for (let i = 0; i < hi.count; i += 3) {
        const lamp = [];
        let emissive = true;
        for (let j = 0; j < 3; j++) {
          const k = hi.getX(i + j), position = [hpAttr.getX(k), hpAttr.getY(k), hpAttr.getZ(k)], color = [hcolor.getX(k), hcolor.getY(k), hcolor.getZ(k)];
          hullPositions.push(...position);
          hullNormals.push(hn.getX(k), hn.getY(k), hn.getZ(k));
          lamp.push(...position, ...color);
          emissive = emissive && Math.max(...color) >= .8;
        }
        if (emissive) hullLamps.push(lamp);
      }
      let pickup = null;
      if (hullShader.uniforms.uPickupCount) {
        const f = hullShader.fragmentShader, start = f.indexOf("vec3 glassNormal ="), end = f.indexOf("diffuseColor.rgb += pickup;", start), term = f.slice(start, end) + "diffuseColor.rgb += pickup;";
        const helper = f.slice(f.indexOf("float localLightRange"), f.indexOf("#include <", f.indexOf("float localLightRange")));
        const gm = new T.ShaderMaterial({ vertexShader: vertex, fragmentShader: "varying vec2 probeUv;uniform int uPickupCount;uniform vec4 uPickupPosition[8];uniform vec4 uPickupAxis[8];uniform vec3 uPickupColor[8];" + helper + "void main(){vec3 vGlassNormal=vec3(0,-1,0);vec3 vGlassWorldPosition=vec3((probeUv.x-.5)*8.0,0,(probeUv.y-.5)*8.0);float vGlass=0.0;vec4 diffuseColor=vec4(0);" + term + "gl_FragColor=vec4(diffuseColor.rgb,1);}", uniforms: hullShader.uniforms, depthTest: false, toneMapped: false });
        const u = gm.uniforms;
        u.uPickupCount.value = 1;
        u.uPickupPosition.value[0].set(0, -25, -25, 7200);
        u.uPickupAxis.value[0].set(0, 1, 0, 15);
        u.uPickupColor.value[0].set(0, 1, 1);
        camera.position.set(0, -20, 20);
        const pOn = draw(gm), on = summary(pOn);
        keep("pickupOn", pOn);
        const pickupNoise = cvTiles(pOn.map((v, i) => i % 4 === 0 ? pOn[i + 1] : v), (v, x, y) => {
          const wx = ((x + 0.5) / 256 - 0.5) * 8, wz = ((y + 0.5) / 256 - 0.5) * 8, d = Math.hypot(wx, 10, wz + 25), vl = Math.hypot(wx, 20, 20 - wz), ndotV = 20 / vl, grazing = (1 - Math.abs(ndotV)) ** 2, reflected = [wx / vl, -20 / vl, (wz - 20) / vl], light = [-wx / d, -10 / d, (-wz - 25) / d], streak = Math.max(0, reflected.reduce((n, a, i) => n + a * light[i], 0)) ** 32, response = 7200 / (7200 + 4 * Math.PI * d * d), shape = 10 / d * 0.06 + streak * (0.18 + grazing * 0.45);
          return v / (response * shape);
        });
        u.uPickupPosition.value[0].x = 20;
        const moved = draw(gm);
        keep("pickupMoved", moved);
        let change = 0;
        for (let i = 0; i < pOn.length; i += 4) change += Math.abs(pOn[i + 1] - moved[i + 1]);
        u.uPickupCount.value = 0;
        const off = summary(draw(gm));
        u.uPickupCount.value = 1;
        u.uPickupPosition.value[0].set(0, -225, -225, 7200);
        const far = summary(draw(gm));
        gm.fragmentShader = gm.fragmentShader.replace("vec3((probeUv.x-.5)*8.0,0,(probeUv.y-.5)*8.0)", "vec3(0)");
        gm.needsUpdate = true;
        const pickupRange = [];
        for (const d of [0, 25, 50, 100, 125, 150, 175, 195, 199, 199.5, 200, 200.5, 225]) {
          u.uPickupPosition.value[0].set(0, -d / Math.SQRT2 - 15, -d / Math.SQRT2, 7200);
          pickupRange.push({ distance: d, ...summary(draw(gm)) });
        }
        pickup = { on, off, far, range: pickupRange, noise32: pickupNoise, movedMeanAbsoluteChange: change / 65536, term };
        gm.dispose();
      }
      renderer.setRenderTarget(null);
      target.dispose();
      return { method: "Complete actual city spill term, full sign fragment, actual volume localRadiance, complete plume fragment with real additive blend, actual full body source-off render. Independent CPU distance normalization for world-noise tiles.", city: { range: cityRange, off: cityOff, noise32: cityNoise, term: heroTerm }, facadeSourceOff: { ...sheenStats, maxChroma, term: sheenTerm }, volume: { range: volumeRange, off: volumeOff, noise32: volumeNoise, term: prefix.slice(prefix.indexOf("vec3 localRadiance")) }, landmark: { range: washRange, off: washOff, noise32: washNoise, term: washTerm, rimStages }, plumeRows, signEdge, signHalo: { noise32: signNoise, off: signOff, contribution: summary(haloDelta), extentM: Math.hypot(22, 50) }, boostScratch, wetMicro, hullOff: { ...hullOff, magentaBodyPixels: huePixels.length }, pickup, identity: s.city.geometryIdentity(), adapter: s.glDiagnostics(), glError: renderer.getContext().getError(), hullInvariant: { positions: hullPositions, normals: hullNormals, lamps: hullLamps }, plots };
    });
    report.hullInvariant = { positionHash: R.sha(JSON.stringify(report.hullInvariant.positions)), normalHash: R.sha(JSON.stringify(report.hullInvariant.normals)), lampHash: R.sha(JSON.stringify(report.hullInvariant.lamps)), lampTriangles: report.hullInvariant.lamps.length };
    report.errors = r.errors;
    fs.writeFileSync(out + "/full-readback.json", JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (r) await r.browser.close();
    release();
  }
}
module.exports = { probe };
