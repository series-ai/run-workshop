import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLSL_NOISE, POST_COMMON, POST_VERTEX } from './glsl';

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface SceneMeta {
  title: string;
  artist: string;
  technique: string;
}

export interface FrameContext {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  time: number;
  dt: number;
  width: number;
  height: number;
}

export interface PaintingScene {
  scene: THREE.Scene;
  presets: CameraPreset[];
  meta: SceneMeta;
  /** Body of the post fragment shader. POST_COMMON and the noise chunk come first. */
  postFragment: string;
  postUniforms: Record<string, THREE.IUniform>;
  near: number;
  far: number;
  flySpeed: number;
  maxDistance: number;
  /** Lowest camera height allowed above the point (x, z). */
  floorAt(x: number, z: number): number;
  update(ctx: FrameContext): void;
  /** Extra render passes that must run before the main pass (reflections). */
  prePass?(ctx: FrameContext): void;
  dispose(): void;
}

export type SceneFactory = () => PaintingScene;

export interface DemoMetrics {
  scene: string;
  fps: number;
  frameMs: number;
  cpuMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  width: number;
  height: number;
  pixelRatio: number;
  frames: number;
}

export interface BenchmarkResult {
  frames: number;
  msPerFrame: number;
  fpsUncapped: number;
}

const FRAME_WINDOW = 90;
const MAX_PIXELS = 4.6e6;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class DemoHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  onMetrics: ((m: DemoMetrics) => void) | null = null;
  onDriftChange: ((on: boolean) => void) | null = null;

  private readonly container: HTMLElement;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly keys = new Set<string>();
  private readonly resizeObserver: ResizeObserver;

  private active: PaintingScene | null = null;
  private activeId = '';
  private postMaterial: THREE.ShaderMaterial | null = null;

  private drift = true;
  private driftTime = 0;
  private readonly basePos = new THREE.Vector3();
  private readonly baseTarget = new THREE.Vector3();
  private tween: { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; fromFov: number; to: CameraPreset } | null = null;

  private time = 0;
  private lastNow: number | null = null;
  private frames = 0;
  private readonly deltas = new Float32Array(FRAME_WINDOW);
  private deltaCount = 0;
  private lastEmit = 0;
  /** Frames to leave out of the average after a scene load (shader compile). */
  private warmup = 0;
  private raf = 0;
  private paused = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const depthTexture = new THREE.DepthTexture(4, 4);
    depthTexture.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      samples: 4,
      depthTexture,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.postMesh = new THREE.Mesh(tri, new THREE.ShaderMaterial());
    this.postMesh.frustumCulled = false;
    this.postScene.add(this.postMesh);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.zoomSpeed = 0.9;
    this.controls.rotateSpeed = 0.55;
    this.controls.addEventListener('start', () => this.userTookOver());
    canvas.addEventListener('wheel', () => this.userTookOver(), { passive: true });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private readonly onBlur = (): void => {
    this.keys.clear();
  };

  private userTookOver(): void {
    this.tween = null;
    if (this.drift) {
      this.drift = false;
      this.onDriftChange?.(false);
    }
  }

  private resize(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    // Cap the shaded pixel count so very large retina windows stay fast.
    const pr = Math.max(Math.min(window.devicePixelRatio, 2, Math.sqrt(MAX_PIXELS / (w * h))), 0.75);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.target.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  load(id: string, scene: PaintingScene): void {
    this.active = scene;
    this.activeId = id;
    this.postMaterial?.dispose();
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: `${GLSL_NOISE}\n${POST_COMMON}\n${scene.postFragment}`,
      uniforms: {
        tScene: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uNear: { value: scene.near },
        uFar: { value: scene.far },
        ...scene.postUniforms,
      },
      depthTest: false,
      depthWrite: false,
    });
    this.postMesh.material = this.postMaterial;
    this.camera.near = scene.near;
    this.camera.far = scene.far;
    this.controls.maxDistance = scene.maxDistance;
    this.controls.minDistance = 0.5;
    this.keys.clear();
    this.snapToPreset(scene.presets[0]);
    this.deltaCount = 0;
    this.warmup = 4;
  }

  snapToPreset(p: CameraPreset): void {
    this.tween = null;
    this.camera.position.set(...p.position);
    this.controls.target.set(...p.target);
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.rebase();
  }

  goToPreset(p: CameraPreset): void {
    this.tween = {
      t: 0,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      fromFov: this.camera.fov,
      to: p,
    };
  }

  setDrift(on: boolean): void {
    this.drift = on;
    if (on) this.rebase();
    this.onDriftChange?.(on);
  }

  get driftOn(): boolean {
    return this.drift;
  }

  private rebase(): void {
    this.basePos.copy(this.camera.position);
    this.baseTarget.copy(this.controls.target);
    this.driftTime = 0;
  }

  private stepTween(dt: number): void {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(tw.t + dt / 1.6, 1);
    const k = easeInOut(tw.t);
    this.camera.position.lerpVectors(tw.fromPos, new THREE.Vector3(...tw.to.position), k);
    this.controls.target.lerpVectors(tw.fromTarget, new THREE.Vector3(...tw.to.target), k);
    this.camera.fov = tw.fromFov + (tw.to.fov - tw.fromFov) * k;
    this.camera.updateProjectionMatrix();
    if (tw.t >= 1) {
      this.tween = null;
      this.rebase();
    }
  }

  private stepFly(dt: number, scene: PaintingScene): void {
    const k = this.keys;
    const f = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'));
    const r = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    const u = Number(k.has('KeyE')) - Number(k.has('KeyQ'));
    if (f === 0 && r === 0 && u === 0) return;
    this.userTookOver();
    const speed = scene.flySpeed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1) * dt;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, this.camera.up).normalize();
    const move = new THREE.Vector3()
      .addScaledVector(fwd, f * speed)
      .addScaledVector(right, r * speed);
    move.y += u * speed;
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  private stepDrift(dt: number): void {
    if (!this.drift || this.tween) return;
    this.driftTime += dt;
    const t = this.driftTime;
    const off = new THREE.Vector3().subVectors(this.basePos, this.baseTarget);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += 0.075 * Math.sin(t * 0.11);
    sph.phi = THREE.MathUtils.clamp(sph.phi - 0.02 * Math.sin(t * 0.083), 0.05, Math.PI - 0.05);
    sph.radius *= 1 - 0.035 * Math.sin(t * 0.067);
    this.camera.position.setFromSpherical(sph).add(this.baseTarget);
    this.controls.target.copy(this.baseTarget);
  }

  private renderFrame(dt: number): void {
    const scene = this.active;
    if (!scene || !this.postMaterial) return;
    const r = this.renderer;
    const floor = scene.floorAt(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.controls.update();

    const size = new THREE.Vector2();
    r.getDrawingBufferSize(size);
    const ctx: FrameContext = { renderer: r, camera: this.camera, time: this.time, dt, width: size.x, height: size.y };
    r.info.reset();
    scene.update(ctx);
    scene.prePass?.(ctx);
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene.scene, this.camera);
    r.setRenderTarget(null);
    const u = this.postMaterial.uniforms;
    (u.uRes.value as THREE.Vector2).copy(size);
    u.uTime.value = this.time;
    r.render(this.postScene, this.postCamera);
  }

  private readonly tick = (now: number): void => {
    if (this.paused) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
    const rawMs = this.lastNow === null ? 16.7 : now - this.lastNow;
    this.lastNow = now;
    const dt = Math.min(rawMs / 1000, 0.1);
    this.time += dt;
    const scene = this.active;
    if (!scene) return;

    const cpuStart = performance.now();
    this.stepTween(dt);
    this.stepFly(dt, scene);
    this.stepDrift(dt);
    this.renderFrame(dt);
    const cpuMs = performance.now() - cpuStart;

    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.deltas[this.frames % FRAME_WINDOW] = rawMs;
    this.frames++;
    this.deltaCount = Math.min(this.deltaCount + 1, FRAME_WINDOW);
    let sum = 0;
    for (let i = 0; i < this.deltaCount; i++) sum += this.deltas[(this.frames - 1 - i + FRAME_WINDOW * 4) % FRAME_WINDOW];
    const frameMs = sum / this.deltaCount;
    const info = this.renderer.info;
    const metrics: DemoMetrics = {
      scene: this.activeId,
      fps: Math.round((1000 / frameMs) * 10) / 10,
      frameMs: Math.round(frameMs * 100) / 100,
      cpuMs: Math.round(cpuMs * 100) / 100,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height,
      pixelRatio: this.renderer.getPixelRatio(),
      frames: this.frames,
    };
    window.__DEMO_METRICS__ = metrics;
    if (now - this.lastEmit > 200) {
      this.lastEmit = now;
      this.onMetrics?.(metrics);
    }
  };

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.keys.clear();
    } else {
      this.lastNow = null;
      if (!this.raf) {
        this.raf = requestAnimationFrame(this.tick);
      }
    }
  }

  /** Renders one frame at scene time t without waiting for the display. */
  renderFrameNow(t: number): { calls: number; triangles: number } {
    this.time = t;
    this.renderFrame(1 / 60);
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }

  /** Renders frames back to back and waits for the GPU: the uncapped frame cost. */
  benchmark(frames: number): BenchmarkResult {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    this.renderFrame(1 / 60);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const start = performance.now();
    for (let i = 0; i < frames; i++) {
      this.time += 1 / 60;
      this.renderFrame(1 / 60);
      gl.flush();
    }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const msPerFrame = (performance.now() - start) / frames;
    return { frames, msPerFrame: Math.round(msPerFrame * 1000) / 1000, fpsUncapped: Math.round(1000 / msPerFrame) };
  }

  glError(): number {
    return this.renderer.getContext().getError();
  }

  destroy(): void {
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.controls.dispose();
    this.target.dispose();
    this.postMaterial?.dispose();
    this.renderer.dispose();
  }
}

declare global {
  interface Window {
    __DEMO_METRICS__?: DemoMetrics;
    __DEMO_API__?: unknown;
    __INITIAL_SCENE__?: string;
    __SINGLE_SCENE_MODE__?: boolean;
  }
}
